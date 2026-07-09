import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  BookingsService, AdminBooking, BookingStatus, ProposalItem
} from '../../../core/services/bookings.service';
import { ReviewsService, AdminReview } from '../../../core/services/reviews.service';
import { ToastNotificationComponent } from '../../../shared/components/toast-notification/toast-notification';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';

export type BookingTabId = 'overview' | 'timeline' | 'payment' | 'review' | 'proposals';

interface TimelineStep {
  key: string;
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  done: boolean;
  timestamp?: string;
  note?: string;
}

@Component({
  selector: 'app-booking-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule,
            ToastNotificationComponent, EmptyStateComponent],
  templateUrl: './booking-details.component.html',
  styleUrl:    './booking-details.component.css',
})
export class BookingDetailsComponent implements OnInit, OnDestroy {
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly bkSvc    = inject(BookingsService);
  private readonly rvSvc    = inject(ReviewsService);
  private readonly destroy$ = new Subject<void>();

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly booking        = signal<AdminBooking | null>(null);
  readonly proposals      = signal<ProposalItem[]>([]);
  readonly review         = signal<AdminReview | null>(null);
  readonly isLoading      = signal<boolean>(true);
  readonly error          = signal<string | null>(null);
  readonly isSubmitting   = signal<boolean>(false);
  readonly toast          = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Confirm modal ─────────────────────────────────────────────────────────
  readonly confirmStatus  = signal<{ status: BookingStatus } | null>(null);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  readonly activeTab = signal<BookingTabId>('overview');
  readonly tabs: { id: BookingTabId; label: string; icon: string }[] = [
    { id: 'overview',  label: 'Overview',   icon: 'info'             },
    { id: 'timeline',  label: 'Timeline',   icon: 'timeline'         },
    { id: 'payment',   label: 'Payment',    icon: 'payments'         },
    { id: 'review',    label: 'Review',     icon: 'star'             },
    { id: 'proposals', label: 'Proposals',  icon: 'group'            },
  ];

  // ── Computed timeline ─────────────────────────────────────────────────────
  readonly timeline = computed<TimelineStep[]>(() => {
    const b = this.booking();
    if (!b) return [];

    const statusOrder = ['pending', 'pending_payment', 'approved', 'active', 'completed', 'cancelled'];
    const currentIdx  = statusOrder.indexOf(b.status);

    const steps: TimelineStep[] = [
      {
        key: 'pending', label: 'Requested',
        icon: 'pending_actions', iconBg: 'rgba(245,158,11,0.12)', iconColor: '#f59e0b',
        done: true, timestamp: b.createdAt, note: 'Booking request submitted',
      },
      {
        key: 'approved', label: 'Accepted',
        icon: 'check_circle', iconBg: 'rgba(44,105,86,0.12)', iconColor: 'var(--color-secondary)',
        done: currentIdx >= statusOrder.indexOf('approved'),
        timestamp: b.updatedAt,
      },
      {
        key: 'active', label: 'Started',
        icon: 'play_circle', iconBg: 'rgba(0,103,103,0.1)', iconColor: 'var(--color-primary)',
        done: currentIdx >= statusOrder.indexOf('active'),
        timestamp: b.startDate,
      },
      {
        key: 'completed', label: 'Completed',
        icon: 'task_alt', iconBg: 'rgba(22,163,74,0.1)', iconColor: '#16a34a',
        done: b.status === 'completed',
        timestamp: b.endDate,
      },
    ];

    if (b.status === 'cancelled') {
      steps.push({
        key: 'cancelled', label: 'Cancelled',
        icon: 'cancel', iconBg: 'rgba(186,26,26,0.1)', iconColor: 'var(--color-error)',
        done: true, timestamp: b.updatedAt, note: 'Booking was cancelled',
      });
    }

    return steps;
  });

  // ── Allowed next statuses ─────────────────────────────────────────────────
  readonly allowedStatuses = computed(() => {
    const b = this.booking();
    if (!b) return [];
    const transitions: Record<string, BookingStatus[]> = {
      pending:         ['approved', 'cancelled'],
      pending_payment: ['approved', 'cancelled'],
      approved:        ['active',   'cancelled'],
      active:          ['completed','cancelled'],
      completed: [], cancelled: [],
    };
    return (transitions[b.status] ?? []).map(s => ({
      value: s,
      label: s === 'cancelled' ? 'Cancel Booking' : `Mark as ${s.charAt(0).toUpperCase() + s.slice(1)}`,
      danger: s === 'cancelled',
    }));
  });

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set('No booking ID provided.'); this.isLoading.set(false); return; }
    this.load(id);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private load(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.bkSvc.getBookingById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.booking.set(res.data.booking);
          this.proposals.set(res.data.proposals ?? []);
          this.isLoading.set(false);
          // Load review for this booking's companion
          const companionId = (res.data.booking as any).companionId?._id;
          if (companionId) this.loadReview(companionId);
        },
        error: () => {
          this.error.set('Failed to load booking details. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  private loadReview(companionId: string): void {
    // Reviews endpoint supports ?companionId= — fetch the most recent review
    // for this companion and surface it on the review tab
    this.rvSvc.getReviews({ page: 1, limit: 20 } as any).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const b = this.booking();
        // Try to match on bookingId first, otherwise show most recent
        const found = res.reviews?.find(r => {
          const bid = (r.bookingId as any)?._id ?? r.bookingId;
          return bid === b?._id;
        }) ?? null;
        this.review.set(found);
      },
      error: () => {},
    });
  }

  // ── Status change ─────────────────────────────────────────────────────────
  requestStatusChange(status: BookingStatus): void { this.confirmStatus.set({ status }); }
  cancelStatusChange(): void { this.confirmStatus.set(null); }

  executeStatusChange(): void {
    const b = this.booking();
    const req = this.confirmStatus();
    if (!b || !req || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    this.bkSvc.updateStatus(b._id, req.status).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.booking.set(res.data.booking);
        this.showToast(`Booking marked as ${req.status}.`, 'success');
        this.confirmStatus.set(null);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.showToast('Failed to update status.', 'error');
        this.isSubmitting.set(false);
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/bookings']); }

  viewFamily(id?: string):    void { if (id) this.router.navigate(['/families', id]); }
  viewCaregiver(id?: string): void { if (id) this.router.navigate(['/caregivers', id]); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getServiceLabel(booking?: AdminBooking | null): string {
    const type = booking?.serviceType ?? booking?.jobPostId?.serviceType;
    const m: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physical Therapy',
      child_care: 'Child Care',
    };
    return type ? (m[type] ?? type) : 'Not specified';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      pending: 'bd-pending', pending_payment: 'bd-awaiting',
      approved: 'bd-approved', active: 'bd-active',
      completed: 'bd-completed', cancelled: 'bd-cancelled',
    };
    return m[status] ?? 'bd-pending';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      pending: 'Pending', pending_payment: 'Awaiting Payment',
      approved: 'Approved', active: 'Active',
      completed: 'Completed', cancelled: 'Cancelled',
    };
    return m[status] ?? status;
  }

  getPaymentClass(status: string): string {
    const m: Record<string, string> = { paid: 'bd-pay-paid', unpaid: 'bd-pay-unpaid', refunded: 'bd-pay-refunded' };
    return m[status] ?? 'bd-pay-unpaid';
  }

  getProposalClass(status: string): string {
    const m: Record<string, string> = {
      accepted: 'bd-approved', rejected: 'bd-cancelled', pending: 'bd-pending',
    };
    return m[status] ?? 'bd-pending';
  }

  formatCurrency(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('en-EG');
  }

  getStarArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ message: msg, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
