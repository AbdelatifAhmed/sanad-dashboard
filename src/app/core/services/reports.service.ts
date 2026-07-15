import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ── Period types ───────────────────────────────────────────────────────────────

export type ReportPeriod =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'allTime';

export interface PeriodOption {
  value: ReportPeriod;
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'today',     label: 'Today'        },
  { value: 'yesterday', label: 'Yesterday'    },
  { value: 'last7',     label: 'Last 7 Days'  },
  { value: 'last30',    label: 'Last 30 Days' },
  { value: 'last90',    label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month'   },
  { value: 'lastMonth', label: 'Last Month'   },
  { value: 'thisYear',  label: 'This Year'    },
  { value: 'allTime',   label: 'All Time'     },
];

// ── Models ────────────────────────────────────────────────────────────────────

export interface ReportKpis {
  totalRevenue:         number;
  avgBookingValue:      number;
  outstandingPayments:  number;
  pendingPaymentsCount: number;
  completedBookings:    number;
  activeBookings:       number;
  pendingBookings:      number;
  totalBookings:        number;
  newFamilies:          number;
  newCaregivers:        number;
  totalFamilies:        number;
  totalCaregivers:      number;
}

export interface WeekPoint {
  week:  string;
  count: number;
}

export interface GrowthTrends {
  bookings: WeekPoint[];
  users:    WeekPoint[];
}

export interface ServiceDistributionItem {
  type:       string;
  label:      string;
  count:      number;
  percentage: number;
}

export interface CaregiverPerformanceItem {
  _id:            string;
  name:           string;
  avatar:         string | null;
  specialization: string;
  totalWorkHours: number;
  rating:         number;
  reviewCount:    number;
  reliability:    'Exemplary' | 'High' | 'Medium' | 'Standard';
  status:         string;
}

export interface GeographicInsight {
  city:     string;
  bookings: number;
}

export interface ReportPeriodInfo {
  start: string;
  end:   string;
}

export interface ReportsData {
  period:              ReportPeriodInfo;
  kpis:                ReportKpis;
  growthTrends:        GrowthTrends;
  serviceDistribution: ServiceDistributionItem[];
  caregiverPerformance: CaregiverPerformanceItem[];
  geographicInsights:  GeographicInsight[];
}

export interface ReportsResponse {
  status: string;
  data:   ReportsData;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http        = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly BASE        = environment.apiBaseUrl;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getReports(period: ReportPeriod = 'last30'): Observable<ReportsResponse> {
    const params = new HttpParams().set('period', period);
    return this.http.get<ReportsResponse>(
      `${this.BASE}/admin/reports`,
      { headers: this.getHeaders(), params }
    );
  }
}
