import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import {
  CaregiverVerificationService,
  CompanionProfile,
  CompanionsResponse,
} from '../../core/services/caregiver-verification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ToastNotificationComponent } from '../../shared/components/toast-notification/toast-notification';

@Component({
  selector: 'app-caregiver-verification',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, EmptyStateComponent, ToastNotificationComponent],
  templateUrl: './caregiver-verification.html',
  styleUrl:    './caregiver-verification.css',
})
export class CaregiverVerificationComponent implements OnInit, OnDestroy {
  private readonly svc    = inject(CaregiverVerificationService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // ── Search debounce ────────────────────────────────────────────────────────
  private readonly searchInput$ = new Subject<string>();

  // ── Filter state (synced with URL query params for back-nav preservation) ──
  searchQuery    = '';
  statusFilter   = 'all';
  specializationFilter = 'all';
  sortBy         = 'createdAt';
  sortOrder      = 'desc';

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly companions   = signal<CompanionProfile[]>([]);
  readonly total        = signal<number>(0);
  readonly page         = signal<number>(1);
  readonly totalPages   = signal<number>(1);
  readonly isLoading    = signal<boolean>(true);
  readonly error        = signal<string | null>(null);
  readonly toast        = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  readonly limit = 12;

  // ── Computed page numbers ──────────────────────────────────────────────────
  readonly pageNumbers = computed<number[]>(() => {
    const t = this.totalPages(), c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(c - 2, t - 4));
    return Array.from({ length: Math.min(5, t) }, (_, i) => start + i);
  });

  // ── Status summary counts for filter chips ──────────────────────────────
  readonly statusCounts = signal<Record<string, number>>({});

  readonly specializations = [
    { value: 'all',                     label: 'All Specializations' },
    { value: 'none',                    label: 'General Caregiver'   },
    { value: 'nursing',                 label: 'Registered Nurse'    },
    { value: 'physiotherapy',           label: 'Physiotherapist'     },
    { value: 'companionship_companion', label: 'Companion'           },
    { value: 'dementia',                label: 'Dementia Specialist' },
  ];

  readonly statuses = [
    { value: 'all',         label: 'All',        colorClass: 'chip-all'      },
    { value: 'pending',     label: 'Pending',    colorClass: 'chip-pending'  },
    { value: 'verified',    label: 'Verified',   colorClass: 'chip-verified' },
    { value: 'under_review',label: 'Needs Info', colorClass: 'chip-review'   },
    { value: 'rejected',    label: 'Rejected',   colorClass: 'chip-rejected' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Restore state from URL query params
    const qp = this.route.snapshot.queryParamMap;
    this.searchQuery         = qp.get('q')    ?? '';
    this.statusFilter        = qp.get('status') ?? 'all';
    this.specializationFilter= qp.get('spec')   ?? 'all';
    this.sortBy              = qp.get('sort')   ?? 'createdAt';
    this.sortOrder           = qp.get('order')  ?? 'desc';
    const restoredPage       = parseInt(qp.get('page') ?? '1', 10);
    this.page.set(restoredPage);

    // Debounced search
    this.searchInput$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(val => {
      this.searchQuery = val;
      this.page.set(1);
      this.load();
    });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.syncQueryParams();

    this.svc.getCompanions({
      status:    this.statusFilter   !== 'all' ? this.statusFilter    : undefined,
      search:    this.searchQuery    || undefined,
      sortBy:    this.sortBy,
      sortOrder: this.sortOrder,
      page:      this.page(),
      limit:     this.limit,
    }).subscribe({
      next: (res: CompanionsResponse) => {
        this.companions.set(res.data?.companions ?? []);
        this.total.set(res.pagination?.total ?? 0);
        this.totalPages.set(res.pagination?.pages ?? 1);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load caregivers. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  // ── Sync URL params (state preservation for back navigation) ──────────────
  private syncQueryParams(): void {
    const params: Record<string, string> = {};
    if (this.searchQuery)                   params['q']      = this.searchQuery;
    if (this.statusFilter !== 'all')        params['status'] = this.statusFilter;
    if (this.specializationFilter !== 'all') params['spec']  = this.specializationFilter;
    if (this.sortBy !== 'createdAt')        params['sort']   = this.sortBy;
    if (this.sortOrder !== 'desc')          params['order']  = this.sortOrder;
    if (this.page() > 1)                    params['page']   = this.page().toString();
    this.router.navigate([], { queryParams: params, replaceUrl: true });
  }

  // ── Filter handlers ────────────────────────────────────────────────────────
  onSearchInput(event: Event): void {
    this.searchInput$.next((event.target as HTMLInputElement).value);
  }

  setStatus(value: string): void {
    this.statusFilter = value;
    this.page.set(1);
    this.load();
  }

  setSpecialization(value: string): void {
    this.specializationFilter = value;
    this.page.set(1);
    this.load();
  }

  setSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.page.set(1);
    this.load();
  }

  goToPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.page.set(n);
    this.load();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.specializationFilter = 'all';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.page.set(1);
    this.load();
  }

  get hasActiveFilters(): boolean {
    return this.searchQuery !== '' ||
      this.statusFilter !== 'all' ||
      this.specializationFilter !== 'all';
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  openProfile(id: string): void {
    this.router.navigate(['/caregivers', id]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getSpecializationLabel(spec: string): string {
    const map: Record<string, string> = {
      nursing: 'Registered Nurse', physiotherapy: 'Physiotherapist',
      companionship_companion: 'Companion', dementia: 'Dementia Specialist',
    };
    return map[spec] ?? 'General Caregiver';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      verified:     'badge-verified',
      rejected:     'badge-rejected',
      under_review: 'badge-review',
      pending:      'badge-pending',
    };
    return m[status] ?? 'badge-pending';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      verified: 'Verified', rejected: 'Rejected',
      under_review: 'Needs Info', pending: 'Pending',
    };
    return m[status] ?? 'Pending';
  }

  getStatusIcon(status: string): string {
    const m: Record<string, string> = {
      verified: 'verified', rejected: 'cancel',
      under_review: 'pending', pending: 'schedule',
    };
    return m[status] ?? 'schedule';
  }

  getRatingStars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  getDocsProgress(comp: CompanionProfile): { done: number; total: number } {
    let done = 0, total = 2;
    const d = comp.documents;
    if (d?.nationalIdCard?.url && d.nationalIdCard.url !== 'placeholder_national_id.jpg') done++;
    if (d?.criminalRecord?.url && d.criminalRecord.url !== 'placeholder_criminal_record.jpg') done++;
    if (comp.companionType === 'specialized') { total++; if (d?.syndicateCard?.url) done++; }
    if (d?.Certificates?.length) { total += d.Certificates.length; done += d.Certificates.length; }
    return { done, total };
  }

  getTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)   return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  trackById(_: number, comp: CompanionProfile): string { return comp._id; }
}
