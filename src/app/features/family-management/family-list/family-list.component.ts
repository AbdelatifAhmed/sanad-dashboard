import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  FamilyManagementService,
  FamilyListEntry,
  FamiliesResponse,
} from '../../../core/services/family-management.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ToastNotificationComponent } from '../../../shared/components/toast-notification/toast-notification';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, EmptyStateComponent, ToastNotificationComponent],
  templateUrl: './family-list.component.html',
  styleUrl: './family-list.component.css',
})
export class FamilyListComponent implements OnInit, OnDestroy {
  private readonly svc     = inject(FamilyManagementService);
  private readonly router  = inject(Router);
  private readonly route   = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  // ── Filter state ───────────────────────────────────────────────────────────
  searchQuery  = '';
  statusFilter = 'all';
  sortBy       = 'createdAt';
  sortOrder    = 'desc';

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly families   = signal<FamilyListEntry[]>([]);
  readonly total      = signal<number>(0);
  readonly page       = signal<number>(1);
  readonly totalPages = signal<number>(1);
  readonly stats      = signal<{ total: number; totalActive: number; totalSuspended: number; totalElderly: number; totalActiveRequests: number } | null>(null);
  readonly isLoading  = signal<boolean>(true);
  readonly error      = signal<string | null>(null);
  readonly toast      = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  readonly limit = 12;

  readonly pageNumbers = computed<number[]>(() => {
    const t = this.totalPages(), c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(c - 2, t - 4));
    return Array.from({ length: Math.min(5, t) }, (_, i) => start + i);
  });

  readonly statuses = [
    { value: 'all',       label: 'All',       colorClass: 'chip-all'       },
    { value: 'active',    label: 'Active',    colorClass: 'chip-active'    },
    { value: 'suspended', label: 'Suspended', colorClass: 'chip-suspended' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.searchQuery  = qp.get('q')      ?? '';
    this.statusFilter = qp.get('status') ?? 'all';
    this.sortBy       = qp.get('sort')   ?? 'createdAt';
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

    this.svc.getFamilies({
      status:    this.statusFilter !== 'all' ? this.statusFilter : undefined,
      search:    this.searchQuery || undefined,
      sortBy:    this.sortBy,
      sortOrder: this.sortOrder,
      page:      this.page(),
      limit:     this.limit,
    }).subscribe({
      next: (res: FamiliesResponse) => {
        this.families.set(res.data?.families ?? []);
        this.total.set(res.pagination?.total ?? 0);
        this.totalPages.set(res.pagination?.totalPages ?? 1);
        this.stats.set(res.stats ?? null);
        this.isLoading.set(false);
      },
      error: () => { this.error.set('Failed to load families.'); this.isLoading.set(false); },
    });
  }

  private syncParams(): void {
    const p: Record<string, string> = {};
    if (this.searchQuery)          p['q']      = this.searchQuery;
    if (this.statusFilter !== 'all') p['status'] = this.statusFilter;
    if (this.sortBy !== 'createdAt') p['sort']   = this.sortBy;
    if (this.sortOrder !== 'desc')   p['order']  = this.sortOrder;
    if (this.page() > 1)             p['page']   = this.page().toString();
    this.router.navigate([], { queryParams: p, replaceUrl: true });
  }

  onSearchInput(e: Event): void { this.search$.next((e.target as HTMLInputElement).value); }
  setStatus(v: string): void    { this.statusFilter = v; this.page.set(1); this.load(); }
  setSort(f: string): void {
    if (this.sortBy === f) this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    else { this.sortBy = f; this.sortOrder = 'desc'; }
    this.page.set(1); this.load();
  }
  goToPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.page.set(n); this.load();
  }
  clearFilters(): void { this.searchQuery = ''; this.statusFilter = 'all'; this.sortBy = 'createdAt'; this.sortOrder = 'desc'; this.page.set(1); this.load(); }
  get hasActiveFilters(): boolean { return !!this.searchQuery || this.statusFilter !== 'all'; }

  openProfile(id: string): void { this.router.navigate(['/families', id]); }

  getInitials(name?: string): string {
    if (!name) return 'F';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  trackById(_: number, f: FamilyListEntry): string { return f._id; }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ message: msg, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
