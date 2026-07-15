// ── AI Models / Interfaces ────────────────────────────────────────────────────

// ── Fraud / Security ──────────────────────────────────────────────────────────

export type RiskLevel = 'high' | 'medium' | 'low';

export type ViolationType =
  | 'phone_number_sharing'
  | 'external_payment_attempt'
  | 'cash_booking_agreement'
  | 'contact_information_leakage'
  | 'suspicious_language'
  | 'policy_violation'
  | 'other';

export interface SuspiciousMessage {
  sender: string;
  content: string;
  timestamp: string;
  flagged: boolean;
  flagReason?: string;
}

export interface SuspiciousCase {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  conversationType: 'family_chat' | 'companion_chat' | 'admin_chat';
  violationType: ViolationType;
  violationLabel: string;
  aiConfidence: number;           // 0–100
  riskLevel: RiskLevel;
  detectedAt: string;
  status: 'pending' | 'reviewed' | 'ignored' | 'escalated';
  messages: SuspiciousMessage[];
  aiExplanation: string;
  suggestedAction: string;
}

export interface FraudScanResult {
  scannedAt: string;
  totalConversationsScanned?: number;
  violationsDetected?: number;
  highRiskCases?: number;
  suspiciousCases: SuspiciousCase[];
  analytics?: FraudAnalytics;
}

export interface FraudAnalytics {
  fraudToday: number;
  fraudThisWeek: number;
  mostCommonViolation: string;
  avgConfidence: number;
  highRiskPercent: number;
}

export interface FraudScanResponse {
  status: string;
  data: FraudScanResult;
}

// ── Review Sentiment ──────────────────────────────────────────────────────────

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'critical';
export type ReviewCategory =
  | 'service_quality'
  | 'caregiver_behavior'
  | 'medical_negligence'
  | 'payment'
  | 'communication'
  | 'abuse'
  | 'scam'
  | 'other';

export type ReviewPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AiReviewItem {
  _id: string;
  familyId?: { _id: string; name: string; email: string; avatar?: { url?: string } };
  companionId?: { _id: string; userId?: { _id: string; name: string; avatar?: { url?: string } } };
  rating: number;
  comment: string;
  isVisible: boolean;
  createdAt: string;
  bookingId?: { _id: string; status: string; totalPrice: number; totalHours?: number; startDate: string; endDate: string };
  // AI-augmented fields
  sentimentScore?: SentimentType;
  alertLevel?: ReviewPriority;
  flaggedViolations?: string[];
  auditSummary?: string;
}

export interface ReviewSentimentSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  critical: number;
}

export interface AiReviewsResponse {
  status: string;
  results: number;
  data: AiReviewItem[];
}

// ── Dashboard AI Insights ─────────────────────────────────────────────────────

export interface AiInsightStats {
  fraudAttemptsToday: number;
  highRiskConversations: number;
  criticalComplaints: number;
  positiveReviewPercent: number;
  lastScanTime: string | null;
  systemStatus: 'active' | 'offline';
}

export interface AiAlert {
  id: string;
  type: 'fraud' | 'critical_complaint' | 'phone_leak' | 'external_payment' | 'suspicious';
  title: string;
  description: string;
  timestamp: string;
  priority: ReviewPriority;
  relatedPage: 'security' | 'reviews';
  relatedId?: string;
}
