import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SettingsService, PlatformSettings } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);

  // Signals
  readonly activeTab = signal<string>('general');
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Group
  settingsForm!: FormGroup;

  // Cached original settings to detect changes
  private originalSettings: Partial<PlatformSettings> = {};

  ngOnInit(): void {
    this.initForm();
    this.loadSettings();
  }

  private initForm(): void {
    this.settingsForm = this.fb.group({
      // General Settings
      platformName: ['', [Validators.required]],
      supportEmail: ['', [Validators.required, Validators.email]],
      contactNumber: ['', [Validators.required]],
      defaultLanguage: ['English (United Kingdom)', [Validators.required]],
      timezone: ['(GMT+03:00) Riyadh, Saudi Arabia', [Validators.required]],
      maintenanceMode: [false],

      // Security Settings
      sessionTimeout: [30, [Validators.required, Validators.min(1)]],
      passwordPolicy: this.fb.group({
        minLength: [12, [Validators.required, Validators.min(6)]],
        requireSpecial: [true],
        expiry90days: [true]
      }),
      twoFactorEnforced: [true],

      // Notification Settings
      emailNotifications: [true],
      smsNotifications: [true],
      pushNotifications: [true],
      newBookingAlerts: [true],
      lowCreditAlert: [false],

      // System Settings
      registrationToggle: [true],
      autoApprovalSettings: [false],

      // Payments Settings
      platformFee: [15, [Validators.required, Validators.min(0), Validators.max(100)]],
      payoutSchedule: ['Bi-Weekly', [Validators.required]],
      baseCurrency: ['SAR - Saudi Riyal', [Validators.required]]
    });
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.settingsService.getSettings().subscribe({
      next: (res) => {
        const data = res.data?.settings;
        if (data) {
          this.originalSettings = data;
          this.settingsForm.patchValue(data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load settings:', err);
        this.showToast('Failed to load platform settings. Loaded defaults.', 'error');
        this.isLoading.set(false);
      }
    });
  }

  switchTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  onSave(): void {
    if (this.settingsForm.invalid) {
      this.showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    this.isSaving.set(true);

    // Build partial update payload based on dirty controls
    const updatePayload: Partial<PlatformSettings> = {};
    const formValue = this.settingsForm.value;

    Object.keys(formValue).forEach(key => {
      const control = this.settingsForm.get(key);
      if (control?.dirty) {
        (updatePayload as any)[key] = formValue[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      this.showToast('No changes detected to save.', 'success');
      this.isSaving.set(false);
      return;
    }

    this.settingsService.updateSettings(updatePayload).subscribe({
      next: (res) => {
        const data = res.data?.settings;
        if (data) {
          this.originalSettings = data;
          // Mark all controls as pristine (not dirty anymore)
          this.settingsForm.reset(data);
        }
        this.showToast('Settings saved successfully.', 'success');
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to save settings:', err);
        this.showToast('Failed to save changes. Please try again.', 'error');
        this.isSaving.set(false);
      }
    });
  }

  onDiscard(): void {
    // Reset form value to the original loaded settings
    this.settingsForm.reset(this.originalSettings);
    this.showToast('Discarded unsaved modifications.', 'success');
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4000);
  }
}
