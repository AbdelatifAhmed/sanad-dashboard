import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AiDashboardService } from '../../../core/services/ai-dashboard.service';
import { AiInsightStats, AiAlert, ReviewPriority } from '../../../core/models/ai.model';

@Component({
  selector: 'app-ai-insights-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './ai-insights-widget.html',
  styleUrl: './ai-insights-widget.css',
})
export class AiInsightsWidgetComponent implements OnInit, OnDestroy {
  private readonly aiDashboard = inject(AiDashboardService);
  private readonly router      = inject(Router);
  private readonly destroy$    = new Subject<void>();

  // ── Proxy signals from service ─────────────────────────────────────────
  readonly stats      = this.aiDashboard.stats;
  readonly alerts     = this.aiDashboard.recentAlerts;
  readonly isLoading  = this.aiDashboard.isLoading;
  readonly hasAlerts  = this.aiDashboard.hasAlerts;
  readonly error      = this.aiDashboard.error;

  ngOnInit(): void {
    this.aiDashboard.loadInsights();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Navigation ────────────────────────────────────────────────────────
  navigateToAlert(alert: AiAlert): void {
    if (alert.relatedPage === 'security') {
      this.router.navigate(['/security']);
    } else {
      this.router.navigate(['/reviews'], {
        queryParams: { aiReviewId: alert.relatedId }
      });
    }
  }

  openAiCenter(): void {
    this.router.navigate(['/security']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  getPriorityBadgeClass(priority: ReviewPriority): string {
    return this.aiDashboard.getPriorityBadgeClass(priority);
  }

  getPriorityIconBg(priority: ReviewPriority): string {
    return this.aiDashboard.getPriorityIconBg(priority);
  }

  getAlertIcon(type: AiAlert['type']): string {
    return this.aiDashboard.getPriorityIcon(type);
  }

  trackById(_: number, a: AiAlert): string { return a.id; }
}
