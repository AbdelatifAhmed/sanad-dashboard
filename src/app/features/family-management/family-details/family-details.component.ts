import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { 
  FamilyManagementService, 
  FamilyDetailsData 
} from '../../../core/services/family-management.service';

@Component({
  selector: 'app-family-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './family-details.component.html',
  styleUrl: './family-details.component.css'
})
export class FamilyDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly familyService = inject(FamilyManagementService);

  // ─── Signals ──────────────────────────────────────────────────────────────
  readonly familyId = signal<string | null>(null);
  readonly details = signal<FamilyDetailsData | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.familyId.set(id);
      this.loadDetails(id);
    } else {
      this.error.set('No Family ID was provided.');
    }
  }

  loadDetails(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.familyService.getFamilyDetails(id).subscribe({
      next: (res) => {
        this.details.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load family details:', err);
        this.error.set('Failed to load family profile details. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  toggleSuspension(): void {
    const id = this.familyId();
    if (!id || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.familyService.toggleBanFamily(id).subscribe({
      next: (res) => {
        const nextStatus = res.data?.user?.isBanned ? 'suspended' : 'active';
        this.showToast(`Family account is now ${nextStatus}.`, 'success');
        this.isSubmitting.set(false);
        this.loadDetails(id); // Reload updated data
      },
      error: (err) => {
        console.error('Failed to toggle ban status:', err);
        const msg = err.error?.message || 'Failed to update account status. Please try again.';
        this.showToast(msg, 'error');
        this.isSubmitting.set(false);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name?: string): string {
    if (!name) return 'F';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getRelationship(category?: string): string {
    if (!category) return 'Elderly Relative';
    return category === 'elderly' ? 'Elderly Parent' : 'Special Needs Dependent';
  }

  getCareRequestsHeading(): string {
    const count = this.details()?.requests?.length || 0;
    return `Care Requests (${count})`;
  }

  getServiceTypeLabel(type: string): string {
    switch (type) {
      case 'elderly_care': return 'Elderly Care';
      case 'child_care': return 'Child Care';
      case 'home_nursing': return 'Home Nursing';
      case 'physical_therapy': return 'Physiotherapy';
      case 'companionship': return 'Companionship';
      default:
        return 'General Care';
    }
  }

  getBookingStatusClass(status: string): string {
    switch (status) {
      case 'active':
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
      case 'pending_payment':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'cancelled':
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  }

  getJobStatusClass(status: string): string {
    switch (status) {
      case 'open':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'filled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'closed':
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  }

  goBack(): void {
    this.router.navigate(['/families']);
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4000);
  }
}
