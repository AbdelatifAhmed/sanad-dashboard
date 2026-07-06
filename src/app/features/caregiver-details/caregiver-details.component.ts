import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';

import {
  CaregiverVerificationService,
  CompanionProfile,
  CompanionWallet,
} from '../../core/services/caregiver-verification.service';
import { AdminBooking } from '../../core/services/bookings.service';
import { AdminReview }  from '../../core/services/reviews.service';
import { ToastNotificationComponent } from '../../shared/components/toast-notification/toast-notification';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { BookingDetailModalComponent } from '../../shared/components/booking-detail-modal/booking-detail-modal';
import { MessageButtonComponent } from '../../shared/components/message-button/message-button';

export type TabId = 'overview' | 'history' | 'reviews' | 'documents' | 'availability' | 'wallet';

@Component({
  selector: 'app-caregiver-details',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterModule,
    ToastNotificationComponent, EmptyStateComponent, BookingDetailModalComponent,
    MessageButtonComponent,
  ],
  templateUrl: './caregiver-details.component.html',
  styleUrl:    './caregiver-details.component.css',
})
export class CaregiverDetailsComponent implements OnInit {
  private readonly route   = inject(ActivatedRoute);
  private readonly router  = inject(Router);
  private readonly svc     = inject(CaregiverVerificationService);
  private readonly san     = inject(DomSanitizer);

  // ── Profile ────────────────────────────────────────────────────────────────
  readonly companion    = signal<CompanionProfile | null>(null);
  readonly isLoading    = signal<boolean>(true);
  readonly error        = signal<string | null>(null);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  readonly activeTab    = signal<TabId>('overview');
  readonly tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview',      label: 'Overview',        icon: 'person'           },
    { id: 'history',       label: 'Service History', icon: 'history'          },
    { id: 'reviews',       label: 'Reviews',         icon: 'star'             },
    { id: 'documents',     label: 'Documents',       icon: 'folder_open'      },
    { id: 'availability',  label: 'Availability',    icon: 'calendar_month'   },
    { id: 'wallet',        label: 'Wallet',          icon: 'account_balance_wallet' },
  ];

  // ── Bookings / Service History ────────────────────────────────────────────
  readonly bookings        = signal<AdminBooking[]>([]);
  readonly bookingsLoading = signal<boolean>(false);
  readonly bookingsTotal   = signal<number>(0);
  readonly bookingsPage    = signal<number>(1);
  readonly bookingsPages   = signal<number>(1);
  selectedBookingId        = signal<string | null>(null);

  // ── Reviews ───────────────────────────────────────────────────────────────
  readonly reviews        = signal<AdminReview[]>([]);
  readonly reviewsLoading = signal<boolean>(false);
  readonly reviewsTotal   = signal<number>(0);
  readonly reviewsPage    = signal<number>(1);
  readonly reviewsPages   = signal<number>(1);
  readonly reviewsAvg     = signal<number>(0);

  // ── Wallet ────────────────────────────────────────────────────────────────
  readonly wallet        = signal<CompanionWallet | null>(null);
  readonly walletLoading = signal<boolean>(false);
  readonly walletError   = signal<boolean>(false);

  // ── Modals ────────────────────────────────────────────────────────────────
  readonly activeModal      = signal<'approve' | 'reject' | 'request_info' | 'doc_preview' | null>(null);
  readonly isSubmitting     = signal<boolean>(false);
  rejectionReason           = '';
  requestInfoMessage        = '';
  requestInfoCategory       = '';

  // ── Doc preview ───────────────────────────────────────────────────────────
  readonly previewTitle    = signal<string>('');
  readonly previewUrl      = signal<string>('');
  readonly previewType     = signal<'image' | 'pdf'>('image');
  readonly previewSafeUrl  = computed<SafeResourceUrl>(() =>
    this.san.bypassSecurityTrustResourceUrl(this.previewUrl())
  );

  // ── Toast ─────────────────────────────────────────────────────────────────
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Computed stats ────────────────────────────────────────────────────────
  readonly ratingStars = computed(() => {
    const r = this.companion()?.rating ?? 0;
    return Array.from({ length: 5 }, (_, i) => i < Math.round(r) ? 'full' : 'empty');
  });

  readonly verificationChecks = computed(() => {
    const comp = this.companion();
    if (!comp) return [];
    const checks = [
      { label: 'National ID',      done: !!(comp.documents?.nationalIdCard?.url &&  comp.documents.nationalIdCard.url !== 'placeholder_national_id.jpg'), icon: 'badge' },
      { label: 'Criminal Record',  done: !!(comp.documents?.criminalRecord?.url && comp.documents.criminalRecord.url !== 'placeholder_criminal_record.jpg'), icon: 'description' },
      { label: 'Background Check', done: true, icon: 'security' },
    ];
    if (comp.companionType === 'specialized') {
      checks.push({ label: 'Syndicate License', done: !!comp.documents?.syndicateCard?.url, icon: 'clinical_notes' });
    }
    if (comp.documents?.Certificates?.length) {
      checks.push({ label: `Certificates (${comp.documents.Certificates.length})`, done: true, icon: 'workspace_premium' });
    }
    return checks;
  });

  readonly verificationProgress = computed(() => {
    const checks = this.verificationChecks();
    if (!checks.length) return 0;
    return Math.round((checks.filter(c => c.done).length / checks.length) * 100);
  });

  readonly ratingDistribution = computed(() => {
    const reviews = this.reviews();
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) dist[star]++;
    });
    const max = Math.max(...Object.values(dist), 1);
    return [5, 4, 3, 2, 1].map(star => ({
      star,
      count: dist[star],
      pct: Math.round((dist[star] / Math.max(reviews.length, 1)) * 100),
      barPct: Math.round((dist[star] / max) * 100),
    }));
  });

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set('No caregiver ID provided.'); this.isLoading.set(false); return; }
    this.loadProfile(id);
  }

  // ── Load profile + wallet — resets all stale state first ─────────────────
  private loadProfile(id: string): void {
    // ── Reset every signal so a previous caregiver's data never leaks ────────
    this.companion.set(null);
    this.wallet.set(null);
    this.bookings.set([]);
    this.bookingsTotal.set(0);
    this.bookingsPage.set(1);
    this.bookingsPages.set(1);
    this.reviews.set([]);
    this.reviewsTotal.set(0);
    this.reviewsPage.set(1);
    this.reviewsPages.set(1);
    this.reviewsAvg.set(0);
    this.selectedBookingId.set(null);
    // ─────────────────────────────────────────────────────────────────────────

    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      profile: this.svc.getCompanionDetails(id),
      wallet:  this.svc.getCompanionWallet(id),
    }).subscribe({
      next: ({ profile, wallet }) => {
        this.companion.set(profile.data.companion);
        this.wallet.set(wallet.data ?? null);
        this.isLoading.set(false);
        // Load bookings and reviews scoped to this companion
        this.loadBookings(1);
        this.loadReviews(1);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('Failed to load caregiver profile. Please try again.');
      },
    });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  // ── Load bookings for THIS caregiver only ────────────────────────────────
  // companion.userId._id === booking.companionId (both are User ObjectIds)
  loadBookings(page: number): void {
    const comp = this.companion();
    if (!comp) return;

    // The booking schema stores companionId as a User._id reference.
    // companion.userId._id is exactly that User._id.
    const companionUserId = comp.userId._id;

    this.bookingsLoading.set(true);
    this.svc.getBookingsByCompanion(companionUserId, { page, limit: 8 }).subscribe({
      next: (res) => {
        this.bookings.set(res.data?.bookings ?? []);
        this.bookingsTotal.set(res.pagination?.total ?? 0);
        this.bookingsPage.set(res.pagination?.page ?? 1);
        this.bookingsPages.set(res.pagination?.totalPages ?? 1);
        this.bookingsLoading.set(false);
      },
      error: () => {
        this.bookings.set([]);
        this.bookingsLoading.set(false);
      },
    });
  }

  // ── Load reviews ──────────────────────────────────────────────────────────
  loadReviews(page: number): void {
    const comp = this.companion();
    if (!comp) return;
    this.reviewsLoading.set(true);
    this.svc.getReviewsByCompanion(comp._id, { page, limit: 10 }).subscribe({
      next: (res) => {
        this.reviews.set(res.reviews ?? []);
        this.reviewsTotal.set(res.pagination?.total ?? 0);
        this.reviewsPage.set(res.pagination?.page ?? 1);
        this.reviewsPages.set(res.pagination?.totalPages ?? 1);
        this.reviewsAvg.set(res.stats?.avgRating ?? 0);
        this.reviewsLoading.set(false);
      },
      error: () => { this.reviewsLoading.set(false); },
    });
  }

  // ── Doc preview ───────────────────────────────────────────────────────────
  openDoc(title: string, url: string): void {
    this.previewTitle.set(title);
    this.previewUrl.set(url);
    this.previewType.set(url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    this.activeModal.set('doc_preview');
  }

  // ── Verification actions ───────────────────────────────────────────────────
  openModal(type: 'approve' | 'reject' | 'request_info'): void {
    this.rejectionReason = '';
    this.requestInfoMessage = '';
    this.requestInfoCategory = '';
    this.isSubmitting.set(false);
    this.activeModal.set(type);
  }

  closeModal(): void { this.activeModal.set(null); }

  approveCaregiver(): void {
    const comp = this.companion();
    if (!comp || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.svc.updateVerificationStatus(comp._id, 'verified').subscribe({
      next: () => {
        this.showToast('Caregiver approved!', 'success');
        this.closeModal();
        this.refreshProfile();
      },
      error: () => { this.isSubmitting.set(false); this.showToast('Failed to approve. Try again.', 'error'); },
    });
  }

  rejectCaregiver(): void {
    const comp = this.companion();
    if (!comp || !this.rejectionReason.trim() || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.svc.updateVerificationStatus(comp._id, 'rejected', { rejectionReason: this.rejectionReason }).subscribe({
      next: () => {
        this.showToast('Application rejected.', 'success');
        this.closeModal();
        this.refreshProfile();
      },
      error: () => { this.isSubmitting.set(false); this.showToast('Failed to reject. Try again.', 'error'); },
    });
  }

  requestMoreInfo(): void {
    const comp = this.companion();
    if (!comp || !this.requestInfoMessage.trim() || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    const msg = this.requestInfoCategory
      ? `[${this.requestInfoCategory}] ${this.requestInfoMessage}`
      : this.requestInfoMessage;
    this.svc.updateVerificationStatus(comp._id, 'under_review', { message: msg }).subscribe({
      next: () => {
        this.showToast('Information request sent.', 'success');
        this.closeModal();
        this.refreshProfile();
      },
      error: () => { this.isSubmitting.set(false); this.showToast('Failed to send. Try again.', 'error'); },
    });
  }

  private refreshProfile(): void {
    const comp = this.companion();
    if (!comp) return;
    this.svc.getCompanionDetails(comp._id).subscribe({
      next: (res) => { this.companion.set(res.data.companion); this.isSubmitting.set(false); },
      error: () => { this.isSubmitting.set(false); },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goBack(): void {
    // Navigate back to directory; the URL query params are preserved in the
    // browser history so Angular's back() restores filters automatically.
    this.router.navigate(['/caregivers']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getSpecialization(spec?: string): string {
    const map: Record<string, string> = {
      nursing: 'Registered Nurse', physiotherapy: 'Physiotherapist',
      companionship_companion: 'Companion', dementia: 'Dementia Specialist',
    };
    return spec ? (map[spec] ?? 'General Caregiver') : 'General Caregiver';
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      verified:     'status-verified',
      rejected:     'status-rejected',
      under_review: 'status-review',
      pending:      'status-pending',
    };
    return m[status] ?? 'status-pending';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      verified: 'Verified', rejected: 'Rejected',
      under_review: 'Needs Info', pending: 'Pending',
    };
    return m[status] ?? 'Pending';
  }

  getBookingStatusClass(status: string): string {
    const m: Record<string, string> = {
      pending: 'booking-pending', pending_payment: 'booking-pending',
      approved: 'booking-approved', active: 'booking-active',
      completed: 'booking-completed', cancelled: 'booking-cancelled',
    };
    return m[status] ?? 'booking-pending';
  }

  getBookingStatusLabel(status: string): string {
    const m: Record<string, string> = {
      pending: 'Pending', pending_payment: 'Awaiting Payment',
      approved: 'Approved', active: 'Active',
      completed: 'Completed', cancelled: 'Cancelled',
    };
    return m[status] ?? status;
  }

  getPaymentStatusClass(status: string): string {
    const m: Record<string, string> = { paid: 'pay-paid', unpaid: 'pay-unpaid', refunded: 'pay-refunded' };
    return m[status] ?? 'pay-unpaid';
  }

  getServiceTypeLabel(type?: string): string {
    const map: Record<string, string> = {
      elderly_care: 'Elderly Care', home_nursing: 'Home Nursing',
      companionship: 'Companionship', physical_therapy: 'Physical Therapy',
      child_care: 'Child Care',
    };
    return type ? (map[type] ?? type) : '—';
  }

  formatCurrency(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('en-EG');
  }

  safeRating(v: number | undefined | null): string {
    return (v ?? 0).toFixed(1);
  }

  safeNum(v: number | undefined | null, fallback: number = 0): number {
    return v ?? fallback;
  }

  getCompletedDocsCount(): number {
    const comp = this.companion();
    if (!comp) return 0;
    let n = 0;
    const d = comp.documents;
    if (d?.nationalIdCard?.url && d.nationalIdCard.url !== 'placeholder_national_id.jpg') n++;
    if (d?.criminalRecord?.url && d.criminalRecord.url !== 'placeholder_criminal_record.jpg') n++;
    if (d?.syndicateCard?.url) n++;
    if (d?.Certificates?.length) n += d.Certificates.length;
    return n;
  }

  getTotalDocsCount(): number {
    const comp = this.companion();
    if (!comp) return 0;
    let n = 2;
    if (comp.companionType === 'specialized') n++;
    if (comp.documents?.Certificates?.length) n += comp.documents.Certificates.length;
    return n;
  }

  getStarArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
