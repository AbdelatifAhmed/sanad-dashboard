import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ReviewFamily {
  _id: string;
  name: string;
  email: string;
  avatar?: { url?: string };
}

export interface ReviewCompanion {
  _id: string;
  userId?: { _id: string; name: string; avatar?: { url?: string } };
}

export interface AdminReview {
  _id: string;
  bookingId?: { _id: string; status: string; totalPrice: number; totalHours?: number; startDate: string; endDate: string };
  familyId?: ReviewFamily;
  companionId?: ReviewCompanion;
  rating: number;
  comment: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  total: number;
  avgRating: number;
  thisMonth: number;
  hidden: number;
}

export interface ReviewsResponse {
  status: string;
  reviews: AdminReview[];
  pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
  stats: ReviewStats;
}

export interface ReviewFilters {
  isVisible?: string;
  rating?: string;
  page?: number;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = environment.apiBaseUrl;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getReviews(filters: ReviewFilters = {}): Observable<ReviewsResponse> {
    const headers = this.getHeaders();
    let params = new HttpParams();
    if (filters.isVisible !== undefined && filters.isVisible !== 'all') params = params.set('isVisible', filters.isVisible);
    if (filters.rating) params = params.set('rating', filters.rating);
    if (filters.page)   params = params.set('page',   filters.page.toString());
    if (filters.limit)  params = params.set('limit',  filters.limit.toString());
    return this.http.get<ReviewsResponse>(`${this.BASE}/admin/reviews`, { headers, params });
  }

  toggleVisibility(id: string): Observable<{ status: string; data: { isVisible: boolean } }> {
    return this.http.patch<{ status: string; data: { isVisible: boolean } }>(
      `${this.BASE}/admin/reviews/${id}/toggle-visibility`, {},
      { headers: this.getHeaders() }
    );
  }

  deleteReview(id: string): Observable<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(
      `${this.BASE}/admin/reviews/${id}`,
      { headers: this.getHeaders() }
    );
  }
}
