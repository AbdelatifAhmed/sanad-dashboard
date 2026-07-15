import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { StatsService } from '../../core/services/stats.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card';
import { FamilyManagementService, FamilyListEntry } from '../../core/services/family-management.service';
import { CaregiverVerificationService, CompanionProfile } from '../../core/services/caregiver-verification.service';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { ReportsService, ReportsData, ServiceDistributionItem } from '../../core/services/reports.service';
import { AiInsightsWidgetComponent } from '../../shared/components/ai-insights-widget/ai-insights-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, StatCardComponent, ChartCardComponent, RouterLink, ErrorBannerComponent, StatusBadgeComponent, EmptyStateComponent, AiInsightsWidgetComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  statsService = inject(StatsService);
  private readonly router           = inject(Router);
  private readonly familyService    = inject(FamilyManagementService);
  private readonly caregiverService = inject(CaregiverVerificationService);
  private readonly reportsService   = inject(ReportsService);

  // ── KPI & Chart Signals ────────────────────────────────────────────────────
  kpis                 = this.statsService.kpis;
  trendsData           = this.statsService.trendsData;
  familiesPercentage   = this.statsService.familiesPercentage;
  caregiversPercentage = this.statsService.caregiversPercentage;
  totalUsersCount      = this.statsService.totalUsersCount;

  // ── Loading & Error Signals ────────────────────────────────────────────────
  isLoading      = this.statsService.isLoading;
  pendingLoading = this.statsService.pendingLoading;
  statsError     = this.statsService.statsError;

  // ── List Signals ───────────────────────────────────────────────────────────
  recentActivities     = this.statsService.recentActivities;
  pendingVerifications = this.statsService.pendingVerifications;

  // ── Recent Users Tab State ─────────────────────────────────────────────────
  readonly activeTab        = signal<'families' | 'caregivers'>('families');
  readonly recentFamilies   = signal<FamilyListEntry[]>([]);
  readonly recentCaregivers = signal<CompanionProfile[]>([]);
  readonly familiesLoading  = signal<boolean>(false);
  readonly caregiversLoading = signal<boolean>(false);
  readonly familiesError    = signal<string | null>(null);
  readonly caregiversError  = signal<string | null>(null);

  // ── Growth Trends & Service Distribution ──────────────────────────────────
  private readonly reportsData         = signal<ReportsData | null>(null);
  readonly reportsLoading              = signal<boolean>(false);
  readonly growthTrends                = computed(() => this.reportsData()?.growthTrends ?? null);
  readonly serviceDistribution         = computed<ServiceDistributionItem[]>(() => this.reportsData()?.serviceDistribution ?? []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.statsService.loadAll();
    this.loadRecentFamilies();
    this.loadRecentCaregivers();
    this.loadReports();
  }

  // ── Reports Loader ─────────────────────────────────────────────────────────
  loadReports(): void {
    this.reportsLoading.set(true);
    this.reportsService.getReports().subscribe({
      next: (res) => {
        this.reportsData.set(res.data);
        this.reportsLoading.set(false);
      },
      error: () => {
        this.reportsLoading.set(false);
      }
    });
  }

  // ── Chart Helpers (identical to Reports page) ──────────────────────────────
  buildLinePath(points: number[], width = 480, height = 220, padY = 20): string {
    if (!points.length) return '';
    const maxV = Math.max(...points, 1);
    const step = width / Math.max(points.length - 1, 1);
    return points
      .map((v, i) => {
        const x = i * step;
        const y = padY + (1 - v / maxV) * (height - padY * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  buildDots(points: number[], width = 480, height = 220, padY = 20): { x: number; y: number; v: number }[] {
    if (!points.length) return [];
    const maxV = Math.max(...points, 1);
    const step = width / Math.max(points.length - 1, 1);
    return points.map((v, i) => ({
      x: i * step,
      y: padY + (1 - v / maxV) * (height - padY * 2),
      v,
    }));
  }

  getServiceColor(index: number): string {
    const colors = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-amber-500', 'bg-blue-500'];
    return colors[index % colors.length];
  }

  // ── Recent Users Loaders ───────────────────────────────────────────────────
  loadRecentFamilies(): void {
    this.familiesLoading.set(true);
    this.familiesError.set(null);
    this.familyService.getFamilies({ sortBy: 'createdAt', sortOrder: 'desc', limit: 10, page: 1 }).subscribe({
      next: (res) => {
        this.recentFamilies.set(res.data?.families ?? []);
        this.familiesLoading.set(false);
      },
      error: () => {
        this.familiesError.set('Failed to load recent families.');
        this.familiesLoading.set(false);
      }
    });
  }

  loadRecentCaregivers(): void {
    this.caregiversLoading.set(true);
    this.caregiversError.set(null);
    this.caregiverService.getCompanions({ sortBy: 'createdAt', sortOrder: 'desc', limit: 10, page: 1 }).subscribe({
      next: (res) => {
        this.recentCaregivers.set(res.data?.companions ?? []);
        this.caregiversLoading.set(false);
      },
      error: () => {
        this.caregiversError.set('Failed to load recent caregivers.');
        this.caregiversLoading.set(false);
      }
    });
  }

  setTab(tab: 'families' | 'caregivers'): void {
    this.activeTab.set(tab);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  approve(candidateId: string): void {
    this.statsService.approveVerification(candidateId);
  }

  reject(candidateId: string): void {
    this.statsService.rejectVerification(candidateId);
  }

  viewFamily(id: string): void {
    this.router.navigate(['/families', id]);
  }

  viewCaregiver(companionId?: string): void {
    if (companionId) {
      this.router.navigate(['/caregivers', companionId]);
    } else {
      this.router.navigate(['/caregivers']);
    }
  }

  viewUser(userId: string, userRole: string): void {
    if (userRole === 'family') {
      this.router.navigate(['/families', userId]);
    } else {
      this.router.navigate(['/caregivers', userId]);
    }
  }

  retryLoad(): void {
    this.statsService.loadAll();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getSpecializationLabel(spec: string): string {
    switch (spec) {
      case 'nursing':                  return 'Nursing';
      case 'physiotherapy':            return 'Physiotherapy';
      case 'companionship_companion':  return 'Companionship';
      case 'dementia':                 return 'Dementia Care';
      case 'none':
      default:                         return 'General';
    }
  }
}
