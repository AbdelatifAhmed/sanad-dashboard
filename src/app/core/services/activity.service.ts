import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

// ─── Models ──────────────────────────────────────────────────────────────────

export type ActivityCategory = 'all' | 'registration' | 'verification' | 'booking' | 'profile';
export type ActivityRole     = 'all' | 'family' | 'companion' | 'admin';
export type ActivityDateRange = 'all' | 'today' | 'week' | 'month' | '3months';
export type ActivitySort     = 'desc' | 'asc';

export interface ActivityEvent {
  id:          string;
  category:    string;
  type:        string;
  title:       string;
  description: string;
  actorName:   string;
  actorRole:   string;
  relatedId:   string;
  relatedModel: string;
  entityId?:   string;
  icon:        string;
  iconBg:      string;
  iconColor:   string;
  badgeLabel:  string;
  badgeClass:  string;
  timestamp:   string;
  exactDate:   string;
  navigateTo:  string;
}

export interface ActivityFilters {
  category?:  ActivityCategory;
  role?:      ActivityRole;
  dateRange?: ActivityDateRange;
  sort?:      ActivitySort;
  search?:    string;
  page?:      number;
  limit?:     number;
}

export interface ActivityResponse {
  status:     string;
  results:    number;
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
    hasMore:    boolean;
  };
  data: {
    activities: ActivityEvent[];
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = 'http://localhost:5000/api';

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  getActivities(filters: ActivityFilters = {}): Observable<ActivityResponse> {
    const headers = this.getHeaders();
    let params = new HttpParams();

    if (filters.category  && filters.category  !== 'all') params = params.set('category',  filters.category);
    if (filters.role      && filters.role      !== 'all') params = params.set('role',      filters.role);
    if (filters.dateRange && filters.dateRange !== 'all') params = params.set('dateRange', filters.dateRange);
    if (filters.sort)    params = params.set('sort',   filters.sort);
    if (filters.search)  params = params.set('search', filters.search);
    if (filters.page)    params = params.set('page',   filters.page.toString());
    if (filters.limit)   params = params.set('limit',  filters.limit.toString());

    return this.http.get<ActivityResponse>(`${this.BASE}/admin/activity`, { headers, params });
  }
}
