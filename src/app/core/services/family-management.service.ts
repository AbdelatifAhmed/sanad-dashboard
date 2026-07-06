import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface FamilyListEntry {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: { url?: string };
  isBanned: boolean;
  createdAt: string;
  city: string;
  area: string;
  elderlyCount: number;
  activeRequests: number;
  activeBookings: number;
}

export interface FamiliesResponse {
  status: string;
  data: {
    families: FamilyListEntry[];
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats?: {
    total: number;
    totalActive: number;
    totalSuspended: number;
    totalElderly: number;
    totalActiveRequests: number;
  };
}

export interface Beneficiary {
  _id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  category: 'elderly' | 'special_needs';
  conditionDetails: string;
  interests?: string[];
}

export interface FamilyProfile {
  address: {
    city: string;
    area: string;
    fullAddress: string;
  };
  beneficiaries: Beneficiary[];
}

export interface JobPost {
  _id: string;
  title: string;
  description: string;
  serviceType: string;
  budgetPerHour: number;
  status: string;
  createdAt: string;
}

export interface Booking {
  _id: string;
  status: string;
  totalPrice: number;
  startDate: string;
  endDate: string;
  workingDays: string[];
}

export interface AssignedCaregiver {
  _id: string;
  name: string;
  phone: string;
  email: string;
  avatar?: { url?: string };
  rating: number;
  status: string;
  startDate: string;
  endDate: string;
}

export interface FamilyDetailsData {
  family: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    avatar?: { url?: string };
    isBanned: boolean;
    createdAt: string;
    location?: any;
  };
  profile: FamilyProfile | null;
  requests: JobPost[];
  bookings: Booking[];
  assignedCaregivers: AssignedCaregiver[];
  stats: {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    totalElderly: number;
  };
}

export interface FamilyDetailsResponse {
  status: string;
  data: FamilyDetailsData;
}

@Injectable({
  providedIn: 'root'
})
export class FamilyManagementService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE = 'http://localhost:5000/api';

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  /**
   * Get families paged list with optional filter/search/sort parameters.
   */
  getFamilies(filters: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<FamiliesResponse> {
    const headers = this.getHeaders();
    let params = new HttpParams();

    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<FamiliesResponse>(`${this.BASE}/admin/families`, { headers, params });
  }

  /**
   * Retrieve detailed information for a single family.
   */
  getFamilyDetails(id: string): Observable<FamilyDetailsResponse> {
    const headers = this.getHeaders();
    return this.http.get<FamilyDetailsResponse>(`${this.BASE}/admin/families/${id}`, { headers });
  }

  /**
   * Toggle suspension status of a family user account.
   */
  toggleBanFamily(id: string): Observable<any> {
    const headers = this.getHeaders();
    return this.http.patch<any>(`${this.BASE}/admin/families/${id}/toggle-ban`, {}, { headers });
  }
}
