import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import {
  AiReviewsResponse,
  AiReviewItem,
  ReviewSentimentSummary,
  SentimentType,
  ReviewPriority,
} from '../models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiReviewAnalyzerService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = environment.apiBaseUrl;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * GET /api/ai/admin/analyze-reviews
   * Returns the last 50 reviews enriched with AI sentiment + audit data.
   */
  analyzeReviews(): Observable<AiReviewsResponse> {
    return this.http
      .get<AiReviewsResponse>(`${this.BASE}/ai/admin/analyze-reviews`, {
        headers: this.getHeaders(),
      })
      .pipe(
        catchError((err) => {
          const message =
            err?.error?.message || 'Failed to analyze reviews. Please try again.';
          return throwError(() => new Error(message));
        })
      );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  buildSummary(items: AiReviewItem[]): ReviewSentimentSummary {
    const summary: ReviewSentimentSummary = {
      total: items.length,
      positive: 0,
      neutral: 0,
      negative: 0,
      critical: 0,
    };
    items.forEach((rv) => {
      switch (rv.sentimentScore) {
        case 'positive': summary.positive++;   break;
        case 'neutral':  summary.neutral++;    break;
        case 'negative': summary.negative++;   break;
        case 'critical': summary.critical++;   break;
        default:
          // Infer from rating if no AI score
          if (rv.rating >= 4)       summary.positive++;
          else if (rv.rating === 3) summary.neutral++;
          else                      summary.negative++;
      }
    });
    return summary;
  }

  getSentimentBadgeClass(sentiment?: SentimentType | string): string {
    switch (sentiment) {
      case 'positive': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'neutral':  return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'negative': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      default:         return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }

  getPriorityBadgeClass(priority?: ReviewPriority | string): string {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high':     return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:         return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }

  getSentimentLabel(sentiment?: SentimentType | string): string {
    switch (sentiment) {
      case 'positive': return 'Positive';
      case 'neutral':  return 'Neutral';
      case 'negative': return 'Negative';
      case 'critical': return 'Critical';
      default:         return '—';
    }
  }

  getPriorityLabel(priority?: ReviewPriority | string): string {
    switch (priority) {
      case 'critical': return 'Critical';
      case 'high':     return 'High';
      case 'medium':   return 'Medium';
      case 'low':      return 'Low';
      default:         return '—';
    }
  }

  getCategoryLabel(violation?: string): string {
    const map: Record<string, string> = {
      service_quality:      'Service Quality',
      caregiver_behavior:   'Caregiver Behavior',
      medical_negligence:   'Medical Negligence',
      payment:              'Payment',
      communication:        'Communication',
      abuse:                'Abuse',
      scam:                 'Scam',
      other:                'Other',
    };
    return (violation && map[violation]) ? map[violation] : (violation ?? 'Other');
  }

  /** Derive effective sentiment from AI score or rating fallback */
  getEffectiveSentiment(item: AiReviewItem): SentimentType {
    if (item.sentimentScore) return item.sentimentScore;
    if (item.rating >= 4)       return 'positive';
    if (item.rating === 3)      return 'neutral';
    if (item.rating <= 2)       return 'negative';
    return 'neutral';
  }

  /** Derive effective priority from alert level or rating fallback */
  getEffectivePriority(item: AiReviewItem): ReviewPriority {
    if (item.alertLevel) return item.alertLevel;
    if (item.rating === 1) return 'critical';
    if (item.rating === 2) return 'high';
    if (item.rating === 3) return 'medium';
    return 'low';
  }
}
