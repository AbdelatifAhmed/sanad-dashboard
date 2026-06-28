import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface UserDetails {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: { url?: string; public_id?: string };
  location?: {
    geo?: { type: string; coordinates: number[] };
    readableAddress?: string;
    city?: string;
    governorate?: string;
  };
  createdAt: string;
}

export interface SkillDetails {
  _id: string;
  nameAr: string;
  nameEn: string;
  category: string;
}

export interface DocumentInfo {
  url: string;
  public_id: string;
}

export interface CertificateInfo {
  name: string;
  url: string;
  public_id: string;
  _id?: string;
}

export interface AvailabilitySlot {
  day: string;
  slots: string[];
}

export interface CompanionProfile {
  _id: string;
  userId: UserDetails;
  companionType: 'general' | 'specialized';
  specialization: 'none' | 'nursing' | 'physiotherapy' | 'companionship_companion' | 'dementia';
  bio: string;
  hourlyRate: number;
  skills?: SkillDetails[];
  hobbies?: string[];
  availability?: AvailabilitySlot[];
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'under_review';
  rejectionReason?: string;
  requestMoreInfoMessage?: string;
  documents: {
    nationalIdCard?: DocumentInfo;
    criminalRecord?: DocumentInfo;
    Certificates?: CertificateInfo[];
    syndicateCard?: DocumentInfo;
  };
  rating: number;
  reviewCount: number;
  totalWorkHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionsResponse {
  status: string;
  results: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  data: {
    companions: CompanionProfile[];
  };
}

export interface SingleCompanionResponse {
  status: string;
  data: {
    companion: CompanionProfile;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CaregiverVerificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE = 'http://localhost:5000/api';

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  /**
   * Get caregivers/companions paged list with optional filter/search/sort parameters.
   */
  getCompanions(filters: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<CompanionsResponse> {
    const headers = this.getHeaders();
    let params = new HttpParams();

    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<CompanionsResponse>(`${this.BASE}/admin/companions`, { headers, params });
  }

  /**
   * Retrieve detailed information for a single caregiver (including documents and availability).
   */
  getCompanionDetails(id: string): Observable<SingleCompanionResponse> {
    const headers = this.getHeaders();
    return this.http.get<SingleCompanionResponse>(`${this.BASE}/companion/${id}`, { headers });
  }

  /**
   * Update the verification status of a caregiver (verify, reject, request info).
   */
  updateVerificationStatus(
    id: string,
    status: 'verified' | 'rejected' | 'under_review',
    details?: { rejectionReason?: string; message?: string }
  ): Observable<any> {
    const headers = this.getHeaders();
    const body = {
      status,
      rejectionReason: details?.rejectionReason,
      message: details?.message
    };
    return this.http.patch<any>(`${this.BASE}/admin/companions/verify-companion/${id}`, body, { headers });
  }
}
