import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending' | 'pending_payment' | 'approved'
  | 'active' | 'completed' | 'cancelled';

export interface BookingUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: { url?: string };
}

export interface BookingJobPost {
  _id: string;
  title: string;
  serviceType: string;
  budgetPerHour: number;
  location?: { city?: string; governorate?: string; readableAddress?: string };
  schedule?: { workingDays: string[]; startTime: string; endTime: string; durationInWeeks: number };
}

export interface AdminBooking {
  _id: string;
  familyId?: BookingUser;
  companionId?: BookingUser;
  jobPostId?: BookingJobPost;
  beneficiaryId?: string;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod: 'cash' | 'card' | 'wallet';
  hourlyRateAtBooking: number;
  totalHours: number;
  totalPrice: number;
  adminFee: number;
  companionEarnings: number;
  startDate: string;
  endDate: string;
  workingDays: string[];
  notes?: string;
  location?: { city?: string; governorate?: string; readableAddress?: string };
  createdAt: string;
  updatedAt: string;
}

export interface BookingStats {
  total: number;
  pending: number;
  pending_payment: number;
  approved: number;
  active: number;
  completed: number;
  cancelled: number;
}

export interface BookingsResponse {
  status: string;
  results: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: BookingStats;
  data: { bookings: AdminBooking[] };
}

export interface BookingDetailResponse {
  status: string;
  data: {
    booking: AdminBooking;
    proposals: ProposalItem[];
  };
}

export interface ProposalItem {
  _id: string;
  companionId?: BookingUser;
  proposedRate: number;
  coverLetter: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface BookingFilters {
  status?: string;
  page?: number;
  limit?: number;
  companionId?: string;
  familyId?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = environment.apiBaseUrl;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getBookings(filters: BookingFilters = {}): Observable<BookingsResponse> {
    const headers = this.getHeaders();
    let params = new HttpParams();
    if (filters.status && filters.status !== 'all') params = params.set('status', filters.status);
    if (filters.page)        params = params.set('page',        filters.page.toString());
    if (filters.limit)       params = params.set('limit',       filters.limit.toString());
    if (filters.companionId) params = params.set('companionId', filters.companionId);
    if (filters.familyId)    params = params.set('familyId',    filters.familyId);
    return this.http.get<BookingsResponse>(`${this.BASE}/admin/bookings`, { headers, params });
  }

  getBookingById(id: string): Observable<BookingDetailResponse> {
    return this.http.get<BookingDetailResponse>(
      `${this.BASE}/admin/bookings/${id}`,
      { headers: this.getHeaders() }
    );
  }

  updateStatus(id: string, status: BookingStatus): Observable<{ status: string; data: { booking: AdminBooking } }> {
    return this.http.patch<{ status: string; data: { booking: AdminBooking } }>(
      `${this.BASE}/admin/bookings/${id}/status`,
      { status },
      { headers: this.getHeaders() }
    );
  }
}
