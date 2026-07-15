import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, ViewChild
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { AiDashboardService } from '../../../core/services/ai-dashboard.service';
import { AiAlert, ReviewPriority } from '../../../core/models/ai.model';
import { InvestigationModalComponent } from '../investigation-modal/investigation-modal';

@Component({
  selector: 'app-ai-insights-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, RouterLink, InvestigationModalComponent],
  templateUrl: './ai-insights-widget.html',
  styleUrl: './ai-insights-widget.css',
})
export class AiInsightsWidgetComponent implements OnInit, OnDestroy {
  private readonly aiDashboard = inject(AiDashboardService);
  private readonly router      = inject(Router);
  private readonly destroy$    = new Subject<void>();

  @ViewChild(InvestigationModalComponent)
  private readonly investigationModal!: InvestigationModalComponent;

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
  /**
   * Opens the Investigation Details Modal directly on top of the dashboard.
   * The relatedId is the userId whose investigation report will be fetched.
   */
  openAlertInvestigation(alert: AiAlert): void {
    if (alert.relatedId) {
      this.investigationModal.open(alert.relatedId);
    }
  }

  onInvestigationActionCompleted(): void {
    // Refresh the alerts list so the dashboard reflects any changes
    this.aiDashboard.loadInsights();
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
