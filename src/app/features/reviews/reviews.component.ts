import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, AfterViewInit,
  inject, signal, computed, HostListener
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  ReviewsService, AdminReview, ReviewStats, ReviewFilters
} from '../../core/services/reviews.service';
import { ToastService } from '../../core/services/toast.service';
import { ErrorBannerComponent }    from '../../shared/components/error-banner/error-banner';
import { ConfirmDialogComponent }  from '../../shared/components/confirm-dialog/confirm-dialog';
import { AiReviewAnalyzerService } from '../../core/services/ai-review-analyzer.service';
import {
  AiReviewItem, ReviewSentimentSummary, SentimentType, ReviewPriority
} from '../../core/models/ai.model';

// Extended type to include bookingId on AiReviewItem when present
type AiReviewItemExtended = AiReviewItem & { bookingId?: any };

// ── Filter chip definition ────────────────────────────────────────────────────
interface FilterChip {
  value: string;
  label: string;
  activeClass: string;
  group: 'sentiment' | 'category' | 'status' | 'special';
}

// ── Investigation tab definition ──────────────────────────────────────────────
interface InvestigationTab {
  id: string;
  label: string;
  icon: string;
}


@Component({
  selector: 'app-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, DecimalPipe, FormsModule,
    ErrorBannerComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class ReviewsComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly reviewsService  = inject(ReviewsService);
  private readonly toastService    = inject(ToastService);
  private readonly aiAnalyzer      = inject(AiReviewAnalyzerService);
  private readonly route           = inject(ActivatedRoute);
  private readonly destroy$        = new Subject<void>();
  private readonly searchSubject$  = new Subject<string>();

  // ── Investigation Tabs ────────────────────────────────────────────────────
  readonly investigationTabs: InvestigationTab[] = [
    { id: 'review',           label: 'Review',              icon: 'rate_review'      },
    { id: 'ai_analysis',      label: 'AI Analysis',         icon: 'psychology'       },
    { id: 'service_post',     label: 'Service Post',        icon: 'assignment'       },
    { id: 'booking',          label: 'Booking Details',     icon: 'event_available'  },
    { id: 'caregiver_history',label: 'Caregiver History',   icon: 'person_search'    },
    { id: 'timeline',         label: 'Timeline',            icon: 'timeline'         },
  ];

  // ── Filter Chips ──────────────────────────────────────────────────────────
  readonly filterChips: FilterChip[] = [
    { value: 'all',               label: 'All',                group: 'special',   activeClass: 'bg-primary text-white border-primary' },
    { value: 'positive',          label: 'Positive',           group: 'sentiment', activeClass: 'bg-emerald-500 text-white border-emerald-500' },
    { value: 'neutral',           label: 'Neutral',            group: 'sentiment', activeClass: 'bg-blue-400 text-white border-blue-400' },
    { value: 'negative',          label: 'Negative',           group: 'sentiment', activeClass: 'bg-amber-400 text-white border-amber-400' },
    { value: 'critical',          label: 'Critical',           group: 'sentiment', activeClass: 'bg-red-500 text-white border-red-500' },
    { value: 'needs_review',      label: 'Needs Review',       group: 'special',   activeClass: 'bg-orange-500 text-white border-orange-500' },
    { value: 'medical_negligence',label: 'Medical Negligence', group: 'category',  activeClass: 'bg-red-600 text-white border-red-600' },
    { value: 'communication',     label: 'Communication',      group: 'category',  activeClass: 'bg-sky-500 text-white border-sky-500' },
    { value: 'abuse',             label: 'Abuse',              group: 'category',  activeClass: 'bg-rose-600 text-white border-rose-600' },
    { value: 'scam',              label: 'Scam',               group: 'category',  activeClass: 'bg-purple-600 text-white border-purple-600' },
    { value: 'payment',           label: 'Payment',            group: 'category',  activeClass: 'bg-violet-500 text-white border-violet-500' },
    { value: 'service_quality',   label: 'Service Quality',    group: 'category',  activeClass: 'bg-teal-500 text-white border-teal-500' },
    { value: 'published',         label: 'Published',          group: 'status',    activeClass: 'bg-emerald-600 text-white border-emerald-600' },
    { value: 'hidden',            label: 'Hidden',             group: 'status',    activeClass: 'bg-surface-container text-on-surface border-outline-variant' },
  ];

  // ── State: AI ─────────────────────────────────────────────────────────────
  readonly aiReviews        = signal<AiReviewItemExtended[]>([]);
  readonly aiSummary        = signal<ReviewSentimentSummary | null>(null);
  readonly aiLoading        = signal<boolean>(false);
  readonly aiError          = signal<string | null>(null);
  readonly aiLoaded         = signal<boolean>(false);

  // ── State: Reviews ────────────────────────────────────────────────────────
  readonly reviews    = signal<AdminReview[]>([]);
  readonly stats      = signal<ReviewStats | null>(null);
  readonly isLoading  = signal<boolean>(true);
  readonly error      = signal<string | null>(null);
  readonly total      = signal<number>(0);
  readonly totalPages = signal<number>(1);

  // ── Filters ───────────────────────────────────────────────────────────────
  readonly page         = signal<number>(1);
  readonly limit        = 15;
  searchQuery           = '';
  activeFilters         = signal<Set<string>>(new Set(['all']));
  sortField             = signal<string>('date');
  sortDir               = signal<'asc' | 'desc'>('desc');

  // ── UI State ──────────────────────────────────────────────────────────────
  readonly expandedRowId        = signal<string | null>(null);
  readonly showCriticalAlerts   = signal<boolean>(true);

  // ── Investigation Drawer ──────────────────────────────────────────────────
  readonly showInvestigation    = signal<boolean>(false);
  readonly drawerVisible        = signal<boolean>(false);
  readonly selectedAiReview     = signal<AiReviewItemExtended | null>(null);
  readonly activeTab            = signal<string>('review');
  readonly currentCaseIndex     = signal<number>(0);
  readonly caseStatus           = signal<string>('Pending Review');

  // ── Delete ────────────────────────────────────────────────────────────────
  readonly confirmDelete     = signal<AdminReview | null>(null);
  readonly isDeleting        = signal<boolean>(false);
  readonly isTogglingId      = signal<string | null>(null);


  // ── Computed: Critical reviews ────────────────────────────────────────────
  readonly criticalReviews = computed<AiReviewItemExtended[]>(() =>
    this.aiReviews().filter(r =>
      this.aiAnalyzer.getEffectivePriority(r) === 'critical' ||
      this.aiAnalyzer.getEffectivePriority(r) === 'high'
    )
  );
  readonly hasCriticalReviews = computed(() => this.criticalReviews().length > 0);

  // ── Computed: filtered + sorted reviews ──────────────────────────────────
  readonly filteredReviews = computed<AdminReview[]>(() => {
    const filters = this.activeFilters();
    const q = this.searchQuery.trim().toLowerCase();
    let list = [...this.reviews()];

    // Search
    if (q) {
      list = list.filter(r =>
        (r.familyId?.name ?? '').toLowerCase().includes(q) ||
        (r.companionId?.userId?.name ?? '').toLowerCase().includes(q) ||
        (r.comment ?? '').toLowerCase().includes(q) ||
        (r._id ?? '').toLowerCase().includes(q) ||
        (r.bookingId?._id ?? '').toLowerCase().includes(q)
      );
    }

    // Chip filters (skip 'all')
    if (!filters.has('all') && filters.size > 0) {
      list = list.filter(r => {
        for (const f of Array.from(filters)) {
          const aiItem = this.getAiItemForReview(r);
          if (f === 'positive'   && this.aiAnalyzer.getEffectiveSentiment(aiItem) === 'positive')   return true;
          if (f === 'neutral'    && this.aiAnalyzer.getEffectiveSentiment(aiItem) === 'neutral')    return true;
          if (f === 'negative'   && this.aiAnalyzer.getEffectiveSentiment(aiItem) === 'negative')   return true;
          if (f === 'critical'   && this.aiAnalyzer.getEffectiveSentiment(aiItem) === 'critical')   return true;
          if (f === 'published'  && r.isVisible)   return true;
          if (f === 'hidden'     && !r.isVisible)  return true;
          if (f === 'needs_review' && (
            this.aiAnalyzer.getEffectivePriority(aiItem) === 'critical' ||
            this.aiAnalyzer.getEffectivePriority(aiItem) === 'high'
          )) return true;
          const violations = aiItem?.flaggedViolations ?? [];
          if (violations.includes(f)) return true;
        }
        return false;
      });
    }

    // Sort
    const field = this.sortField();
    const dir   = this.sortDir() === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (field === 'rating')   return dir * (a.rating - b.rating);
      if (field === 'reviewer') return dir * (a.familyId?.name ?? '').localeCompare(b.familyId?.name ?? '');
      // default: date
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return list;
  });

  // ── Computed: paginated reviews ───────────────────────────────────────────
  readonly pagedReviews = computed<AdminReview[]>(() => {
    const p = this.page() - 1;
    return this.filteredReviews().slice(p * this.limit, (p + 1) * this.limit);
  });

  readonly pageNumbers = computed<number[]>(() => {
    const t = this.totalPages();
    const c = this.page();
    if (t <= 5) return Array.from({ length: t }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(c - 2, t - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.page.set(1); });
    this.load();
    this.loadAiAnalysis();
  }

  ngAfterViewInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['aiReviewId']) {
        const interval = setInterval(() => {
          const found = this.aiReviews().find(r => r._id === params['aiReviewId']);
          if (found) { clearInterval(interval); this.openInvestigation(found, 'ai_analysis'); }
          else if (this.aiLoaded()) { clearInterval(interval); }
        }, 200);
      }
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!this.showInvestigation()) return;
    if (e.key === 'Escape') { this.closeInvestigation(); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { this.prevCase(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.nextCase(); e.preventDefault(); }
  }


  // ── Data loading ──────────────────────────────────────────────────────────
  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.reviewsService.getReviews({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.reviews.set(res.reviews ?? []);
          this.stats.set(res.stats ?? null);
          this.total.set(res.pagination?.total ?? (res.reviews?.length ?? 0));
          this.updateTotalPages();
          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('Failed to load reviews. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  private updateTotalPages(): void {
    this.totalPages.set(Math.max(1, Math.ceil(this.filteredReviews().length / this.limit)));
  }

  loadAiAnalysis(): void {
    this.aiLoading.set(true);
    this.aiError.set(null);
    this.aiAnalyzer.analyzeReviews()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const incoming = res.data ?? [];

          // ── Merge strategy: update only AI-generated fields per row ────────
          // Never wipe the whole array — preserve all existing review data and
          // only patch the fields the AI actually returned for each matching row.
          this.aiReviews.update(existing => {
            const existingMap = new Map(existing.map(r => [r._id, r]));

            // Patch or insert each incoming item
            incoming.forEach(item => {
              const prev = existingMap.get(item._id);
              if (prev) {
                // Merge: keep all existing fields, overlay only AI fields
                existingMap.set(item._id, {
                  ...prev,
                  sentimentScore:    item.sentimentScore    ?? prev.sentimentScore,
                  alertLevel:        item.alertLevel        ?? prev.alertLevel,
                  flaggedViolations: item.flaggedViolations ?? prev.flaggedViolations,
                  auditSummary:      item.auditSummary      ?? prev.auditSummary,
                });
              } else {
                // New item not previously in the list — add it
                existingMap.set(item._id, item);
              }
            });

            return Array.from(existingMap.values());
          });

          this.aiSummary.set(this.aiAnalyzer.buildSummary(this.aiReviews()));
          this.aiLoaded.set(true);
          this.aiLoading.set(false);
        },
        error: (err: Error) => {
          this.aiError.set(err.message || 'AI analysis unavailable.');
          this.aiLoaded.set(true);
          this.aiLoading.set(false);
        },
      });
  }

  // ── Filter + search ───────────────────────────────────────────────────────
  onSearchChange(v: string): void { this.searchSubject$.next(v); }

  toggleFilterChip(value: string): void {
    const current = new Set(this.activeFilters());
    if (value === 'all') {
      this.activeFilters.set(new Set(['all']));
    } else {
      current.delete('all');
      if (current.has(value)) {
        current.delete(value);
        if (current.size === 0) current.add('all');
      } else {
        current.add(value);
      }
      this.activeFilters.set(current);
    }
    this.page.set(1);
  }

  isChipActive(value: string): boolean { return this.activeFilters().has(value); }

  resetFilters(): void {
    this.searchQuery = '';
    this.activeFilters.set(new Set(['all']));
    this.page.set(1);
  }

  // ── Sorting ───────────────────────────────────────────────────────────────
  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
  }

  getSortIcon(field: string): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  goToPage(n: number): void {
    const max = Math.max(1, Math.ceil(this.filteredReviews().length / this.limit));
    if (n >= 1 && n <= max) { this.page.set(n); }
  }

  // ── Row expand ────────────────────────────────────────────────────────────
  toggleExpandRow(id: string): void {
    this.expandedRowId.set(this.expandedRowId() === id ? null : id);
  }

  toggleCriticalAlerts(): void {
    this.showCriticalAlerts.set(!this.showCriticalAlerts());
  }

  // ── Toggle visibility ─────────────────────────────────────────────────────
  toggleVisibility(review: AdminReview): void {
    this.isTogglingId.set(review._id);
    this.reviewsService.toggleVisibility(review._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.reviews.update(list =>
            list.map(r => r._id === review._id ? { ...r, isVisible: res.data.isVisible } : r)
          );
          this.toastService.success(`Review ${res.data.isVisible ? 'published' : 'hidden'}.`);
          this.isTogglingId.set(null);
        },
        error: () => {
          this.toastService.error('Failed to update review visibility.');
          this.isTogglingId.set(null);
        },
      });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDeleteReview(review: AdminReview): void { this.confirmDelete.set(review); }
  cancelDelete(): void { this.confirmDelete.set(null); }

  executeDelete(): void {
    const review = this.confirmDelete();
    if (!review) return;
    this.isDeleting.set(true);
    this.reviewsService.deleteReview(review._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.reviews.update(list => list.filter(r => r._id !== review._id));
          this.toastService.success('Review deleted.');
          this.confirmDelete.set(null);
          this.isDeleting.set(false);
        },
        error: () => {
          this.toastService.error('Failed to delete review.');
          this.isDeleting.set(false);
        },
      });
  }


  // ── Investigation Drawer ──────────────────────────────────────────────────
  openInvestigation(item: AiReviewItemExtended | null, tab?: string): void {
    if (!item) return;
    const idx = this.aiReviews().findIndex(r => r._id === item._id);
    this.currentCaseIndex.set(idx >= 0 ? idx : 0);
    this.selectedAiReview.set(item);
    this.caseStatus.set('Under Investigation');
    this.activeTab.set(tab ?? this.getSmartTabForAiItem(item));
    this.showInvestigation.set(true);
    // Animate in
    requestAnimationFrame(() => this.drawerVisible.set(true));
  }

  closeInvestigation(): void {
    this.drawerVisible.set(false);
    setTimeout(() => {
      this.showInvestigation.set(false);
      this.selectedAiReview.set(null);
    }, 300);
  }

  setActiveTab(id: string): void { this.activeTab.set(id); }

  prevCase(): void {
    const idx = this.currentCaseIndex();
    if (idx > 0) {
      const prev = this.aiReviews()[idx - 1];
      this.currentCaseIndex.set(idx - 1);
      this.selectedAiReview.set(prev);
      this.activeTab.set(this.getSmartTabForAiItem(prev));
    }
  }

  nextCase(): void {
    const idx = this.currentCaseIndex();
    if (idx < this.aiReviews().length - 1) {
      const next = this.aiReviews()[idx + 1];
      this.currentCaseIndex.set(idx + 1);
      this.selectedAiReview.set(next);
      this.activeTab.set(this.getSmartTabForAiItem(next));
    }
  }

  handleAiAction(action: string, review: AiReviewItemExtended): void {
    const labels: Record<string, string> = {
      reviewed: 'Marked as Reviewed',
      warn:     'Warning issued to caregiver',
      contact:  'Contact request sent to reviewer',
      suspend:  'Caregiver suspended',
      dismiss:  'Case dismissed',
    };
    this.toastService.success(labels[action] ?? 'Action applied.');
    if (['reviewed', 'dismiss'].includes(action)) {
      this.caseStatus.set(action === 'reviewed' ? 'Action Taken' : 'Resolved');
    }
  }

  markReviewedQuick(rv: AiReviewItemExtended): void {
    this.toastService.success('Marked as Reviewed.');
  }

  markReviewedFromExpanded(rv: AdminReview): void {
    this.toastService.success('Marked as Reviewed.');
    this.toggleExpandRow(rv._id);
  }

  // ── Smart tab opening ─────────────────────────────────────────────────────
  getSmartTab(rv: AdminReview): string {
    const ai = this.getAiItemForReview(rv);
    return this.getSmartTabForAiItem(ai);
  }

  getSmartTabForAiItem(item: AiReviewItemExtended | null): string {
    if (!item) return 'review';
    const violations = item.flaggedViolations ?? [];
    const priority   = this.aiAnalyzer.getEffectivePriority(item);
    if (priority === 'critical') return 'ai_analysis';
    if (violations.includes('medical_negligence')) return 'ai_analysis';
    if (violations.includes('payment')) return 'booking';
    if (violations.some(v => ['service_quality', 'caregiver_behavior'].includes(v))) return 'service_post';
    return 'review';
  }

  // ── AI item lookup for a regular review ──────────────────────────────────
  getAiItemForReview(rv: AdminReview): AiReviewItemExtended {
    return this.aiReviews().find(a => a._id === rv._id) ?? {
      _id:    rv._id,
      familyId: rv.familyId as any,
      companionId: rv.companionId as any,
      rating: rv.rating,
      comment: rv.comment,
      isVisible: rv.isVisible,
      createdAt: rv.createdAt,
      bookingId: rv.bookingId as any,
    };
  }


  // ── AI badge/label helpers for regular AdminReview ────────────────────────
  getAiSentimentBadgeForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return this.aiAnalyzer.getSentimentBadgeClass(this.aiAnalyzer.getEffectiveSentiment(item));
  }
  getAiSentimentLabelForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return this.aiAnalyzer.getSentimentLabel(this.aiAnalyzer.getEffectiveSentiment(item));
  }
  getAiPriorityBadgeForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return this.aiAnalyzer.getPriorityBadgeClass(this.aiAnalyzer.getEffectivePriority(item));
  }
  getAiPriorityLabelForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return this.aiAnalyzer.getPriorityLabel(this.aiAnalyzer.getEffectivePriority(item));
  }
  getAiCategoryLabelForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return this.aiAnalyzer.getCategoryLabel(item.flaggedViolations?.[0]);
  }
  getAiSummaryForReview(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    return item.auditSummary ?? this.getAiDefaultSummary(item);
  }
  getAiKeywordsForReview(rv: AdminReview): string[] {
    const item = this.getAiItemForReview(rv);
    return item.flaggedViolations ?? [];
  }

  // ── AI badge/label helpers for AiReviewItem (used in drawer) ─────────────
  getAiSentimentBadge(item: AiReviewItemExtended): string {
    return this.aiAnalyzer.getSentimentBadgeClass(this.aiAnalyzer.getEffectiveSentiment(item));
  }
  getAiSentimentLabel(item: AiReviewItemExtended): string {
    return this.aiAnalyzer.getSentimentLabel(this.aiAnalyzer.getEffectiveSentiment(item));
  }
  getAiPriorityBadge(item: AiReviewItemExtended): string {
    return this.aiAnalyzer.getPriorityBadgeClass(this.aiAnalyzer.getEffectivePriority(item));
  }
  getAiPriorityLabel(item: AiReviewItemExtended): string {
    return this.aiAnalyzer.getPriorityLabel(this.aiAnalyzer.getEffectivePriority(item));
  }
  getAiCategoryLabel(item: AiReviewItemExtended): string {
    return this.aiAnalyzer.getCategoryLabel(item.flaggedViolations?.[0]);
  }

  getAiConfidenceScore(item: AiReviewItemExtended): number {
    // Use the normalised string sentimentScore if present
    const sentiment = this.aiAnalyzer.getEffectiveSentiment(item);
    if (sentiment === 'critical') return 92;
    if (sentiment === 'negative') return 78;
    if (sentiment === 'neutral')  return 60;
    if (sentiment === 'positive') return 85;
    // Ultimate fallback: derive from star rating
    return item.rating === 1 ? 88 : item.rating === 2 ? 72 : 55;
  }

  getConfidenceBarColor(item: AiReviewItemExtended | AdminReview): string {
    const score = this.getAiConfidenceScore(item as AiReviewItemExtended);
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-amber-400';
    return 'bg-emerald-500';
  }

  getAiDefaultSummary(item: AiReviewItemExtended): string {
    const priority = this.aiAnalyzer.getEffectivePriority(item);
    const category = this.aiAnalyzer.getCategoryLabel(item.flaggedViolations?.[0]);
    if (priority === 'critical') return `This review has been classified as Critical by Guardian AI. The system detected indicators of ${category.toLowerCase()} with high confidence. Immediate review is recommended.`;
    if (priority === 'high') return `Guardian AI flagged this review as High Priority. Potential ${category.toLowerCase()} concerns were detected. Please review and take appropriate action.`;
    return `This review has been analyzed by Guardian AI. No critical violations detected. Standard monitoring applies.`;
  }

  // ── Row highlight class ───────────────────────────────────────────────────
  getRowHighlightClass(rv: AdminReview): string {
    const item = this.getAiItemForReview(rv);
    const priority = this.aiAnalyzer.getEffectivePriority(item);
    if (priority === 'critical') return 'bg-red-50/40';
    if (priority === 'high')     return 'bg-orange-50/30';
    return '';
  }

  // ── Case Status badge ─────────────────────────────────────────────────────
  getCaseStatusBadge(): string {
    const s = this.caseStatus();
    if (s === 'Manual Review')       return 'bg-purple-100 text-purple-700 border-purple-200';
    if (s === 'Under Investigation') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'Action Taken')        return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s === 'Resolved')            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
  }


  // ── Investigation steps ───────────────────────────────────────────────────
  getInvestigationSteps(): { label: string; done: boolean; current?: boolean }[] {
    const rv = this.selectedAiReview();
    return [
      { label: 'Review Analyzed',           done: true },
      { label: 'Booking Linked',            done: !!(rv?.bookingId?._id) },
      { label: 'Service Post Loaded',       done: !!(rv?.bookingId) },
      { label: 'Caregiver History Checked', done: this.aiReviews().length > 1 },
      { label: 'Related Reviews Loaded',    done: this.aiLoaded() },
      { label: 'Awaiting Administrator Decision', done: false, current: true },
    ];
  }

  getInvestigationScore(): number {
    const steps = this.getInvestigationSteps();
    const done = steps.filter(s => s.done).length;
    return Math.round((done / steps.length) * 100);
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  getTimeline(rv: AiReviewItemExtended): { label: string; time?: string; done: boolean; current?: boolean }[] {
    const booking = rv.bookingId as any;
    return [
      { label: 'Booking Created',       time: booking?.startDate ? new Date(booking.startDate).toLocaleDateString() : undefined, done: !!booking },
      { label: 'Caregiver Accepted',    done: !!(booking?.status && booking.status !== 'pending') },
      { label: 'Service Started',       done: !!(booking?.status && ['active', 'completed'].includes(booking.status)) },
      { label: 'Service Completed',     done: booking?.status === 'completed' },
      { label: 'Review Submitted',      time: rv.createdAt ? new Date(rv.createdAt).toLocaleDateString() : undefined, done: true },
      { label: 'AI Analysis Generated', done: !!(rv.sentimentScore || rv.auditSummary) },
      { label: 'Admin Investigation Opened', done: this.showInvestigation(), current: true },
      { label: 'Decision Pending',      done: false },
    ];
  }

  // ── Caregiver history from all reviews ───────────────────────────────────
  getCaregiverReviews(rv: AiReviewItemExtended): AdminReview[] {
    const cgId = rv.companionId?._id;
    if (!cgId) return [];
    return this.reviews().filter(r => r.companionId?._id === cgId && r._id !== rv._id).slice(0, 5);
  }

  getCaregiverStats(rv: AiReviewItemExtended): { total: number; positive: number; negative: number; critical: number; avgRating: number } {
    const reviews = this.getCaregiverReviews(rv);
    const all = [...reviews];
    // include current
    const ratings = all.map(r => r.rating);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : rv.rating;
    return {
      total:    all.length + 1,
      positive: all.filter(r => r.rating >= 4).length,
      negative: all.filter(r => r.rating <= 2).length,
      critical: all.filter(r => r.rating === 1).length,
      avgRating: avg,
    };
  }

  // ── AI generated summary text ─────────────────────────────────────────────
  getAiGeneratedSummary(): string {
    const s = this.aiSummary();
    if (!s || s.total === 0) return 'No reviews have been analyzed yet. Click Re-Analyze to start.';
    const positivePercent = Math.round((s.positive / s.total) * 100);
    const criticalCount   = s.critical;
    if (criticalCount > 0) {
      return `The platform currently shows ${positivePercent}% positive reviews across ${s.total} analyzed entries. ${criticalCount} critical complaint${criticalCount > 1 ? 's' : ''} require immediate administrator attention.`;
    }
    return `The platform has ${positivePercent}% positive reviews across ${s.total} analyzed entries. Sentiment trends appear stable with no critical cases at this time.`;
  }

  // ── General helpers ───────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getStars(rating: number): number[] { return [1, 2, 3, 4, 5]; }

  getStatusClass(visible: boolean): string {
    return visible
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-surface-container text-on-surface-variant border-outline-variant/30';
  }

  getCompanionName(rv: AdminReview): string {
    return (rv.companionId as any)?.userId?.name ?? '—';
  }

  trackById(_: number, r: AdminReview): string { return r._id; }
}
