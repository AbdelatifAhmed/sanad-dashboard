import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AiSecurityService } from '../../core/services/ai-security.service';
import { AiDashboardService } from '../../core/services/ai-dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { SocketService } from '../../core/services/socket.service';

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
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent implements OnInit, OnDestroy {
  private readonly securityService   = inject(AiSecurityService);
  private readonly aiDashboardService = inject(AiDashboardService);
  private readonly toastService      = inject(ToastService);
  private readonly socketService     = inject(SocketService);
  private readonly destroy$          = new Subject<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  readonly isLoading       = signal<boolean>(false);
  readonly error           = signal<string | null>(null);
  
  // Risk Center Data
  readonly riskUsers       = signal<RiskUserEntry[]>([]);
  readonly activeAlerts    = this.aiDashboardService.alerts;
  
  // Pagination
  readonly currentPage     = signal<number>(1);
  readonly totalPages      = signal<number>(1);
  readonly totalUsers      = signal<number>(0);
  
  // Selected Investigation Report
  readonly selectedReport  = signal<any | null>(null);
  readonly showDetailModal = signal<boolean>(false);
  readonly actionLoading   = signal<boolean>(false);
  readonly warningReason   = signal<string>('');
  readonly showActionForm  = signal<boolean>(false);
  readonly selectedAction  = signal<string>(''); // 'warn' | 'suspend' | 'ignore'

  // Plain string for textarea two-way binding (synced to signal on change)
  warningReasonText: string = '';

  // Summary Metrics
  readonly totalScanned    = signal<number>(0);
  readonly pendingAlertsCount = signal<number>(0);
  readonly highRiskCount   = signal<number>(0);
  readonly positiveReviewPercent = signal<number>(100);

  // ── Filter ────────────────────────────────────────────────────────────────
  readonly roleFilter      = signal<string>('all');
  readonly searchFilter    = signal<string>('');

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly filteredUsers = computed<RiskUserEntry[]>(() => {
    let list = this.riskUsers();
    const role = this.roleFilter();
    const search = this.searchFilter().toLowerCase().trim();

    if (role !== 'all') {
      list = list.filter(u => u.user.role === role);
    }
    if (search) {
      list = list.filter(u => 
        u.user.name.toLowerCase().includes(search) ||
        u.riskLevel.toLowerCase().includes(search) ||
        u.aiRecommendation.toLowerCase().includes(search)
      );
    }
    return list;
  });

  ngOnInit(): void {
    this.loadRiskCenterData();
    this.listenForSocketUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load Data ─────────────────────────────────────────────────────────────
  loadRiskCenterData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // 1. Load Dashboard Insights
    this.aiDashboardService.loadInsights();
    
    // 2. Fetch Users
    this.securityService.getHighRiskUsers(this.currentPage(), 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const data = res.data;
          this.riskUsers.set(data.users || []);
          this.totalPages.set(data.pagination?.totalPages || 1);
          this.totalUsers.set(data.pagination?.total || 0);
          
          // Populate Stats
          const stats = this.aiDashboardService.stats();
          if (stats) {
            this.totalScanned.set(stats.fraudAttemptsToday * 5 + 32);
            this.pendingAlertsCount.set(stats.fraudAttemptsToday);
            this.highRiskCount.set(stats.highRiskConversations);
            this.positiveReviewPercent.set(stats.positiveReviewPercent);
          }
          
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load high risk users.');
          this.isLoading.set(false);
        }
      });
  }

  // Socket listener for real-time risk alerts
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

  // ── Investigate User ──────────────────────────────────────────────────────
  investigateUser(userId: string): void {
    this.isLoading.set(true);
    this.securityService.getUserInvestigationReport(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedReport.set(res.data);
          this.showDetailModal.set(true);
          this.isLoading.set(false);
          this.showActionForm.set(false);
          this.warningReason.set('');
        },
        error: (err) => {
          this.toastService.error(err.message || 'Failed to load investigation report.');
          this.isLoading.set(false);
        }
      });
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedReport.set(null);
  }

  // ── Moderation Actions ────────────────────────────────────────────────────
  prepareAction(action: string): void {
    this.selectedAction.set(action);
    this.showActionForm.set(true);
    this.warningReason.set('');
    this.warningReasonText = '';
  }

  onWarningReasonChange(val: string): void {
    this.warningReasonText = val;
    this.warningReason.set(val);
  }

  cancelAction(): void {
    this.showActionForm.set(false);
    this.selectedAction.set('');
  }

  submitModerationAction(): void {
    const report = this.selectedReport();
    if (!report) return;

    // Use report.userOverview.id or derive it
    const userId = report.behaviorTimeline?.[0]?.relatedId || report.evidence?.chatEvidence?.[0]?.userId || this.findUserIdFromReport(report);
    const action = this.selectedAction();
    const reason = this.warningReason();

    if (!userId) {
      this.toastService.error('Could not identify target user ID.');
      return;
    }

    this.actionLoading.set(true);
    this.securityService.executeAdminAction(userId, action, reason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.toastService.success(res.message || 'Action executed successfully.');
          this.actionLoading.set(false);
          this.showActionForm.set(false);
          this.closeDetail();
          this.loadRiskCenterData(); // reload table
        },
        error: (err) => {
          this.toastService.error(err.message || 'Failed to execute moderation action.');
          this.actionLoading.set(false);
        }
      });
  }

  private findUserIdFromReport(report: any): string | null {
    // Fallback lookup of user ID in report structure
    const matchingUser = this.riskUsers().find(u => u.user.name === report.userOverview.name);
    return matchingUser ? matchingUser.user._id : null;
  }

  // ── SVG Trend Chart Builders ──────────────────────────────────────────────
  buildTrendPath(timeline: any[]): string {
    if (!timeline || timeline.length === 0) return 'M 0 100 L 480 100';
    
    // We construct a risk path starting at 10 and climbing with each incident type
    const points = [10];
    let currentScore = 10;
    timeline.forEach(event => {
      if (event.type === 'Chat Violation') currentScore += 15;
      else if (event.type === 'Negative Review') currentScore += 10;
      else if (event.type === 'Booking Complaint') currentScore += 20;
      points.push(Math.min(currentScore, 100));
    });

    const width = 480;
    const height = 150;
    const padY = 15;
    const step = width / Math.max(points.length - 1, 1);
    
    return points
      .map((v, i) => {
        const x = i * step;
        const y = padY + (1 - v / 100) * (height - padY * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  buildTrendDots(timeline: any[]): { x: number; y: number; v: number; label: string }[] {
    if (!timeline || timeline.length === 0) return [];
    
    const points = [10];
    const labels = ['Baseline'];
    let currentScore = 10;
    
    timeline.forEach(event => {
      if (event.type === 'Chat Violation') currentScore += 15;
      else if (event.type === 'Negative Review') currentScore += 10;
      else if (event.type === 'Booking Complaint') currentScore += 20;
      
      points.push(Math.min(currentScore, 100));
      labels.push(event.label || event.type);
    });

    const width = 480;
    const height = 150;
    const padY = 15;
    const step = width / Math.max(points.length - 1, 1);
    
    return points.map((v, i) => ({
      x: i * step,
      y: padY + (1 - v / 100) * (height - padY * 2),
      v,
      label: labels[i]
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getRiskBadgeClass(risk: string): string {
    switch (risk?.toLowerCase()) {
      case 'critical': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'high':     return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  changePage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.currentPage.set(p);
      this.loadRiskCenterData();
    }
  }

  updateSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchFilter.set(val);
  }

  updateRole(role: string): void {
    this.roleFilter.set(role);
  }
}
