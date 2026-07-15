import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';


// ─── Shared UI Interfaces ───────────────────────────────────────────────────

export interface KPI {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
  iconBg: string;
  iconColor: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'user_add' | 'booking_ok' | 'verify_ok' | 'default';
  icon: string;
  iconBg: string;
  iconColor: string;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: 'Active' | 'Pending' | 'Banned';
}

export interface CaregiverCandidate {
  id: string;
  name: string;
  role: string;
  avatar: string;       // real Cloudinary URL or fallback generated avatar
  hasRealAvatar: boolean;
  details?: string;
}

export interface BarData {
  label: string;
  height: number;
  count: number;
}

// ─── API Response Interfaces ─────────────────────────────────────────────────

export interface DashboardStatsResponse {
  status: string;
  data: {
    kpis: {
      globalUsers: number;
      totalFamilies: number;
      totalCompanions: number;
      activeServices: number;
      completedServices: number;
    };
    companionsBreakdown: {
      verified: number;
      pendingOnboarding: number;
      underReview: number;
      rejected: number;
    };
    bookingsBreakdown: {
      pendingApproval: number;
      inProgress: number;
      completed: number;
      totalRequests: number;
    };
  };
}

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResponse {
  status: string;
  users: ApiUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ApiPendingCompanion {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    avatar?: { url?: string; public_id?: string } | null;
  };
  companionType: string;
  specialization: string;
  bio: string;
  hourlyRate: number;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingCompanionsResponse {
  status: string;
  results: number;
  data: {
    pendingCompanions: ApiPendingCompanion[];
  };
}

export interface ApiBooking {
  _id: string;
  familyId?: { _id: string; name: string; email: string };
  companionId?: { _id: string; name: string; email: string };
  status: string;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingsResponse {
  status: string;
  results: number;
  data: {
    bookings: ApiBooking[];
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly BASE = 'http://localhost:5000/api';

  // ── Loading & Error Signals ────────────────────────────────────────────────
  readonly isLoading      = signal<boolean>(true);
  readonly pendingLoading = signal<boolean>(true);
  readonly statsError     = signal<string | null>(null);

  // ── Raw API Data Signals ───────────────────────────────────────────────────
  readonly statsData = signal<DashboardStatsResponse['data'] | null>(null);

  // ── Derived KPI Signals ────────────────────────────────────────────────────
  readonly kpis = signal<KPI[]>([
    {
      id: 'total-users',
      title: 'Total Users',
      value: '—',
      change: '',
      trend: 'neutral',
      icon: 'group',
      iconBg: 'bg-primary-container/10',
      iconColor: 'text-primary'
    },
    {
      id: 'total-families',
      title: 'Total Families',
      value: '—',
      change: '',
      trend: 'up',
      icon: 'family_restroom',
      iconBg: 'bg-secondary-container/20',
      iconColor: 'text-secondary'
    },
    {
      id: 'total-caregivers',
      title: 'Total Caregivers',
      value: '—',
      change: '',
      trend: 'up',
      icon: 'medical_services',
      iconBg: 'bg-tertiary-container/10',
      iconColor: 'text-tertiary'
    },
    {
      id: 'active-requests',
      title: 'Active Requests',
      value: '—',
      change: '',
      trend: 'neutral',
      icon: 'pending_actions',
      iconBg: 'bg-error-container/20',
      iconColor: 'text-error'
    },
    {
      id: 'completed-bookings',
      title: 'Completed Bookings',
      value: '—',
      change: '',
      trend: 'up',
      icon: 'task_alt',
      iconBg: 'bg-secondary-container/20',
      iconColor: 'text-secondary'
    }  ]);

  // ── Distribution Chart Computed Signals ────────────────────────────────────
  readonly totalUsersCount = computed(() => {
    const data = this.statsData();
    return data ? data.kpis.globalUsers.toLocaleString() : '0';
  });

  readonly familiesPercentage = computed(() => {
    const data = this.statsData();
    if (!data) return 0;
    const total = data.kpis.totalFamilies + data.kpis.totalCompanions;
    if (total === 0) return 0;
    return parseFloat(((data.kpis.totalFamilies / total) * 100).toFixed(1));
  });

  readonly caregiversPercentage = computed(() => {
    const data = this.statsData();
    if (!data) return 0;
    const total = data.kpis.totalFamilies + data.kpis.totalCompanions;
    if (total === 0) return 0;
    return parseFloat(((data.kpis.totalCompanions / total) * 100).toFixed(1));
  });

  // ── Trends Chart Signal ────────────────────────────────────────────────────
  readonly trendsData = signal<BarData[]>([]);

  // ── Activity Feed Signal ───────────────────────────────────────────────────
  readonly recentActivities = signal<Activity[]>([]);

  // ── Users Table Signals ────────────────────────────────────────────────────
  readonly users = signal<User[]>([]);
  readonly searchQuery = signal<string>('');
  readonly filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.users();
    if (!query) return list;
    return list.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.status.toLowerCase().includes(query)
    );
  });

  // ── Pending Verifications Signal ───────────────────────────────────────────
  readonly pendingVerifications = signal<CaregiverCandidate[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor is intentionally empty — loadAll() is called explicitly by
  // DashboardComponent.ngOnInit() AFTER the auth guard confirms a valid session.
  constructor() {}

  // Prevents concurrent or repeated calls while a fetch is already in-flight
  private _loading = false;

  // ── Private Helpers ────────────────────────────────────────────────────────
  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  // ── Load Everything in Parallel ────────────────────────────────────────────
  loadAll(isRetry = false): void {
    // Prevent concurrent in-flight calls
    if (this._loading && !isRetry) return;

    // Guard: if no token exists, redirect to login
    const token = this.authService.getToken();
    if (!token) {
      console.warn('StatsService: no auth token found, redirecting to login.');
      this.router.navigate(['/login']);
      return;
    }

    this._loading = true;
    this.isLoading.set(true);
    this.pendingLoading.set(true);
    this.statsError.set(null);

    const headers = this.getHeaders();

    forkJoin({
      stats:    this.http.get<DashboardStatsResponse>(`${this.BASE}/admin/dashboard/stats`, { headers, withCredentials: true }),
      users:    this.http.get<AdminUsersResponse>(`${this.BASE}/admin/users`, { headers, withCredentials: true }),
      pending:  this.http.get<PendingCompanionsResponse>(`${this.BASE}/admin/companions/pending-companions`, { headers, withCredentials: true }),
      bookings: this.http.get<AdminBookingsResponse>(`${this.BASE}/admin/bookings?limit=10`, { headers, withCredentials: true })
    }).subscribe({
      next: ({ stats, users, pending, bookings }) => {
        // ── Stats / KPIs ──────────────────────────────────────────────────
        if (stats.status === 'success') {
          this.statsData.set(stats.data);
          const kpi = stats.data.kpis;
          const bd  = stats.data.bookingsBreakdown;

          this.kpis.update(list => list.map(k => {
            switch (k.id) {
              case 'total-users':
                return { ...k, value: kpi.globalUsers.toLocaleString(), change: 'Total platform users', trend: 'neutral' as const };
              case 'total-families':
                return { ...k, value: kpi.totalFamilies.toLocaleString(), change: '+families', trend: 'up' as const };
              case 'total-caregivers':
                return { ...k, value: kpi.totalCompanions.toLocaleString(), change: '+caregivers', trend: 'up' as const };
              case 'active-requests':
                return { ...k, value: kpi.activeServices.toLocaleString(), change: `${bd.pendingApproval} Pending`, trend: 'neutral' as const };
              case 'completed-bookings':
                return { ...k, value: bd.completed.toLocaleString(), change: '', trend: 'up' as const };
              default:
                return k;
            }
          }));

          // Build trends bar chart from bookings breakdown
          const total = bd.totalRequests || 1;
          this.trendsData.set([
            { label: 'Pending',   height: Math.round((bd.pendingApproval / total) * 100), count: bd.pendingApproval },
            { label: 'Active',    height: Math.round((bd.inProgress      / total) * 100), count: bd.inProgress },
            { label: 'Completed', height: Math.round((bd.completed       / total) * 100), count: bd.completed },
          ]);
        }

        // ── Users Table ───────────────────────────────────────────────────
        if (users.status === 'success') {
          const filteredSorted = users.users
            .filter(u => u.role !== 'admin')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          this.users.set(filteredSorted.map(u => ({
            id: u._id,
            name: u.name,
            initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            role: u.role,
            status: u.isBanned ? 'Banned' : 'Active'
          })));

          // ── Activity Feed (users portion) ─────────────────────────────
          const userActivities: (Activity & { _date: Date })[] = filteredSorted
            .slice(0, 6)
            .map(u => ({
              id: `user-${u._id}`,
              title: `New Registration: ${u.name}`,
              description: `${u.role === 'companion' ? 'Caregiver' : 'Family'} account created`,
              time: timeAgo(u.createdAt),
              type: 'user_add' as const,
              icon: 'person_add',
              iconBg: 'bg-primary-container/20',
              iconColor: 'text-primary',
              _date: new Date(u.createdAt)
            }));

          // ── Activity Feed (bookings portion) ──────────────────────────
          const bookingActivities: (Activity & { _date: Date })[] = (bookings.status === 'success' && bookings.data?.bookings)
            ? bookings.data.bookings.slice(0, 6).map(b => {
                const familyName = b.familyId?.name ?? 'A family';
                let title = '';
                let description = '';
                let icon = 'event_note';
                let iconBg = 'bg-secondary-container/30';
                let iconColor = 'text-secondary';
                let type: Activity['type'] = 'booking_ok';

                switch (b.status) {
                  case 'completed':
                    title = `Booking Completed`;
                    description = `${familyName} — session finished`;
                    icon = 'task_alt';
                    iconBg = 'bg-tertiary-container/20';
                    iconColor = 'text-tertiary';
                    type = 'verify_ok';
                    break;
                  case 'approved':
                  case 'active':
                    title = `Booking Approved`;
                    description = `${familyName} — session in progress`;
                    icon = 'assignment_turned_in';
                    break;
                  case 'pending':
                  case 'pending_payment':
                    title = `New Care Request`;
                    description = `${familyName} — awaiting assignment`;
                    icon = 'pending_actions';
                    iconBg = 'bg-error-container/20';
                    iconColor = 'text-error';
                    break;
                  case 'cancelled':
                    title = `Booking Cancelled`;
                    description = `${familyName} — request withdrawn`;
                    icon = 'cancel';
                    iconBg = 'bg-error-container/20';
                    iconColor = 'text-error';
                    break;
                  default:
                    title = `Booking Updated`;
                    description = `${familyName}`;
                }

                return {
                  id: `booking-${b._id}`,
                  title,
                  description,
                  time: timeAgo(b.createdAt),
                  type,
                  icon,
                  iconBg,
                  iconColor,
                  _date: new Date(b.createdAt)
                };
              })
            : [];

          // Merge, sort newest first, keep top 6
          const merged = [...userActivities, ...bookingActivities]
            .sort((a, b) => b._date.getTime() - a._date.getTime())
            .slice(0, 6)
            .map(({ _date, ...rest }) => rest);

          this.recentActivities.set(merged);
        }

        // ── Pending Companions ─────────────────────────────────────────────
        if (pending.status === 'success') {
          this.pendingVerifications.set(
            pending.data.pendingCompanions.map(c => {
              const realAvatarUrl = c.userId?.avatar?.url ?? null;
              const fallbackUrl = c.userId
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.userId.name)}&background=006767&color=fff&size=128`
                : `https://ui-avatars.com/api/?name=U&background=006767&color=fff&size=128`;
              return {
                id: c._id,
                name: c.userId ? c.userId.name : 'Unknown User',
                role: c.specialization && c.specialization !== 'none' ? c.specialization : c.companionType,
                avatar: realAvatarUrl ?? fallbackUrl,
                hasRealAvatar: !!realAvatarUrl,
                details: c.bio
              };
            })
          );
        }

        this._loading = false;
        this.isLoading.set(false);
        this.pendingLoading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);

        if (err?.status === 401 && !isRetry) {
          this.authService.refreshToken().subscribe({
            next: () => {
              this._loading = false;
              this.loadAll(true);
            },
            error: () => {
              this._loading = false;
              this.isLoading.set(false);
              this.pendingLoading.set(false);
            }
          });
          return;
        }

        const msg = err?.status === 401
          ? 'Session expired. Please log in again.'
          : 'Failed to load dashboard data. Please try again.';
        this.statsError.set(msg);
        this._loading = false;
        this.isLoading.set(false);
        this.pendingLoading.set(false);
      }
    });
  }

  // ── Reload Stats Only (after approve/reject) ───────────────────────────────
  private refreshStats(): void {
    const headers = this.getHeaders();
    this.http.get<DashboardStatsResponse>(`${this.BASE}/admin/dashboard/stats`, { headers }).subscribe({
      next: (stats) => {
        if (stats.status === 'success') {
          this.statsData.set(stats.data);
          const kpi = stats.data.kpis;
          const bd  = stats.data.bookingsBreakdown;
          this.kpis.update(list => list.map(k => {
            switch (k.id) {
              case 'total-users':       return { ...k, value: kpi.globalUsers.toLocaleString() };
              case 'total-families':    return { ...k, value: kpi.totalFamilies.toLocaleString() };
              case 'total-caregivers':  return { ...k, value: kpi.totalCompanions.toLocaleString() };
              case 'active-requests':   return { ...k, value: kpi.activeServices.toLocaleString(), change: `${bd.pendingApproval} Pending` };
              case 'completed-bookings':return { ...k, value: bd.completed.toLocaleString(), change: '' };
              default: return k;
            }
          }));
        }
      }
    });
  }

  // ── Approve Companion ──────────────────────────────────────────────────────
  approveVerification(candidateId: string): void {
    const headers = this.getHeaders();

    this.http.patch<any>(
      `${this.BASE}/admin/companions/verify-companion/${candidateId}`,
      { status: 'verified' },
      { headers }
    ).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const list = this.pendingVerifications();
          const candidate = list.find(c => c.id === candidateId);

          if (candidate) {
            this.pendingVerifications.set(list.filter(c => c.id !== candidateId));

            const newAct: Activity = {
              id: `act-${Date.now()}`,
              title: `Verification Approved: ${candidate.name}`,
              description: `${candidate.role} is now active for bookings`,
              time: 'Just now',
              type: 'verify_ok',
              icon: 'verified',
              iconBg: 'bg-tertiary-container/20',
              iconColor: 'text-tertiary'
            };
            this.recentActivities.set([newAct, ...this.recentActivities()]);
            this.refreshStats();
          }
        }
      },
      error: (err) => console.error('Error approving companion:', err)
    });
  }

  // ── Reject Companion ───────────────────────────────────────────────────────
  rejectVerification(candidateId: string): void {
    const headers = this.getHeaders();

    this.http.patch<any>(
      `${this.BASE}/admin/companions/verify-companion/${candidateId}`,
      { status: 'rejected' },
      { headers }
    ).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const list = this.pendingVerifications();
          const candidate = list.find(c => c.id === candidateId);

          if (candidate) {
            this.pendingVerifications.set(list.filter(c => c.id !== candidateId));

            const newAct: Activity = {
              id: `act-${Date.now()}`,
              title: `Verification Rejected: ${candidate.name}`,
              description: `Profile has been declined`,
              time: 'Just now',
              type: 'default',
              icon: 'cancel',
              iconBg: 'bg-error-container/20',
              iconColor: 'text-error'
            };
            this.recentActivities.set([newAct, ...this.recentActivities()]);
            this.refreshStats();
          }
        }
      },
      error: (err) => console.error('Error rejecting companion:', err)
    });
  }

  // ── Backward compat alias ──────────────────────────────────────────────────
  loadDashboardStats(): void { this.refreshStats(); }
}
