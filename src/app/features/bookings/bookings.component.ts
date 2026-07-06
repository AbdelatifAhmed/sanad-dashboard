import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  BookingsService, AdminBooking, BookingStats, BookingStatus
} from '../../core/services/bookings.service';

@Component({
  selector: 'app-bookings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.css',
})
export class BookingsComponent implements OnInit, OnDestroy {
  private readonly svc     = inject(BookingsService);
  private readonly router  = inject(Router);
  private readonly route   = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  // ── Filter state ───────────────────────────────────────────────────────────
  searchQuery  = '';
  statusFilter = 'all';
  sortOrder    = 'desc';

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly bookings   = signal<AdminBooking[]>([]);
  readonly stats      = signal<BookingStats | null>(null);
  readonly isLoading  = signal<boolean>(true);
  readonly error      = signal<string | null>(null);
  readonly total      = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly page       = signal<number>(1);
  readonly limit      = 15;

  readonly pageNumbers = computed<number[]>(() => {
    const t = this.totalPages(), c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(c - 2, t - 4));
    return Array.from({ length: Math.min(5, t) }, (_, i) => start + i);
  });

  readonly statusOptions = [
    { value: 'all',             label: 'All',           colorClass: 'chip-all'       },
    { value: 'pending',         label: 'Pending',       colorClass: 'chip-pending'   },
    { value: 'pending_payment', label: 'Awaiting Pay',  colorClass: 'chip-awaiting'  },
    { value: 'approved',        label: 'Approved',      colorClass: 'chip-approved'  },
    { value: 'active',          label: 'Active',        colorClass: 'chip-active'    },
    { value: 'completed',       label: 'Completed',     colorClass: 'chip-completed' },
    { value: 'cancelled',       label: 'Cancelled',     colorClass: 'chip-cancelled' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.statusFilter = qp.get('status') ?? 'all';
    this.sortOrder    = qp.get('order')  ?? 'desc';
    this.page.set(parseInt(qp.get('page') ?? '1', 10));

    this.search$.pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => { this.searchQuery = v; this.page.set(1); this.load(); });

    this.load();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.syncParams();

    this.svc.getBookings({
      status: this.statusFilter !== 'all' ? this.statusFilter : undefined,
      page:   this.page(),
      limit:  this.limit,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.bookings.set(res.data?.bookings ?? []);
        this.stats.set(res.stats ?? null);
        this.total.set(res.pagination?.total ?? 0);
        this.totalPages.set(res.pagination?.totalPages ?? 1);
        this.isLoading.set(false);
      },
      error: () => { this.error.set('Failed to load bookings.'); this.isLoading.set(false); },
    });
  }

  private syncParams(): void {
    const p: Record<string, string> = {};
    if (this.statusFilter !== 'all') p['status'] = this.statusFilter;
    if (this.sortOrder !== 'desc')   p['order']  = this.sortOrder;
    if (this.page() > 1)             p['page']   = this.page().toString();
    this.router.navigate([], { queryParams: p, replaceUrl: true });
  }

  setStatus(v: string): void   { this.statusFilter = v; this.page.set(1); this.load(); }
  goToPage(n: number): void    { if (n >= 1 && n <= this.totalPages()) { this.page.set(n); this.load(); } }
  openDetail(id: string): void { this.router.navigate(['/bookings', id]); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getServiceLabel(type?: string): string {
    const m: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physical Therapy',
      child_care: 'Child Care',
    };
    return type ? (m[type] ?? type) : '—';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      pending: 'bk-pending', pending_payment: 'bk-awaiting',
      approved: 'bk-approved', active: 'bk-active',
      completed: 'bk-completed', cancelled: 'bk-cancelled',
    };
    return m[status] ?? 'bk-pending';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      pending: 'Pending', pending_payment: 'Awaiting Pay',
      approved: 'Approved', active: 'Active',
      completed: 'Completed', cancelled: 'Cancelled',
    };
    return m[status] ?? status;
  }

  getPaymentClass(status: string): string {
    const m: Record<string, string> = { paid: 'pay-paid', unpaid: 'pay-unpaid', refunded: 'pay-refunded' };
    return m[status] ?? 'pay-unpaid';
  }

  formatCurrency(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('en-EG');
  }

  trackById(_: number, b: AdminBooking): string { return b._id; }
}
