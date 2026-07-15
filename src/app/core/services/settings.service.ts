import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  contactNumber: string;
  defaultLanguage: string;
  timezone: string;
  sessionTimeout: number;
  passwordPolicy: {
    minLength: number;
    requireSpecial: boolean;
    expiry90days: boolean;
  };
  twoFactorEnforced: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  newBookingAlerts: boolean;
  lowCreditAlert: boolean;
  maintenanceMode: boolean;
  registrationToggle: boolean;
  autoApprovalSettings: boolean;
  platformFee: number;
  payoutSchedule: string;
  baseCurrency: string;
}

export interface SettingsResponse {
  status: string;
  data: {
    settings: PlatformSettings;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE = 'http://localhost:5000/api';

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  getSettings(): Observable<SettingsResponse> {
    const headers = this.getHeaders();
    return this.http.get<SettingsResponse>(`${this.BASE}/admin/settings`, { headers });
  }

  updateSettings(settings: Partial<PlatformSettings>): Observable<SettingsResponse> {
    const headers = this.getHeaders();
    return this.http.put<SettingsResponse>(`${this.BASE}/admin/settings`, settings, { headers });
  }
}
