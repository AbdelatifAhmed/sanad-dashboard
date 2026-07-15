import {
  ChangeDetectionStrategy, Component, OnDestroy, inject, signal, computed, output
} from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AiSecurityService } from '../../../core/services/ai-security.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Reusable Investigation Details Modal.
 *
 * Usage:
 *   <app-investigation-modal #modal></app-investigation-modal>
 *
 * Open programmatically:
 *   modal.open(userId);
 *
 * Or inject InvestigationModalService for a fully programmatic approach.
 *
 * Events:
 *   (actionCompleted) — emitted after a successful moderation action so the
 *                       parent can refresh its data (alerts list, stats, etc.)
 */
@Component({
  selector: 'app-investigation-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, UpperCasePipe],
  templateUrl: './investigation-modal.html',
  styleUrl: './investigation-modal.css',
})
export class InvestigationModalComponent implements OnDestroy {
  private readonly securityService = inject(AiSecurityService);
  private readonly toastService    = inject(ToastService);
  private readonly destroy$        = new Subject<void>();

  // ── Output events ─────────────────────────────────────────────────────────
  /** Fired after a moderation action completes so the parent can refresh */
  readonly actionCompleted = output<void>();

  // ── Modal state ───────────────────────────────────────────────────────────
  readonly isVisible      = signal<boolean>(false);
  readonly isLoading      = signal<boolean>(false);
  readonly loadError      = signal<string | null>(null);
  readonly selectedReport = signal<any | null>(null);
  readonly activeModalTab = signal<string>('overview');

  // ── Moderation state ──────────────────────────────────────────────────────
  readonly actionLoading  = signal<boolean>(false);
  readonly showActionForm = signal<boolean>(false);
  readonly selectedAction = signal<string>('');
  readonly warningReason  = signal<string>('');
  warningReasonText: string = '';

  /** The userId whose report is currently loaded — needed for submitModerationAction */
  private _currentUserId: string | null = null;

  // ── Static config ─────────────────────────────────────────────────────────
  readonly modalTabs = [
    { key: 'overview',    label: 'Overview' },
    { key: 'timeline',    label: 'Timeline' },
    { key: 'ai-analysis', label: 'AI Analysis' },
  ];

  // ── Public API ────────────────────────────────────────────────────────────

  /** Open the modal and fetch the investigation report for userId */
  open(userId: string): void {
    this._currentUserId = userId;
    this.isVisible.set(true);
    this.isLoading.set(true);
    this.loadError.set(null);
    this.selectedReport.set(null);
    this.activeModalTab.set('overview');
    this.showActionForm.set(false);
    this.warningReason.set('');
    this.warningReasonText = '';

    this.securityService.getUserInvestigationReport(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedReport.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.loadError.set(err.message || 'Failed to load investigation report.');
          this.isLoading.set(false);
        }
      });
  }

  close(): void {
    this.isVisible.set(false);
    this.selectedReport.set(null);
    this.loadError.set(null);
    this._currentUserId = null;
    this.showActionForm.set(false);
    this.selectedAction.set('');
  }

  // ── Moderation actions ────────────────────────────────────────────────────

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
    const userId = this._currentUserId;
    if (!userId) {
      this.toastService.error('Could not identify target user ID.');
      return;
    }

    this.actionLoading.set(true);
    this.securityService.executeAdminAction(userId, this.selectedAction(), this.warningReason())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.toastService.success(res.message || 'Action executed successfully.');
          this.actionLoading.set(false);
          this.showActionForm.set(false);
          this.close();
          this.actionCompleted.emit();
        },
        error: (err) => {
          this.toastService.error(err.message || 'Failed to execute action.');
          this.actionLoading.set(false);
        }
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── SVG chart builders ────────────────────────────────────────────────────

  buildTrendPath(timeline: any[]): string {
    const pts = this._buildTimelinePts(timeline);
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  buildTrendDots(timeline: any[]): { x: number; y: number; v: number }[] {
    return this._buildTimelinePts(timeline);
  }

  private _buildTimelinePts(timeline: any[]): { x: number; y: number; v: number }[] {
    if (!timeline?.length) return [];
    const points = [10];
    let score = 10;
    timeline.forEach(e => {
      if (e.type === 'Chat Violation')         score += 15;
      else if (e.type === 'Negative Review')   score += 10;
      else if (e.type === 'Booking Complaint') score += 20;
      points.push(Math.min(score, 100));
    });
    const w = 480, padY = 15, h = 115;
    const step = points.length > 1 ? w / (points.length - 1) : w;
    return points.map((v, i) => ({ x: i * step, y: padY + (1 - v / 100) * h, v }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
