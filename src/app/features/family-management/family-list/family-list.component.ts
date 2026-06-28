import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  FamilyManagementService, 
  FamilyListEntry, 
  FamiliesResponse 
} from '../../../core/services/family-management.service';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './family-list.component.html',
  styleUrl: './family-list.component.css'
})
export class FamilyListComponent implements OnInit {
  private readonly familyService = inject(FamilyManagementService);
  private readonly router = inject(Router);

  // ─── Query State Signals ──────────────────────────────────────────────────
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('all'); // all, active, suspended
  readonly sortBy = signal<string>('createdAt');
  readonly sortOrder = signal<string>('desc');
  readonly page = signal<number>(1);
  readonly limit = signal<number>(10);

  // ─── Data Signals ─────────────────────────────────────────────────────────
  readonly families = signal<FamilyListEntry[]>([]);
  readonly totalResults = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // ─── UI Actions Signals ───────────────────────────────────────────────────
  readonly isSubmitting = signal<string | null>(null); // contains ID of row being toggled
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  constructor() {
    // Automatically reload list whenever filters, sorting, or page changes
    effect(() => {
      this.loadFamilies();
    });
  }

  ngOnInit(): void {
    // Initial load triggered automatically by effect
  }

  // ─── Load Data ────────────────────────────────────────────────────────────
  loadFamilies(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filters = {
      status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
      search: this.searchQuery() || undefined,
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
      page: this.page(),
      limit: this.limit()
    };

    this.familyService.getFamilies(filters).subscribe({
      next: (response: FamiliesResponse) => {
        const list = response.data?.families || [];
        this.families.set(list);
        this.totalResults.set(response.pagination?.total || list.length);
        this.totalPages.set(response.pagination?.totalPages || 1);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load families:', err);
        this.error.set('Failed to load families list. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  viewDetails(id: string): void {
    this.router.navigate(['/families', id]);
  }

  toggleBan(family: FamilyListEntry, event: Event): void {
    event.stopPropagation(); // Prevent row click navigation
    if (this.isSubmitting()) return;

    this.isSubmitting.set(family._id);
    this.familyService.toggleBanFamily(family._id).subscribe({
      next: (res) => {
        const nextStatus = res.data?.user?.isBanned ? 'suspended' : 'active';
        this.showToast(`Family account ${family.name} is now ${nextStatus}.`, 'success');
        this.isSubmitting.set(null);
        this.loadFamilies();
      },
      error: (err) => {
        console.error('Failed to toggle ban status:', err);
        const msg = err.error?.message || 'Failed to update account status. Please try again.';
        this.showToast(msg, 'error');
        this.isSubmitting.set(null);
      }
    });
  }

  // ─── Search / Filter Handlers ─────────────────────────────────────────────
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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    if (!name) return 'F';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4000);
  }
}
