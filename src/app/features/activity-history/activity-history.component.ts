import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  ActivityService,
  ActivityEvent,
  ActivityCategory,
  ActivityRole,
  ActivityDateRange,
  ActivitySort,
} from '../../core/services/activity.service';
import { ErrorBannerComponent }       from '../../shared/components/error-banner/error-banner';
import { LoadingSpinnerComponent }    from '../../shared/components/loading-spinner/loading-spinner';
import { EmptyStateComponent }        from '../../shared/components/empty-state/empty-state';
import { ToastService } from '../../core/services/toast.service';

// ── Date group label helper ────────────────────────────────────────────────────
function getGroupLabel(date: Date): string {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7)  return 'This Week';
  if (diffDays <= 30) return 'This Month';
  return 'Older';
}

export interface ActivityGroup {
  label:      string;
  activities: ActivityEvent[];
}

@Component({
  selector: 'app-activity-history',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ErrorBannerComponent, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './activity-history.component.html',
  styleUrl:    './activity-history.component.css',
})
export class ActivityHistoryComponent implements OnInit, OnDestroy {
  private readonly activityService = inject(ActivityService);
  private readonly router          = inject(Router);
  private readonly toastService    = inject(ToastService);
  private readonly destroy$        = new Subject<void>();
  private readonly searchSubject$  = new Subject<string>();

  // ── Filter state ──────────────────────────────────────────────────────────
  readonly searchQuery = signal<string>('');
  readonly category    = signal<ActivityCategory>('all');
  readonly role        = signal<ActivityRole>('all');
  readonly dateRange   = signal<ActivityDateRange>('all');
  readonly sort        = signal<ActivitySort>('desc');
  readonly page        = signal<number>(1);
  readonly limit       = 20;

  // ── Data state ────────────────────────────────────────────────────────────
  readonly activities  = signal<ActivityEvent[]>([]);
  readonly total       = signal<number>(0);
  readonly totalPages  = signal<number>(1);
  readonly isLoading   = signal<boolean>(false);
  readonly error       = signal<string | null>(null);

  /** Booking ID whose detail modal is currently open; null = modal closed. */
  readonly activeBookingId = signal<string | null>(null);
  // ── Computed groups ───────────────────────────────────────────────────────
  readonly groups = computed<ActivityGroup[]>(() => {
    const grouped = new Map<string, ActivityEvent[]>();
    const ORDER   = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    for (const act of this.activities()) {
      const label = getGroupLabel(new Date(act.timestamp));
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label)!.push(act);
    }

    return ORDER
      .filter(label => grouped.has(label))
      .map(label => ({ label, activities: grouped.get(label)! }));
  });

  // ── Filter option lists ────────────────────────────────────────────────────
  readonly categoryOptions: { value: ActivityCategory; label: string }[] = [
    { value: 'all',          label: 'All Categories' },
    { value: 'registration', label: 'Registration'   },
    { value: 'verification', label: 'Verification'   },
    { value: 'booking',      label: 'Bookings'        },
    { value: 'profile',      label: 'Profile Updates' },
  ];

  readonly roleOptions: { value: ActivityRole; label: string }[] = [
    { value: 'all',       label: 'All Roles'  },
    { value: 'family',    label: 'Families'   },
    { value: 'companion', label: 'Caregivers' },
  ];

  readonly dateOptions: { value: ActivityDateRange; label: string }[] = [
    { value: 'all',     label: 'All Time'    },
    { value: 'today',   label: 'Today'       },
    { value: 'week',    label: 'Last 7 Days' },
    { value: 'month',   label: 'Last 30 Days'},
    { value: '3months', label: 'Last 90 Days'},
  ];

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Debounce the search input to avoid hammering the API
    this.searchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.activityService.getActivities({
      category:  this.category(),
      role:      this.role(),
      dateRange: this.dateRange(),
      sort:      this.sort(),
      search:    this.searchQuery() || undefined,
      page:      this.page(),
      limit:     this.limit,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.activities.set(res.data?.activities ?? []);
        this.total.set(res.pagination?.total ?? 0);
        this.totalPages.set(res.pagination?.totalPages ?? 1);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Activity load error:', err);
        this.error.set(
          err?.status === 401
            ? 'Your session has expired. Please log in again.'
            : 'Failed to load activity history. Please try again.'
        );
        this.isLoading.set(false);
      },
    });
  }

  // ── Filter handlers ───────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject$.next(value);
  }

  setCategory(value: ActivityCategory): void {
    this.category.set(value);
    this.page.set(1);
    this.load();
  }

  setRole(value: ActivityRole): void {
    this.role.set(value);
    this.page.set(1);
    this.load();
  }

  setDateRange(value: ActivityDateRange): void {
    this.dateRange.set(value);
    this.page.set(1);
    this.load();
  }

  toggleSort(): void {
    this.sort.set(this.sort() === 'desc' ? 'asc' : 'desc');
    this.page.set(1);
    this.load();
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
      this.load();
    }
  }

  // ── Activity-type → action mapping ───────────────────────────────────────
  /**
   * Activity types that are profile/account-related.
   * These get a "View Profile" button that navigates directly to the user's profile.
   */
  private readonly PROFILE_TYPES = new Set([
    'caregiver_registered',
    'family_registered',
    'caregiver_approved',
    'caregiver_rejected',
    'verification_requested',
    'documents_resubmitted',
    'profile_updated',
  ]);

  /** Returns true when the activity should show "View Profile" instead of "View Details". */
  isProfileAction(act: ActivityEvent): boolean {
    return this.PROFILE_TYPES.has(act.type);
  }

  getActionLabel(act: ActivityEvent): string {
    return this.isProfileAction(act) ? 'View Profile' : 'View Details';
  }

  getActionIcon(act: ActivityEvent): string {
    return this.isProfileAction(act) ? 'person' : 'open_in_new';
  }

  // ── Navigation / detail ───────────────────────────────────────────────────
  viewDetails(act: ActivityEvent): void {
    const entityId = act.entityId || act.relatedId;

    // ── Profile actions: navigate directly to user's profile ─────────────
    if (this.isProfileAction(act)) {
      if (!entityId) {
        this.toastService.error('This record is no longer available.');
        return;
      }

      if (act.relatedModel === 'Companion' || act.actorRole === 'companion') {
        this.router.navigate(['/caregivers', entityId]);
      } else {
        this.router.navigate(['/families', entityId]);
      }
      return;
    }

    // ── Booking actions: navigate to booking details page ────────────────
    if (act.relatedModel === 'Booking') {
      if (!entityId) {
        this.toastService.error('This record is no longer available.');
        return;
      }
      this.router.navigate(['/bookings', entityId]);
      return;
    }

    // ── Fallback: use the backend-provided navigateTo URL ─────────────────
    if (act.navigateTo) {
      this.router.navigateByUrl(act.navigateTo);
    } else {
      this.toastService.error('This record is no longer available.');
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const now   = Date.now();
    const then  = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1)  return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)  return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)  return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'family':    return 'Family';
      case 'companion': return 'Caregiver';
      case 'admin':     return 'Admin';
      default:          return role;
    }
  }

  getRoleBadge(role: string): string {
    switch (role) {
      case 'family':    return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'companion': return 'bg-tertiary/10 text-tertiary border-tertiary/20';
      case 'admin':     return 'bg-primary/10 text-primary border-primary/20';
      default:          return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }

  trackByGroup(_: number, g: ActivityGroup): string { return g.label; }
  trackByAct(_: number, a: ActivityEvent): string   { return a.id; }
}
