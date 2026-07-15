import { Injectable, inject, signal, computed } from '@angular/core';
import { AiInsightStats, AiAlert, AiReviewItem, FraudScanResult, ReviewPriority } from '../models/ai.model';
import { AiSecurityService } from './ai-security.service';
import { AiReviewAnalyzerService } from './ai-review-analyzer.service';
import { ApiService } from './api.service';

/**
 * Aggregates AI data from both the security and review analyzers
 * into a unified set of signals consumed by the Dashboard AI Insights widget.
 */
@Injectable({ providedIn: 'root' })
export class AiDashboardService {
  private readonly securityService = inject(AiSecurityService);
  private readonly reviewService   = inject(AiReviewAnalyzerService);
  private readonly api             = inject(ApiService);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly stats       = signal<AiInsightStats | null>(null);
  readonly alerts      = signal<AiAlert[]>([]);
  readonly isLoading   = signal<boolean>(false);
  readonly error       = signal<string | null>(null);
  readonly lastRefresh = signal<Date | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly recentAlerts = computed<AiAlert[]>(() =>
    this.alerts()
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
  );

  readonly hasAlerts = computed<boolean>(() => this.alerts().length > 0);

  // ── Load ──────────────────────────────────────────────────────────────────

  /**
   * Load review analysis data and build dashboard stats/alerts.
   * Security scan is expensive — only run on demand from the Security page.
   * Dashboard uses cached results from the security service signal.
   */
  loadInsights(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.get<any>('/ai/admin/risk-center/summary').subscribe({
      next: (summaryRes) => {
        const summary = summaryRes.data;
        this.stats.set({
          fraudAttemptsToday:    summary.activeAlerts,
          highRiskConversations: summary.highRiskUsersCount,
          criticalComplaints:    summary.activeAlerts,
          positiveReviewPercent: summary.positiveReviewRatio,
          lastScanTime:          summary.lastScanTime,
          systemStatus:          summary.systemStatus,
        });

        // Load active alerts from Risk Center
        this.api.get<any>('/ai/admin/risk-center/alerts').subscribe({
          next: (alertsRes) => {
            const backendAlerts = alertsRes.data || [];
            const mappedAlerts: AiAlert[] = backendAlerts.map((a: any) => ({
              id: a.id,
              type: a.type,
              title: a.title,
              description: a.description,
              timestamp: a.timestamp,
              priority: a.priority,
              relatedPage: a.relatedPage === 'reviews' ? 'reviews' : 'security',
              relatedId: a.relatedId
            }));

            this.alerts.set(mappedAlerts);
            this.lastRefresh.set(new Date());
            this.isLoading.set(false);
          },
          error: (err: Error) => {
            this.error.set(err.message || 'Failed to load AI alerts.');
            this.isLoading.set(false);
          }
        });
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Failed to load AI insights.');
        this.isLoading.set(false);
      }
    });
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private buildStatsFromReviews(items: AiReviewItem[]): void {
    const summary = this.reviewService.buildSummary(items);
    const cachedScan = this.securityService.lastScanResult();

    const positivePercent = summary.total > 0
      ? Math.round((summary.positive / summary.total) * 100)
      : 0;

    this.stats.set({
      fraudAttemptsToday:    cachedScan?.analytics?.fraudToday ?? 0,
      highRiskConversations: cachedScan?.analytics?.highRiskPercent
        ? Math.ceil((cachedScan.analytics.highRiskPercent / 100) * (cachedScan.totalConversationsScanned ?? 0))
        : 0,
      criticalComplaints:    summary.critical,
      positiveReviewPercent: positivePercent,
      lastScanTime:          cachedScan?.scannedAt ?? null,
      systemStatus:          'active',
    });
  }

  private buildAlertsFromReviews(items: AiReviewItem[]): void {
    const newAlerts: AiAlert[] = [];

    items.forEach((item, idx) => {
      const priority = this.reviewService.getEffectivePriority(item);
      if (priority === 'critical' || priority === 'high') {
        // Map violations to alert type
        const violation = item.flaggedViolations?.[0] ?? '';
        let type: AiAlert['type'] = 'critical_complaint';
        let title = 'Critical Complaint Detected';

        if (violation.includes('phone') || violation.includes('contact')) {
          type = 'phone_leak';
          title = '📞 Phone Number Leakage';
        } else if (violation.includes('payment')) {
          type = 'external_payment';
          title = '💳 External Payment Attempt';
        } else if (violation.includes('abuse') || violation.includes('scam')) {
          type = 'fraud';
          title = '🚨 High Risk Fraud';
        } else {
          title = priority === 'critical'
            ? '⚠ Critical Medical Complaint'
            : '⚠ High Priority Issue';
        }

        newAlerts.push({
          id:          item._id,
          type,
          title,
          description: item.auditSummary ?? item.comment?.slice(0, 100) ?? 'Review requires attention.',
          timestamp:   item.createdAt,
          priority,
          relatedPage: 'reviews',
          relatedId:   item._id,
        });
      }
    });

    // Merge with any fraud alerts from cached scan
    const cachedScan = this.securityService.lastScanResult();
    if (cachedScan?.suspiciousCases) {
      cachedScan.suspiciousCases.slice(0, 3).forEach((sc) => {
        newAlerts.unshift({
          id:          sc.id,
          type:        'fraud',
          title:       `🚨 ${sc.violationLabel ?? 'Suspicious Activity'}`,
          description: sc.aiExplanation?.slice(0, 100) ?? 'Suspicious conversation detected.',
          timestamp:   sc.detectedAt,
          priority:    sc.riskLevel === 'high' ? 'critical' : 'high',
          relatedPage: 'security',
          relatedId:   sc.id,
        });
      });
    }

    // Sort by priority weight, newest first
    const weight: Record<ReviewPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    newAlerts.sort((a, b) => (weight[b.priority] ?? 0) - (weight[a.priority] ?? 0));

    this.alerts.set(newAlerts.slice(0, 10));
  }

  getPriorityIcon(type: AiAlert['type']): string {
    switch (type) {
      case 'fraud':            return 'security';
      case 'critical_complaint': return 'warning';
      case 'phone_leak':       return 'phone_disabled';
      case 'external_payment': return 'credit_card_off';
      case 'suspicious':       return 'gpp_bad';
      default:                 return 'notifications';
    }
  }

  getPriorityBadgeClass(priority: ReviewPriority): string {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high':     return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  }

  getPriorityIconBg(priority: ReviewPriority): string {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-600';
      case 'high':     return 'bg-orange-100 text-orange-600';
      case 'medium':   return 'bg-amber-100 text-amber-600';
      case 'low':      return 'bg-emerald-100 text-emerald-600';
    }
  }
}
