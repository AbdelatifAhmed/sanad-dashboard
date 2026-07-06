import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface JobPostBeneficiary {
  name: string;
  age: number;
  gender: 'male' | 'female';
  category: 'elderly' | 'special_needs';
  conditionDetails: string;
  interests?: string[];
}

export interface JobPostSchedule {
  workingDays: string[];
  startTime: string;
  endTime: string;
  durationInWeeks: number;
}

export interface JobPostLocation {
  geo?: { type: string; coordinates: number[] };
  readableAddress?: string;
  city: string;
  governorate: string;
}

export interface JobPostFamily {
  _id: string;
  name: string;
  phone: string;
  avatar?: { url?: string };
  location?: any;
}

export interface JobPostDetail {
  _id: string;
  familyId: JobPostFamily;
  beneficiaryId: string;
  beneficiary?: JobPostBeneficiary;
  title: string;
  description: string;
  serviceType: string;
  requiredSkills?: string[];
  taskList?: string[];
  preferredGender?: string;
  preferredCaregiverGender?: string;
  budgetPerHour: number;
  schedule: JobPostSchedule;
  location: JobPostLocation;
  startDate: string;
  status: 'open' | 'assigned' | 'canceled' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface JobPostDetailResponse {
  status: string;
  data: { job: JobPostDetail };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JobPostService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly BASE = environment.apiBaseUrl;

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /** Fetch full job post details including beneficiary profile. */
  getById(id: string): Observable<JobPostDetailResponse> {
    return this.http.get<JobPostDetailResponse>(
      `${this.BASE}/job-posts/${id}`,
      { headers: this.getHeaders() }
    );
  }
}
