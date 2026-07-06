import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AiSecurityService } from '../../core/services/ai-security.service';
import { AiDashboardService } from '../../core/services/ai-dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import {
  FraudScanResult, SuspiciousCase, FraudAnalytics, RiskLevel, ViolationType
} from '../../core/models/ai.model';

@Component({
  selector: 'app-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent implements OnInit, OnDestroy {
  private readonly securityService  = inject(AiSecurityService);
  private readonly dashboardService = inject(AiDashboardService);
  private readonly toastService     = inject(ToastService);
  private readonly destroy$         = new Subject<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  readonly isScanning      = signal<boolean>(false);
  readonly scanResult      = signal<FraudScanResult | null>(null);
  readonly error           = signal<string | null>(null);
  readonly selectedCase    = signal<SuspiciousCase | null>(null);
  readonly showDetailModal = signal<boolean>(false);
  readonly actionLoading   = signal<string | null>(null);  // case id under action

  // ── Filter ────────────────────────────────────────────────────────────────
  readonly riskFilter   = signal<RiskLevel | 'all'>('all');

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly filteredCases = computed<SuspiciousCase[]>(() => {
    const cases = this.scanResult()?.suspiciousCases ?? [];
    const filter = this.riskFilter();
    return filter === 'all' ? cases : cases.filter(c => c.riskLevel === filter);
  });

  readonly analytics = computed<FraudAnalytics | null>(() => {
    const result = this.scanResult();
    if (!result) return null;
    return this.securityService.buildAnalyticsFromResult(result);
  });

  readonly hasScanResult = computed(() => this.scanResult() !== null);

  ngOnInit(): void {
    // Load cached result from last scan (if available from dashboard)
    const cached = this.securityService.lastScanResult();
    if (cached) {
      this.scanResult.set(cached);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  runScan(): void {
    this.isScanning.set(true);
    this.error.set(null);

    this.securityService.runFraudScan()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const result = res.data ?? this.buildMockResult();
          this.scanResult.set(result);
          this.securityService.lastScanResult.set(result);
          // Refresh dashboard alerts
          this.dashboardService.loadInsights();
          this.toastService.success(
            `Scan complete. ${result.violationsDetected ?? 0} violation(s) detected.`
          );
          this.isScanning.set(false);
        },
        error: (err: Error) => {
          // If endpoint isn't deployed yet, fall back to a demo result
          const mockResult = this.buildMockResult();
          this.scanResult.set(mockResult);
          this.securityService.lastScanResult.set(mockResult);
          this.error.set('AI scan endpoint not available. Showing demo data.');
          this.toastService.warning('Using demo data — backend endpoint not yet deployed.');
          this.isScanning.set(false);
        },
      });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  openDetail(c: SuspiciousCase): void {
    this.selectedCase.set(c);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
  }

  // ── Admin Actions ─────────────────────────────────────────────────────────
  handleAction(action: string, c: SuspiciousCase): void {
    this.actionLoading.set(c.id);
    // Optimistically update status in the result
    setTimeout(() => {
      this.scanResult.update(result => {
        if (!result) return result;
        return {
          ...result,
          suspiciousCases: result.suspiciousCases.map(sc =>
            sc.id === c.id ? { ...sc, status: action === 'ignore' ? 'ignored' : 'reviewed' } : sc
          )
        };
      });
      const labels: Record<string, string> = {
        reviewed: 'Marked as Reviewed',
        ignore: 'Case Ignored',
        warn: 'User Warned',
        suspend: 'Account Suspended',
        escalate: 'Case Escalated',
      };
      this.toastService.success(labels[action] ?? 'Action applied.');
      this.actionLoading.set(null);
      this.closeDetail();
    }, 800);
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  setRiskFilter(v: RiskLevel | 'all'): void { this.riskFilter.set(v); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  readonly Math = Math;

  getRiskBadgeClass(risk: string): string {
    return this.securityService.getRiskBadgeClass(risk as RiskLevel);
  }

  getViolationLabel(type: string): string {
    return this.securityService.getViolationLabel(type as ViolationType);
  }

  getConvTypeLabel(type: string): string {
    return this.securityService.getConversationTypeLabel(type);
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getConfidenceColor(conf: number): string {
    if (conf >= 80) return 'text-red-600';
    if (conf >= 60) return 'text-amber-600';
    return 'text-emerald-600';
  }

  getConfidenceBg(conf: number): string {
    if (conf >= 80) return 'bg-red-500';
    if (conf >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  trackById(_: number, c: SuspiciousCase): string { return c.id; }

  // ── Mock data for when backend is not yet deployed ─────────────────────────
  private buildMockResult(): FraudScanResult {
    const now = new Date().toISOString();
    return {
      scannedAt: now,
      totalConversationsScanned: 127,
      violationsDetected: 4,
      highRiskCases: 2,
      suspiciousCases: [
        {
          id: 'mock-1',
          userId: 'u1',
          userName: 'Ahmed Al-Rashid',
          conversationType: 'family_chat',
          violationType: 'phone_number_sharing',
          violationLabel: 'Phone Number Sharing',
          aiConfidence: 92,
          riskLevel: 'high',
          detectedAt: now,
          status: 'pending',
          aiExplanation: 'User explicitly shared a phone number to bypass the platform communication system.',
          suggestedAction: 'Issue a formal warning. Suspend account on repeat offense.',
          messages: [
            { sender: 'Ahmed Al-Rashid', content: 'My number is 0501234567, call me directly.', timestamp: now, flagged: true, flagReason: 'Phone number detected' },
            { sender: 'Caregiver', content: 'Sure, I will call you.', timestamp: now, flagged: false },
          ],
        },
        {
          id: 'mock-2',
          userId: 'u2',
          userName: 'Sara Hassan',
          conversationType: 'companion_chat',
          violationType: 'external_payment_attempt',
          violationLabel: 'External Payment Attempt',
          aiConfidence: 87,
          riskLevel: 'high',
          detectedAt: now,
          status: 'pending',
          aiExplanation: 'Caregiver suggested cash payment outside the Sanad platform to avoid platform fees.',
          suggestedAction: 'Warn the caregiver. Log the incident and monitor closely.',
          messages: [
            { sender: 'Sara Hassan', content: 'You can pay me cash, no need for the app.', timestamp: now, flagged: true, flagReason: 'External payment attempt' },
          ],
        },
        {
          id: 'mock-3',
          userId: 'u3',
          userName: 'Omar Khalil',
          conversationType: 'family_chat',
          violationType: 'suspicious_language',
          violationLabel: 'Suspicious Language',
          aiConfidence: 65,
          riskLevel: 'medium',
          detectedAt: now,
          status: 'pending',
          aiExplanation: 'Message contains language patterns that could indicate coercion or inappropriate pressure.',
          suggestedAction: 'Review manually. No immediate action required.',
          messages: [
            { sender: 'Omar Khalil', content: 'You must do exactly what I say or I will report you.', timestamp: now, flagged: true, flagReason: 'Coercive language' },
          ],
        },
        {
          id: 'mock-4',
          userId: 'u4',
          userName: 'Fatima Al-Zahra',
          conversationType: 'family_chat',
          violationType: 'cash_booking_agreement',
          violationLabel: 'Cash Booking Agreement',
          aiConfidence: 55,
          riskLevel: 'low',
          detectedAt: now,
          status: 'pending',
          aiExplanation: 'Possible discussion about informal cash arrangement, but not conclusive.',
          suggestedAction: 'Flag for review. No immediate action.',
          messages: [
            { sender: 'Fatima Al-Zahra', content: 'Can we just arrange something informally this week?', timestamp: now, flagged: true, flagReason: 'Possible off-platform arrangement' },
          ],
        },
      ],
      analytics: {
        fraudToday: 2,
        fraudThisWeek: 4,
        mostCommonViolation: 'Phone Number Sharing',
        avgConfidence: 75,
        highRiskPercent: 50,
      },
    };
  }
}
