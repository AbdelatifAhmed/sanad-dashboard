import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FamilyManagementService,
  FamilyDetailsData,
} from '../../../core/services/family-management.service';
import { BookingsService, AdminBooking } from '../../../core/services/bookings.service';
import { ToastNotificationComponent } from '../../../shared/components/toast-notification/toast-notification';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { BookingDetailModalComponent } from '../../../shared/components/booking-detail-modal/booking-detail-modal';
import { CareRequestModalComponent } from '../../../shared/components/care-request-modal/care-request-modal';
import { MessageButtonComponent } from '../../../shared/components/message-button/message-button';
export type FamilyTabId = 'overview' | 'bookings' | 'caregivers' | 'requests';

@Component({
  selector: 'app-family-details',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterModule,
    ToastNotificationComponent, EmptyStateComponent,
    BookingDetailModalComponent, CareRequestModalComponent,
    MessageButtonComponent,
  ],
  templateUrl: './family-details.component.html',
  styleUrl: './family-details.component.css',
})
export class FamilyDetailsComponent implements OnInit {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly familySvc    = inject(FamilyManagementService);
  private readonly bookingsSvc  = inject(BookingsService);

  readonly familyId     = signal<string | null>(null);
  readonly details      = signal<FamilyDetailsData | null>(null);
  readonly isLoading    = signal<boolean>(true);
  readonly error        = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly toast        = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  readonly activeTab = signal<FamilyTabId>('overview');
  readonly tabs: { id: FamilyTabId; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Overview',          icon: 'person'            },
    { id: 'bookings',   label: 'Booking History',   icon: 'history'           },
    { id: 'caregivers', label: 'Caregivers',         icon: 'medical_services'  },
    { id: 'requests',   label: 'Care Requests',      icon: 'assignment'        },
  ];

  // ── Bookings for this family ───────────────────────────────────────────────
  readonly bookings        = signal<AdminBooking[]>([]);
  readonly bookingsLoading = signal<boolean>(false);
  readonly bookingsTotal   = signal<number>(0);
  readonly bookingsPage    = signal<number>(1);
  readonly bookingsPages   = signal<number>(1);
  selectedBookingId        = signal<string | null>(null);
  openRequestId            = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly verificationChecks = computed(() => {
    const d = this.details();
    if (!d) return [];
    return [
      { label: 'Email Verified',   done: !!d.family.email,  icon: 'mail'     },
      { label: 'Phone Provided',   done: !!d.family.phone,  icon: 'call'     },
      { label: 'Profile Complete', done: !!d.profile,       icon: 'person'   },
      { label: 'Beneficiary Added',done: (d.profile?.beneficiaries?.length ?? 0) > 0, icon: 'elderly' },
    ];
  });

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set('No family ID provided.'); this.isLoading.set(false); return; }
    this.familyId.set(id);
    this.loadDetails(id);
  }

  loadDetails(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.familySvc.getFamilyDetails(id).subscribe({
      next: (res) => {
        this.details.set(res.data);
        this.isLoading.set(false);
        this.loadBookings(1);
      },
      error: () => {
        this.error.set('Failed to load family profile. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  // ── Load bookings scoped to this family ──────────────────────────────────
  loadBookings(page: number): void {
    const fid = this.familyId();
    if (!fid) return;
    this.bookingsLoading.set(true);
    this.bookingsSvc.getBookings({ page, limit: 8, familyId: fid }).subscribe({
      next: (res) => {
        this.bookings.set(res.data?.bookings ?? []);
        this.bookingsTotal.set(res.pagination?.total ?? 0);
        this.bookingsPage.set(res.pagination?.page ?? 1);
        this.bookingsPages.set(res.pagination?.totalPages ?? 1);
        this.bookingsLoading.set(false);
      },
      error: () => { this.bookingsLoading.set(false); },
    });
  }

  // ── Toggle suspension ────────────────────────────────────────────────────
  toggleSuspension(): void {
    const id = this.familyId();
    if (!id || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.familySvc.toggleBanFamily(id).subscribe({
      next: (res) => {
        const banned = res.data?.user?.isBanned;
        this.showToast(`Account is now ${banned ? 'suspended' : 'active'}.`, 'success');
        this.isSubmitting.set(false);
        this.loadDetails(id);
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to update account status.', 'error');
        this.isSubmitting.set(false);
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/families']); }
  openCaregiver(id: string): void { this.router.navigate(['/caregivers', id]); }
  openBooking(id: string): void   { this.selectedBookingId.set(id); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return 'F';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getServiceLabel(type?: string): string {
    const m: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physiotherapy',
      child_care: 'Child Care',
    };
    return type ? (m[type] ?? type) : '—';
  }

  getBookingStatusClass(status: string): string {
    const m: Record<string, string> = {
      pending: 'pp-pending', pending_payment: 'pp-pending',
      approved: 'pp-approved', active: 'pp-active',
      completed: 'pp-completed', cancelled: 'pp-cancelled',
    };
    return m[status] ?? 'pp-pending';
  }

  getBookingStatusLabel(status: string): string {
    const m: Record<string, string> = {
      pending: 'Pending', pending_payment: 'Awaiting Payment',
      approved: 'Approved', active: 'Active',
      completed: 'Completed', cancelled: 'Cancelled',
    };
    return m[status] ?? status;
  }

  getJobStatusClass(status: string): string {
    const m: Record<string, string> = {
      open: 'pp-active', filled: 'pp-completed', closed: 'pp-cancelled',
    };
    return m[status] ?? 'pp-pending';
  }

  formatCurrency(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('en-EG');
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ message: msg, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
