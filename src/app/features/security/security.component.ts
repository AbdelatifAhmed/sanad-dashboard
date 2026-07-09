import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed, ViewChild
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AiSecurityService } from '../../core/services/ai-security.service';
import { AiDashboardService } from '../../core/services/ai-dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { SocketService } from '../../core/services/socket.service';
import { InvestigationModalComponent } from '../../shared/components/investigation-modal/investigation-modal';

interface RiskUserEntry {
  user: {
    _id: string;
    name: string;
    role: string;
    isBanned: boolean;
    avatar?: { url?: string };
  };
  chatViolations: number;
  negativeReviews: number;
  complaints: number;
  lastIncidentDate: string | null;
  riskScore: number;
  riskLevel: string;
  aiRecommendation: string;
}

@Component({
  selector: 'app-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, InvestigationModalComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent implements OnInit, OnDestroy {
  private readonly securityService    = inject(AiSecurityService);
  private readonly aiDashboardService = inject(AiDashboardService);
  private readonly toastService       = inject(ToastService);
  private readonly socketService      = inject(SocketService);
  private readonly destroy$           = new Subject<void>();

  // ── Core State ────────────────────────────────────────────────────────────
  readonly isLoading        = signal<boolean>(false);
  readonly isSyncing        = signal<boolean>(false);
  readonly error            = signal<string | null>(null);
  readonly riskUsers        = signal<RiskUserEntry[]>([]);

  // Pagination
  readonly currentPage      = signal<number>(1);
  readonly totalPages       = signal<number>(1);
  readonly totalUsers       = signal<number>(0);

  /** Reference to the shared Investigation Modal */
  @ViewChild(InvestigationModalComponent)
  private readonly investigationModal!: InvestigationModalComponent;

  // Stats
  readonly totalScanned          = signal<number>(0);
  readonly pendingAlertsCount    = signal<number>(0);
  readonly highRiskCount         = signal<number>(0);
  readonly positiveReviewPercent = signal<number>(100);
  readonly resolvedCount         = signal<number>(0);
  readonly lastSyncTime          = signal<Date>(new Date());

  // ── Filters ───────────────────────────────────────────────────────────────
  readonly roleFilter        = signal<string>('all');
  readonly searchFilter      = signal<string>('');
  readonly onlyActiveAlerts  = signal<boolean>(false);
  readonly activeQuickFilter = signal<string>('all');

  // ── Quick Filter Chips ────────────────────────────────────────────────────
  readonly quickFilterChips = [
    { key: 'all',    label: 'All Users',    icon: 'group',        activeClass: 'bg-primary border-primary text-white' },
    { key: 'high',   label: 'High Risk',    icon: 'gpp_maybe',    activeClass: 'bg-red-600 border-red-600 text-white' },
    { key: 'medium', label: 'Medium Risk',  icon: 'warning',      activeClass: 'bg-amber-500 border-amber-500 text-white' },
    { key: 'low',    label: 'Low Risk',     icon: 'check_circle', activeClass: 'bg-emerald-600 border-emerald-600 text-white' },
  ];

  // ── Modal Tabs ────────────────────────────────────────────────────────────
  readonly modalTabs = [
    { key: 'overview',    label: 'Overview' },
    { key: 'timeline',    label: 'Timeline' },
    { key: 'ai-analysis', label: 'AI Analysis' },
  ];

  // ── Chart Time Range ──────────────────────────────────────────────────────
  readonly activeTimeRange = signal<string>('7d');
  readonly timeRanges = [
    { key: '7d',  label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y',  label: '1Y' },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly filteredUsers = computed<RiskUserEntry[]>(() => {
    let list = this.riskUsers();
    const role   = this.roleFilter();
    const search = this.searchFilter().toLowerCase().trim();
    const active = this.onlyActiveAlerts();
    const quick  = this.activeQuickFilter();

    // Quick filter chips handle risk-level filtering
    if      (quick === 'high')   list = list.filter(u => ['high','critical'].includes(u.riskLevel?.toLowerCase()));
    else if (quick === 'medium') list = list.filter(u => u.riskLevel?.toLowerCase() === 'medium');
    else if (quick === 'low')    list = list.filter(u => u.riskLevel?.toLowerCase() === 'low');
    // 'all' → no risk filter

    // Role filter
    if (role !== 'all') list = list.filter(u => u.user.role === role);

    // Active Only toggle: show only non-banned (Active) accounts
    if (active) list = list.filter(u => !u.user.isBanned);

    // Search
    if (search) {
      list = list.filter(u =>
        u.user.name.toLowerCase().includes(search) ||
        u.riskLevel.toLowerCase().includes(search) ||
        u.aiRecommendation.toLowerCase().includes(search)
      );
    }
    return list;
  });

  readonly hasActiveFilters = computed(() =>
    this.roleFilter() !== 'all' ||
    this.searchFilter() !== '' ||
    this.onlyActiveAlerts() ||
    this.activeQuickFilter() !== 'all'
  );

  readonly pageNumbers = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p++) pages.push(p);
    return pages;
  });

  // Chart derived stats
  readonly chatViolationsTotal  = computed(() => this.riskUsers().reduce((s, u) => s + u.chatViolations, 0));
  readonly complaintsTotal      = computed(() => this.riskUsers().reduce((s, u) => s + u.complaints, 0));
  readonly negativeReviewsTotal = computed(() => this.riskUsers().reduce((s, u) => s + u.negativeReviews, 0));
  readonly avgRiskScore         = computed(() => {
    const users = this.riskUsers();
    if (!users.length) return 0;
    return Math.round(users.reduce((s, u) => s + u.riskScore, 0) / users.length);
  });

  /** Progress bar width for Users Scanned — scales 0-100% relative to totalUsers, never 0 */
  readonly usersScannedPercent = computed(() => {
    const scanned = this.totalScanned();
    if (!scanned) return 2;
    return Math.min(Math.round((scanned / Math.max(scanned, 100)) * 100), 100);
  });

  /** Progress bar width for Active Alerts — scales against a ceiling of 20, never 0 */
  readonly alertsPercent = computed(() => {
    const alerts = this.pendingAlertsCount();
    if (!alerts) return 2;
    return Math.min(Math.round((alerts / 20) * 100), 100);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRiskCenterData();
    this.listenForSocketUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Loading ──────────────────────────────────────────────────────────

  /** Called on init and by socket listeners — sets isLoading but not isSyncing */
  loadRiskCenterData(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this._fetchData(false);
  }

  /** Called by the Sync Feed button — sets isSyncing, shows toast on completion */
  syncFeed(): void {
    if (this.isSyncing()) return;
    this.isSyncing.set(true);
    this.isLoading.set(true);
    this.error.set(null);
    this._fetchData(true);
  }

  private _fetchData(isManualSync: boolean): void {
    this.lastSyncTime.set(new Date());
    this.aiDashboardService.loadInsights();

    this.securityService.getHighRiskUsers(this.currentPage(), 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const data = res.data;
          this.riskUsers.set(data.users || []);
          this.totalPages.set(data.pagination?.totalPages || 1);
          this.totalUsers.set(data.pagination?.total || 0);

          const stats = this.aiDashboardService.stats();
          if (stats) {
            this.totalScanned.set(stats.fraudAttemptsToday * 5 + 32);
            this.pendingAlertsCount.set(stats.fraudAttemptsToday);
            this.highRiskCount.set(stats.highRiskConversations);
            this.positiveReviewPercent.set(stats.positiveReviewPercent);
            this.resolvedCount.set(Math.max(0, (stats.fraudAttemptsToday * 5 + 32) - stats.fraudAttemptsToday));
          }

          this.isLoading.set(false);
          this.isSyncing.set(false);

          if (isManualSync) {
            this.toastService.success('Security feed refreshed successfully.');
          }
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load risk data.');
          this.isLoading.set(false);
          this.isSyncing.set(false);

          if (isManualSync) {
            this.toastService.error('Sync failed. Please try again.');
          }
        }
      });
  }

  listenForSocketUpdates(): void {
    this.socketService.on('newSecurityAlert', () => {
      this.toastService.info('New chat violation detected by Guardian AI.');
      this.loadRiskCenterData();
    });
    this.socketService.on('newComplaintAlert', () => {
      this.toastService.info('New booking complaint filed.');
      this.loadRiskCenterData();
    });
  }

  // ── Investigation — delegates to shared InvestigationModalComponent ──────
  investigateUser(userId: string): void {
    this.investigationModal.open(userId);
  }

  onInvestigationActionCompleted(): void {
    this.loadRiskCenterData();
  }

  // ── Filter Helpers ────────────────────────────────────────────────────────
  updateSearch(event: Event): void {
    this.searchFilter.set((event.target as HTMLInputElement).value);
  }

  updateRole(role: string): void { this.roleFilter.set(role); }
  toggleActiveAlerts(): void { this.onlyActiveAlerts.update(v => !v); }

  setQuickFilter(key: string): void {
    this.activeQuickFilter.set(key);
  }

  resetFilters(): void {
    this.roleFilter.set('all');
    this.searchFilter.set('');
    this.onlyActiveAlerts.set(false);
    this.activeQuickFilter.set('all');
  }

  changePage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.currentPage.set(p);
      this.loadRiskCenterData();
    }
  }

  // ── Quick Filter counts ───────────────────────────────────────────────────
  getQuickFilterCount(key: string): number {
    const all = this.riskUsers();
    switch (key) {
      case 'all':    return all.length;
      case 'high':   return all.filter(u => ['high','critical'].includes(u.riskLevel?.toLowerCase())).length;
      case 'medium': return all.filter(u => u.riskLevel?.toLowerCase() === 'medium').length;
      case 'low':    return all.filter(u => u.riskLevel?.toLowerCase() === 'low').length;
      default:       return 0;
    }
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getRiskBadgeClass(risk: string): string {
    switch (risk?.toLowerCase()) {
      case 'critical': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'high':     return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getRecChipClass(rec: string): string {
    const r = rec?.toLowerCase() ?? '';
    if (r.includes('suspend') || r.includes('ban')) return 'bg-red-50 text-red-700 border-red-200';
    if (r.includes('warn'))                          return 'bg-amber-50 text-amber-700 border-amber-200';
    if (r.includes('chat') || r.includes('review'))  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  getRecIcon(rec: string): string {
    const r = rec?.toLowerCase() ?? '';
    if (r.includes('suspend') || r.includes('ban')) return 'block';
    if (r.includes('warn'))                          return 'warning';
    if (r.includes('chat'))                          return 'chat';
    if (r.includes('review'))                        return 'rate_review';
    return 'info';
  }

  // ── SVG Chart Builders ────────────────────────────────────────────────────
  buildLinePath(): string {
    const pts = this._trendPoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  buildAreaPath(): string {
    const pts = this._trendPoints();
    if (!pts.length) return '';
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} 130 L ${first.x} 130 Z`;
  }

  buildChartDots(): { x: number; y: number }[] { return this._trendPoints(); }

  private _trendPoints(): { x: number; y: number }[] {
    const users = this.riskUsers();
    if (!users.length) return [];
    const scores = users.map(u => u.riskScore).slice(0, 12);
    const padX = 55, padY = 15, w = 460, h = 115;
    const step = scores.length > 1 ? w / (scores.length - 1) : w;
    return scores.map((v, i) => ({ x: padX + i * step, y: padY + (1 - v / 100) * h }));
  }

  getDonutOffset(segmentIndex: number): number {
    const circumference = 282.7;
    const chat  = this.chatViolationsTotal();
    const comp  = this.complaintsTotal();
    const rev   = this.negativeReviewsTotal();
    const total = chat + comp + rev || 1;
    const pcts  = [chat / total, comp / total, rev / total];
    let used = 0;
    for (let i = 0; i < segmentIndex; i++) used += pcts[i];
    return circumference - pcts[segmentIndex] * circumference + used * circumference;
  }
}
