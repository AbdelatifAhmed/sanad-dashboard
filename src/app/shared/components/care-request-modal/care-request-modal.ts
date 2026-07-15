import {
  ChangeDetectionStrategy, Component, EventEmitter,
  inject, Input, OnChanges, OnDestroy, Output, signal, SimpleChanges
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  JobPostService, JobPostDetail
} from '../../../core/services/job-post.service';

/**
 * Care Request Details Modal — standalone, no Angular Material dependency.
 *
 * Usage:
 *   <app-care-request-modal
 *     [requestId]="openRequestId()"
 *     (closed)="openRequestId.set(null)"
 *   />
 *
 * Pass a non-null requestId to open; null to close.
 */
@Component({
  selector: 'app-care-request-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, TitleCasePipe],
  templateUrl: './care-request-modal.html',
  styleUrl: './care-request-modal.css',
})
export class CareRequestModalComponent implements OnChanges, OnDestroy {
  private readonly svc     = inject(JobPostService);
  private readonly router  = inject(Router);
  private readonly destroy$ = new Subject<void>();

  @Input() requestId: string | null | undefined = null;
  /** Companion ID of an assigned caregiver (passed from the parent if available) */
  @Input() assignedCaregiverId: string | null | undefined = null;

  @Output() closed = new EventEmitter<void>();

  readonly job     = signal<JobPostDetail | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error   = signal<string | null>(null);

  // ── Active section tab (mobile-friendly sections toggle) ──────────────────
  readonly activeSection = signal<'info' | 'beneficiary' | 'timeline' | 'payment'>('info');

  // ─────────────────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestId']) {
      const id = changes['requestId'].currentValue as string | null;
      id ? this.load(id) : this.reset();
    }
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(id: string): void {
    this.job.set(null);
    this.error.set(null);
    this.loading.set(true);

    this.svc.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.job.set(res.data.job); this.loading.set(false); },
      error: () => {
        this.error.set('Failed to load request details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private reset(): void {
    this.job.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  close(): void { this.reset(); this.closed.emit(); }

  viewCaregiver(): void {
    if (this.assignedCaregiverId) {
      this.router.navigate(['/caregivers', this.assignedCaregiverId]);
      this.close();
    }
  }

  viewBooking(bookingId?: string): void {
    if (bookingId) {
      this.router.navigate(['/bookings', bookingId]);
      this.close();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      open:      'crm-badge-open',
      assigned:  'crm-badge-assigned',
      completed: 'crm-badge-completed',
      canceled:  'crm-badge-cancelled',
    };
    return m[status] ?? 'crm-badge-open';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      open: 'Open', assigned: 'Assigned',
      completed: 'Completed', canceled: 'Cancelled',
    };
    return m[status] ?? status;
  }

  getServiceLabel(type?: string): string {
    const m: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physiotherapy',
      child_care: 'Child Care',
    };
    return type ? (m[type] ?? type) : '—';
  }

  getGenderLabel(g?: string): string {
    if (!g || g === 'any gender') return 'Any';
    return g.charAt(0).toUpperCase() + g.slice(1);
  }

  formatCurrency(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('en-EG');
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getDailyHours(job: JobPostDetail): number {
    try {
      const [sh, sm] = job.schedule.startTime.split(':').map(Number);
      const [eh, em] = job.schedule.endTime.split(':').map(Number);
      return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    } catch { return 0; }
  }

  getWeeklyEst(job: JobPostDetail): number {
    const daily = this.getDailyHours(job);
    const days  = job.schedule.workingDays?.length ?? 0;
    return Math.round(job.budgetPerHour * daily * days);
  }

  /** Build a timeline from the job's status. */
  getTimeline(job: JobPostDetail): { label: string; icon: string; color: string; bg: string; done: boolean; date?: string; note?: string }[] {
    const statusOrder = ['open', 'assigned', 'completed', 'canceled'];
    const idx = statusOrder.indexOf(job.status);

    return [
      {
        label: 'Request Created',
        icon: 'add_circle',
        color: 'var(--color-primary)',
        bg: 'rgba(0,103,103,0.1)',
        done: true,
        date: job.createdAt,
        note: 'Care request was submitted by the family',
      },
      {
        label: 'Pending Review',
        icon: 'pending_actions',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        done: idx >= 0,
        date: idx >= 0 ? job.createdAt : undefined,
      },
      {
        label: 'Caregiver Assigned',
        icon: 'person_check',
        color: 'var(--color-secondary)',
        bg: 'rgba(44,105,86,0.1)',
        done: idx >= 1,
        note: idx < 1 ? 'Waiting for caregiver assignment' : undefined,
      },
      {
        label: 'In Progress',
        icon: 'play_circle',
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.1)',
        done: idx >= 1 && job.status !== 'canceled',
      },
      {
        label: job.status === 'canceled' ? 'Cancelled' : 'Completed',
        icon: job.status === 'canceled' ? 'cancel' : 'task_alt',
        color: job.status === 'canceled' ? 'var(--color-error)' : '#16a34a',
        bg: job.status === 'canceled' ? 'rgba(186,26,26,0.1)' : 'rgba(22,163,74,0.1)',
        done: job.status === 'completed' || job.status === 'canceled',
        date: (job.status === 'completed' || job.status === 'canceled') ? job.updatedAt : undefined,
      },
    ];
  }
}
