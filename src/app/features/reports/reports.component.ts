import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ReportsService,
  ReportsData,
  CaregiverPerformanceItem,
  ServiceDistributionItem,
  ReportPeriod,
  PERIOD_OPTIONS,
  PeriodOption,
} from '../../core/services/reports.service';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner';
import { EmptyStateComponent }  from '../../shared/components/empty-state/empty-state';
import { EgyptMapComponent }    from '../../shared/components/egypt-map/egypt-map.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ErrorBannerComponent, EmptyStateComponent, EgyptMapComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private readonly reportsService = inject(ReportsService);
  private readonly router         = inject(Router);

  // ── State ─────────────────────────────────────────────────────────────────
  readonly isLoading   = signal<boolean>(true);
  readonly isExporting = signal<boolean>(false);
  readonly error       = signal<string | null>(null);
  readonly data        = signal<ReportsData | null>(null);

  // ── Period selection ──────────────────────────────────────────────────────
  readonly periodOptions       = PERIOD_OPTIONS;
  readonly selectedPeriod      = signal<ReportPeriod>('last30');
  readonly showPeriodDropdown  = signal<boolean>(false);

  // ── Computed helpers ──────────────────────────────────────────────────────
  readonly kpis = computed(() => this.data()?.kpis ?? null);

  readonly serviceDistribution = computed<ServiceDistributionItem[]>(() =>
    this.data()?.serviceDistribution ?? []
  );

  readonly caregiverPerformance = computed<CaregiverPerformanceItem[]>(() =>
    this.data()?.caregiverPerformance ?? []
  );

  readonly geographicInsights = computed(() =>
    this.data()?.geographicInsights ?? []
  );

  readonly growthTrends = computed(() => this.data()?.growthTrends ?? null);

  // ── Chart path + dot builders (inline SVG line chart — no external deps) ──

  /**
   * Build an SVG path string for the given data points.
   * Each dataset is scaled independently so a dataset with small values
   * still fills the chart area rather than hugging the bottom.
   */
  buildLinePath(points: number[], width = 460, height = 200, padY = 20): string {
    if (!points.length) return '';
    const maxV = Math.max(...points, 1);
    const minV = Math.min(...points, 0);
    const range = maxV - minV || 1;
    const step = width / Math.max(points.length - 1, 1);
    return points
      .map((v, i) => {
        const x = i * step;
        const y = padY + (1 - (v - minV) / range) * (height - padY * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  /** Returns array of {x, y, v} for placing circle markers on each data point */
  buildDots(points: number[], width = 460, height = 200, padY = 20): { x: number; y: number; v: number }[] {
    if (!points.length) return [];
    const maxV = Math.max(...points, 1);
    const minV = Math.min(...points, 0);
    const range = maxV - minV || 1;
    const step = width / Math.max(points.length - 1, 1);
    return points.map((v, i) => ({
      x: i * step,
      y: padY + (1 - (v - minV) / range) * (height - padY * 2),
      v,
    }));
  }

  /** True if at least one count is non-zero */
  hasNonZero(points: { count: number }[]): boolean {
    return points.some(p => p.count > 0);
  }

  /** True if both bookings and users arrays are all-zero */
  isGrowthEmpty(gt: { bookings: { count: number }[]; users: { count: number }[] }): boolean {
    return !this.hasNonZero(gt.bookings) && !this.hasNonZero(gt.users);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
    // Close dropdown when clicking outside
    document.addEventListener('click', this.handleClickOutside);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleClickOutside);
  }

  private handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (!target.closest('.period-dropdown-wrapper')) {
      this.showPeriodDropdown.set(false);
    }
  };

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.reportsService.getReports(this.selectedPeriod()).subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Reports load error:', err);
        this.error.set('Failed to load analytics data. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  // ── Period selection ──────────────────────────────────────────────────────
  selectPeriod(period: ReportPeriod): void {
    this.selectedPeriod.set(period);
    this.showPeriodDropdown.set(false);
    this.load();
  }

  togglePeriodDropdown(): void {
    this.showPeriodDropdown.update(open => !open);
  }

  getSelectedLabel(): string {
    return this.periodOptions.find(p => p.value === this.selectedPeriod())?.label ?? 'Last 30 Days';
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  viewAllCaregivers(): void {
    this.router.navigate(['/caregivers']);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportReport(): void {
    const d = this.data();
    if (!d || this.isExporting()) return;
    this.isExporting.set(true);

    try {
      const now       = new Date();
      const dateStr   = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr   = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const periodLbl = this.getSelectedLabel();
      const fileName  = `sanad-report-${periodLbl.replace(/\s+/g,'-').toLowerCase()}-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.csv`;

      const rows: string[][] = [];

      // ── Header ──────────────────────────────────────────────────────────
      rows.push(['Sanad Admin Portal — Report Export']);
      rows.push([`Period: ${periodLbl}`]);
      rows.push([`Generated: ${dateStr} at ${timeStr}`]);
      rows.push([]);

      // ── KPI Summary ─────────────────────────────────────────────────────
      rows.push(['SUMMARY STATISTICS']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Revenue',          this.formatCurrency(d.kpis.totalRevenue)]);
      rows.push(['Average Booking Value',  this.formatCurrency(d.kpis.avgBookingValue)]);
      rows.push(['Outstanding Payments',   this.formatCurrency(d.kpis.outstandingPayments)]);
      rows.push(['Pending Payments Count', String(d.kpis.pendingPaymentsCount)]);
      rows.push(['Completed Bookings',     String(d.kpis.completedBookings)]);
      rows.push(['Active Bookings',        String(d.kpis.activeBookings)]);
      rows.push(['Pending Bookings',       String(d.kpis.pendingBookings)]);
      rows.push(['Total Bookings',         String(d.kpis.totalBookings)]);
      rows.push(['New Families (period)',  String(d.kpis.newFamilies)]);
      rows.push(['New Caregivers (period)',String(d.kpis.newCaregivers)]);
      rows.push(['Total Families',         String(d.kpis.totalFamilies)]);
      rows.push(['Total Caregivers',       String(d.kpis.totalCaregivers)]);
      rows.push([]);

      // ── Caregiver Performance ────────────────────────────────────────────
      rows.push(['CAREGIVER PERFORMANCE']);
      rows.push(['Name', 'Specialization', 'Total Hours', 'Rating', 'Reviews', 'Reliability', 'Status']);
      for (const cg of d.caregiverPerformance) {
        rows.push([
          cg.name,
          this.getSpecializationLabel(cg.specialization),
          `${cg.totalWorkHours}h`,
          cg.rating.toFixed(1),
          String(cg.reviewCount),
          cg.reliability,
          cg.status,
        ]);
      }
      rows.push([]);

      // ── Service Distribution ─────────────────────────────────────────────
      rows.push(['SERVICE DISTRIBUTION']);
      rows.push(['Service Type', 'Count', 'Percentage']);
      for (const svc of d.serviceDistribution) {
        rows.push([svc.label, String(svc.count), `${svc.percentage}%`]);
      }
      rows.push([]);

      // ── Geographic Insights ──────────────────────────────────────────────
      if (d.geographicInsights.length > 0) {
        rows.push(['GEOGRAPHIC INSIGHTS']);
        rows.push(['City', 'Bookings']);
        for (const geo of d.geographicInsights) {
          rows.push([geo.city, String(geo.bookings)]);
        }
        rows.push([]);
      }

      // ── Growth Trends ────────────────────────────────────────────────────
      if (d.growthTrends) {
        rows.push(['GROWTH TRENDS']);
        rows.push(['Week', 'New Bookings', 'New Users']);
        const bkLen = d.growthTrends.bookings.length;
        const uLen  = d.growthTrends.users.length;
        const len   = Math.max(bkLen, uLen);
        for (let i = 0; i < len; i++) {
          const bk = d.growthTrends.bookings[i];
          const us = d.growthTrends.users[i];
          rows.push([
            bk?.week ?? us?.week ?? `Week ${i + 1}`,
            bk ? String(bk.count) : '0',
            us ? String(us.count) : '0',
          ]);
        }
      }

      // ── Serialize to CSV ──────────────────────────────────────────────────
      const csvContent = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      this.isExporting.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** English EGP formatting: EGP 4,700 */
  formatCurrency(value: number): string {
    if (value == null || isNaN(value)) return 'EGP 0';
    const rounded = Math.round(value);
    return 'EGP ' + rounded.toLocaleString('en-US');
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getSpecializationLabel(spec: string): string {
    const map: Record<string, string> = {
      nursing:                 'Nursing Support',
      physiotherapy:           'Physical Therapy',
      companionship_companion: 'Companionship',
      dementia:                'Dementia Care',
      none:                    'General Care',
    };
    return map[spec] ?? spec;
  }

  getReliabilityClass(rel: string): string {
    switch (rel) {
      case 'Exemplary': return 'bg-primary/10 text-primary border-primary/20';
      case 'High':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Medium':    return 'bg-amber-100 text-amber-700 border-amber-200';
      default:          return 'bg-surface-container text-on-surface-variant border-outline-variant/20';
    }
  }

  getServiceColor(index: number): string {
    const colors = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-amber-500', 'bg-blue-500'];
    return colors[index % colors.length];
  }

  /** trackBy helpers */
  trackByService(_: number, s: ServiceDistributionItem): string { return s.type; }
  trackByCaregiver(_: number, c: CaregiverPerformanceItem): string { return c._id; }
  trackByCity(_: number, g: { city: string }): string { return g.city; }
}
