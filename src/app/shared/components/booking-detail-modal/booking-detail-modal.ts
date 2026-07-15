import {
  ChangeDetectionStrategy, Component, EventEmitter,
  inject, Input, OnChanges, OnDestroy, Output, signal, SimpleChanges
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  AdminBooking, BookingDetailResponse, BookingStatus,
  BookingsService, ProposalItem
} from '../../../core/services/bookings.service';
import { ToastService }            from '../../../core/services/toast.service';
import { ConfirmDialogComponent }  from '../confirm-dialog/confirm-dialog';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner';
import { ErrorBannerComponent }    from '../error-banner/error-banner';

/**
 * Reusable booking-detail modal overlay.
 *
 * Usage:
 *   <app-booking-detail-modal
 *     [bookingId]="idToOpen"
 *     (closed)="idToOpen = null"
 *   />
 *
 * Pass a non-null bookingId to open the modal; pass null to keep it closed.
 * The component fetches the full booking detail itself and handles status changes.
 */
@Component({
  selector: 'app-booking-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, CurrencyPipe, LoadingSpinnerComponent, ErrorBannerComponent, ConfirmDialogComponent],
  templateUrl: './booking-detail-modal.html',
})
export class BookingDetailModalComponent implements OnChanges, OnDestroy {
  private readonly bookingsService = inject(BookingsService);
  private readonly toastService    = inject(ToastService);
  private readonly router          = inject(Router);
  private readonly destroy$        = new Subject<void>();

  /** Pass a booking ID to open; null/undefined to keep closed. */
  @Input() bookingId: string | null | undefined = null;

  /** Emitted when the user closes the modal. */
  @Output() closed = new EventEmitter<void>();

  /** Emitted after a successful status change, so parent can refresh its list. */
  @Output() statusChanged = new EventEmitter<{ bookingId: string; status: BookingStatus }>();

  // ── Detail state ──────────────────────────────────────────────────────────
  readonly booking       = signal<AdminBooking | null>(null);
  readonly proposals     = signal<ProposalItem[]>([]);
  readonly detailLoading = signal<boolean>(false);
  readonly detailError   = signal<string | null>(null);

  // ── Status-change confirm state ───────────────────────────────────────────
  readonly confirmStatus      = signal<{ booking: AdminBooking; status: BookingStatus } | null>(null);
  readonly isSubmittingStatus = signal<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bookingId']) {
      const id = changes['bookingId'].currentValue as string | null;
      if (id) {
        this.load(id);
      } else {
        this.reset();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  private load(id: string): void {
    this.booking.set(null);
    this.proposals.set([]);
    this.detailError.set(null);
    this.detailLoading.set(true);

    this.bookingsService.getBookingById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: BookingDetailResponse) => {
          this.booking.set(res.data.booking);
          this.proposals.set(res.data.proposals ?? []);
          this.detailLoading.set(false);
        },
        error: (err) => {
          if (err?.status === 404) {
            this.toastService.error('This booking record is no longer available.');
            this.close();
          } else {
            this.detailError.set('Failed to load booking details. Please try again.');
          }
          this.detailLoading.set(false);
        },
      });
  }

  retry(): void {
    if (this.bookingId) this.load(this.bookingId);
  }

  private reset(): void {
    this.booking.set(null);
    this.proposals.set([]);
    this.detailError.set(null);
    this.detailLoading.set(false);
    this.confirmStatus.set(null);
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  close(): void {
    this.reset();
    this.closed.emit();
  }

  // ── Status change ─────────────────────────────────────────────────────────
  requestStatusChange(status: BookingStatus): void {
    const b = this.booking();
    if (!b) return;
    this.confirmStatus.set({ booking: b, status });
  }

  cancelStatusChange(): void {
    this.confirmStatus.set(null);
  }

  executeStatusChange(): void {
    const req = this.confirmStatus();
    if (!req) return;
    this.isSubmittingStatus.set(true);

    this.bookingsService.updateStatus(req.booking._id, req.status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.booking.update(b => b ? { ...b, status: req.status } : b);
          this.toastService.success(`Booking marked as ${req.status}.`);
          this.confirmStatus.set(null);
          this.isSubmittingStatus.set(false);
          this.statusChanged.emit({ bookingId: req.booking._id, status: req.status });
        },
        error: () => {
          this.toastService.error('Failed to update booking status.');
          this.isSubmittingStatus.set(false);
        },
      });
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  viewFamily(id?: string): void {
    if (id) this.router.navigate(['/families', id]);
  }

  viewCaregiver(companionId?: string): void {
    if (companionId) {
      this.router.navigate(['/caregivers', companionId]);
    } else {
      this.router.navigate(['/caregivers']);
    }
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getServiceLabel(type?: string): string {
    const map: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physical Therapy',
      child_care: 'Child Care',
    };
    return type ? (map[type] ?? type) : '—';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      pending:         'bg-amber-100 text-amber-700 border-amber-200',
      pending_payment: 'bg-blue-100 text-blue-700 border-blue-200',
      approved:        'bg-secondary-container/40 text-secondary border-secondary/20',
      active:          'bg-tertiary-container/30 text-tertiary border-tertiary/20',
      completed:       'bg-emerald-100 text-emerald-700 border-emerald-200',
      cancelled:       'bg-red-100 text-red-700 border-red-200',
    };
    return m[status] ?? 'bg-surface-container text-on-surface-variant border-outline-variant/30';
  }

  allowedNextStatuses(current: string): { value: BookingStatus; label: string }[] {
    const transitions: Record<string, BookingStatus[]> = {
      pending:         ['approved', 'cancelled'],
      pending_payment: ['approved', 'cancelled'],
      approved:        ['active',   'cancelled'],
      active:          ['completed','cancelled'],
      completed:       [],
      cancelled:       [],
    };
    return (transitions[current] ?? []).map(s => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    }));
  }

  getConfirmLabel(): string {
    const s = this.confirmStatus()?.status ?? '';
    return s === 'cancelled' ? 'Cancel Booking' : `Mark as ${s.charAt(0).toUpperCase() + s.slice(1)}`;
  }

  getConfirmClass(): string {
    return this.confirmStatus()?.status === 'cancelled' ? 'bg-error' : 'bg-primary';
  }

  trackByProp(_: number, p: { _id: string }): string { return p._id; }
}
