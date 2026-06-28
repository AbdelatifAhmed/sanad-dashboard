import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { 
  CaregiverVerificationService, 
  CompanionProfile, 
  CompanionsResponse 
} from '../../core/services/caregiver-verification.service';

@Component({
  selector: 'app-caregiver-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './caregiver-verification.html',
  styleUrl: './caregiver-verification.css'
})
export class CaregiverVerificationComponent implements OnInit {
  private readonly verificationService = inject(CaregiverVerificationService);
  private readonly sanitizer = inject(DomSanitizer);

  // ─── Query State Signals ──────────────────────────────────────────────────
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('pending'); // default to pending to show queue
  readonly sortBy = signal<string>('createdAt');
  readonly sortOrder = signal<string>('desc');
  readonly page = signal<number>(1);
  readonly limit = signal<number>(10);

  // ─── Data Signals ─────────────────────────────────────────────────────────
  readonly companions = signal<CompanionProfile[]>([]);
  readonly selectedCompanion = signal<CompanionProfile | null>(null);
  readonly totalResults = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // ─── UI Modal Signals ─────────────────────────────────────────────────────
  readonly activeModal = signal<'approve' | 'reject' | 'request_info' | 'document_preview' | null>(null);
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  readonly isSubmitting = signal<boolean>(false);

  // Plain properties for ngModel two-way binding (signals are not compatible with ngModel)
  rejectionReason = '';
  requestInfoSubject = '';
  requestInfoMessage = '';

  // ─── Document Preview Signals ─────────────────────────────────────────────
  readonly previewDocTitle = signal<string>('');
  readonly previewDocUrl = signal<string>('');
  readonly previewDocSafeUrl = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.previewDocUrl()));
  readonly previewDocType = signal<'image' | 'pdf'>('image');

  // ─── Internal Notes State ──────────────────────────────────────────────────
  readonly internalNotesMap = signal<{ [key: string]: string }>({});

  constructor() {
    // Automatically reload list whenever filters, sorting, or page changes
    effect(() => {
      this.loadCompanions();
    });
  }

  ngOnInit(): void {
    // Initial load happens automatically due to the effect on signals
  }

  // ─── Load Data ────────────────────────────────────────────────────────────
  loadCompanions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filters = {
      status: this.statusFilter(),
      search: this.searchQuery(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
      page: this.page(),
      limit: this.limit()
    };

    this.verificationService.getCompanions(filters).subscribe({
      next: (response: CompanionsResponse) => {
        const list = response.data?.companions || [];
        this.companions.set(list);
        this.totalResults.set(response.pagination?.total || list.length);
        this.totalPages.set(response.pagination?.pages || 1);
        
        // If nothing is selected, or the selected companion is no longer in the list,
        // auto-select the first caregiver in the queue
        const currentSelected = this.selectedCompanion();
        if (list.length > 0) {
          const match = list.find(c => c._id === currentSelected?._id);
          if (match) {
            this.selectedCompanion.set(match);
          } else {
            this.selectedCompanion.set(list[0]);
          }
        } else {
          this.selectedCompanion.set(null);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load companions:', err);
        this.error.set('Failed to load caregiver applications. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  // ─── Selection ────────────────────────────────────────────────────────────
  selectCompanion(companion: CompanionProfile): void {
    this.selectedCompanion.set(companion);
  }

  // ─── Search / Filters ─────────────────────────────────────────────────────
  onSearch(event: any): void {
    this.searchQuery.set(event.target.value);
    this.page.set(1); // Reset page to first
  }

  setStatus(status: string): void {
    this.statusFilter.set(status);
    this.page.set(1); // Reset page to first
  }

  toggleSort(): void {
    const currentOrder = this.sortOrder();
    this.sortOrder.set(currentOrder === 'desc' ? 'asc' : 'desc');
  }

  changeSort(field: string): void {
    this.sortBy.set(field);
    this.page.set(1);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
    }
  }

  // ─── Modals Handlers ──────────────────────────────────────────────────────
  openModal(type: 'approve' | 'reject' | 'request_info'): void {
    if (!this.selectedCompanion()) return;
    // Reset form fields on open
    this.rejectionReason = '';
    this.requestInfoSubject = '';
    this.requestInfoMessage = '';
    this.isSubmitting.set(false);
    this.activeModal.set(type);
  }

  closeModal(): void {
    this.activeModal.set(null);
  }

  openDocPreview(title: string, url: string): void {
    this.previewDocTitle.set(title);
    this.previewDocUrl.set(url);
    const extension = url.split('.').pop()?.toLowerCase();
    this.previewDocType.set(extension === 'pdf' ? 'pdf' : 'image');
    this.activeModal.set('document_preview');
  }

  // ─── Actions Submission ───────────────────────────────────────────────────
  approveCaregiver(): void {
    const comp = this.selectedCompanion();
    if (!comp || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.verificationService.updateVerificationStatus(comp._id, 'verified').subscribe({
      next: () => {
        this.showToast('Caregiver approved successfully!', 'success');
        this.closeModal();
        this.loadCompanions();
      },
      error: (err) => {
        console.error('Approve failed:', err);
        this.isSubmitting.set(false);
        this.showToast('Failed to approve caregiver. Please try again.', 'error');
      }
    });
  }

  rejectCaregiver(): void {
    const comp = this.selectedCompanion();
    if (!comp || this.isSubmitting()) return;

    if (!this.rejectionReason.trim()) {
      this.showToast('Please provide a rejection reason.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.verificationService.updateVerificationStatus(comp._id, 'rejected', { rejectionReason: this.rejectionReason }).subscribe({
      next: () => {
        this.showToast('Caregiver application rejected.', 'success');
        this.closeModal();
        this.loadCompanions();
      },
      error: (err) => {
        console.error('Reject failed:', err);
        this.isSubmitting.set(false);
        this.showToast('Failed to reject caregiver. Please try again.', 'error');
      }
    });
  }

  requestMoreInfo(): void {
    const comp = this.selectedCompanion();
    if (!comp || this.isSubmitting()) return;

    if (!this.requestInfoMessage.trim()) {
      this.showToast('Please enter a message requesting more details.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.verificationService.updateVerificationStatus(comp._id, 'under_review', { message: this.requestInfoMessage }).subscribe({
      next: () => {
        this.showToast('Request for information submitted.', 'success');
        this.closeModal();
        this.loadCompanions();
      },
      error: (err) => {
        console.error('Request more info failed:', err);
        this.isSubmitting.set(false);
        this.showToast('Failed to submit request. Please try again.', 'error');
      }
    });
  }

  // ─── Admin Private Notes ──────────────────────────────────────────────────
  getAdminNote(companionId: string): string {
    return this.internalNotesMap()[companionId] || '';
  }

  updateAdminNote(companionId: string, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    const currentNotes = { ...this.internalNotesMap() };
    currentNotes[companionId] = text;
    this.internalNotesMap.set(currentNotes);
    
    // Save to local storage for persistence across reloads
    localStorage.setItem(`admin_notes_${companionId}`, text);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getExperienceYears(hours: number): number {
    if (!hours) return 0;
    // Assume 2000 hours of work per year of experience
    const years = hours / 2000;
    return Math.round(years * 10) / 10;
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getTimeAgo(dateStr: string): string {
    if (!dateStr) return 'Some time ago';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  getCompletedDocsCount(comp: CompanionProfile): number {
    let count = 0;
    const docs = comp.documents;
    if (docs?.nationalIdCard?.url && docs.nationalIdCard.url !== 'placeholder_national_id.jpg') count++;
    if (docs?.criminalRecord?.url && docs.criminalRecord.url !== 'placeholder_criminal_record.jpg') count++;
    if (docs?.syndicateCard?.url) count++;
    if (docs?.Certificates && docs.Certificates.length > 0) count += docs.Certificates.length;
    return count;
  }

  getTotalDocsCount(comp: CompanionProfile): number {
    let count = 2; // National ID + Criminal Record always required
    if (comp.companionType === 'specialized') count++; // Syndicate card required
    if (comp.documents?.Certificates) {
      count += comp.documents.Certificates.length;
    }
    return count;
  }

  getFormattedSpecialization(spec: string): string {
    switch (spec) {
      case 'nursing': return 'Registered Nurse';
      case 'physiotherapy': return 'Physiotherapist';
      case 'companionship_companion': return 'Companionship Companion';
      case 'dementia': return 'Dementia Specialist';
      case 'none':
      default:
        return 'General Caregiver';
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4000);
  }
}
