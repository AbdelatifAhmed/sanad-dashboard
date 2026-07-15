import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import {
  FraudScanResponse,
  FraudScanResult,
  FraudAnalytics,
  SuspiciousCase,
  RiskLevel,
  ViolationType,
} from '../models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiSecurityService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = environment.apiBaseUrl;

  /** Cached last scan result so Dashboard can read it without re-fetching */
  readonly lastScanResult = signal<FraudScanResult | null>(null);

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * POST /api/ai/admin/monitor-fraud
   * Triggers an AI scan of all recent conversations for fraud/policy violations.
   */
  runFraudScan(): Observable<FraudScanResponse> {
    return this.http
      .post<FraudScanResponse>(
        `${this.BASE}/ai/admin/monitor-fraud`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        catchError((err) => {
          // Surface a structured error so components can show friendly messages
          const message =
            err?.error?.message || 'AI fraud scan failed. Please try again.';
          return throwError(() => new Error(message));
        })
      );
  }

  // ── Label helpers ────────────────────────────────────────────────────────

  getViolationLabel(type: ViolationType | string): string {
    const map: Record<string, string> = {
      phone_number_sharing:         'Phone Number Sharing',
      external_payment_attempt:     'External Payment Attempt',
      cash_booking_agreement:       'Cash Booking Agreement',
      contact_information_leakage:  'Contact Info Leakage',
      suspicious_language:          'Suspicious Language',
      policy_violation:             'Policy Violation',
      other:                        'Other Violation',
    };
    return map[type] ?? type;
  }

  getRiskBadgeClass(risk: RiskLevel | string): string {
    switch (risk) {
      case 'high':   return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:       return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }

  getConversationTypeLabel(type: string): string {
    const map: Record<string, string> = {
      family_chat:    'Family Chat',
      companion_chat: 'Companion Chat',
      admin_chat:     'Admin Message',
    };
    return map[type] ?? type;
  }

  /** Build mock analytics from scan result for cases where backend doesn't return full analytics */
  buildAnalyticsFromResult(result: FraudScanResult): FraudAnalytics {
    const cases = result.suspiciousCases ?? [];
    const highRisk = cases.filter(c => c.riskLevel === 'high').length;
    const violationCounts: Record<string, number> = {};
    cases.forEach(c => {
      const vt = c.violationType ?? 'other';
      violationCounts[vt] = (violationCounts[vt] ?? 0) + 1;
    });
    const mostCommon = Object.entries(violationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    const avgConf = cases.length
      ? Math.round(cases.reduce((s, c) => s + (c.aiConfidence ?? 0), 0) / cases.length)
      : 0;

    return {
      fraudToday:           result.analytics?.fraudToday ?? highRisk,
      fraudThisWeek:        result.analytics?.fraudThisWeek ?? cases.length,
      mostCommonViolation:  result.analytics?.mostCommonViolation ?? this.getViolationLabel(mostCommon),
      avgConfidence:        result.analytics?.avgConfidence ?? avgConf,
      highRiskPercent:
        result.analytics?.highRiskPercent ??
        (cases.length ? Math.round((highRisk / cases.length) * 100) : 0),
    };
  }

  getHighRiskUsers(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/ai/admin/risk-center/users?page=${page}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
  }

  getUserInvestigationReport(userId: string): Observable<any> {
    return this.http.get<any>(
      `${this.BASE}/ai/admin/risk-center/investigate/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  executeAdminAction(userId: string, action: string, reason?: string): Observable<any> {
    return this.http.post<any>(
      `${this.BASE}/ai/admin/risk-center/action`,
      { userId, action, reason },
      { headers: this.getHeaders() }
    );
  }
}
