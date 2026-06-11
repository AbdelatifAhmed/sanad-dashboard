import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  avatar: string;
  details?: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:5000/api/admin/dashboard/stats';

  constructor() {
    this.loadDashboardStats();
    this.loadRecentUsers();
    this.loadPendingCompanions();
  }

  readonly statsData = signal<DashboardStatsResponse['data'] | null>(null);

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

  // Writable signals for state management
  readonly kpis = signal<KPI[]>([
    {
      id: 'total-users',
      title: 'Total Users',
      value: '12,482',
      change: '+12%',
      trend: 'up',
      icon: 'group',
      iconBg: 'bg-primary-container/10',
      iconColor: 'text-primary'
    },
    {
      id: 'total-families',
      title: 'Total Families',
      value: '8,910',
      change: '+5%',
      trend: 'up',
      icon: 'family_restroom',
      iconBg: 'bg-secondary-container/20',
      iconColor: 'text-secondary'
    },
    {
      id: 'total-caregivers',
      title: 'Total Caregivers',
      value: '3,572',
      change: '+8%',
      trend: 'up',
      icon: 'medical_services',
      iconBg: 'bg-tertiary-container/10',
      iconColor: 'text-tertiary'
    },
    {
      id: 'active-requests',
      title: 'Active Requests',
      value: '158',
      change: '42 New',
      trend: 'neutral',
      icon: 'pending_actions',
      iconBg: 'bg-error-container/20',
      iconColor: 'text-error'
    },
    {
      id: 'completed-bookings',
      title: 'Comp. Bookings',
      value: '45,102',
      change: '98.4%',
      trend: 'up',
      icon: 'task_alt',
      iconBg: 'bg-secondary-container/20',
      iconColor: 'text-secondary'
    }
  ]);

  readonly recentActivities = signal<Activity[]>([
    {
      id: 'act-1',
      title: 'New Registration: Sarah J.',
      description: 'Caregiver registration pending review',
      time: '2 minutes ago',
      type: 'user_add',
      icon: 'person_add',
      iconBg: 'bg-primary-container/20',
      iconColor: 'text-primary'
    },
    {
      id: 'act-2',
      title: 'Request Accepted: James Wilson',
      description: 'Evening care for Elder ID #2241',
      time: '14 minutes ago',
      type: 'booking_ok',
      icon: 'assignment_turned_in',
      iconBg: 'bg-secondary-container/30',
      iconColor: 'text-secondary'
    },
    {
      id: 'act-3',
      title: 'Verification Approved: Mariam A.',
      description: 'Profile now live for client booking',
      time: '1 hour ago',
      type: 'verify_ok',
      icon: 'verified',
      iconBg: 'bg-tertiary-container/20',
      iconColor: 'text-tertiary'
    }
  ]);

  readonly users = signal<User[]>([]);

  readonly pendingVerifications = signal<CaregiverCandidate[]>([]);

  // Writable signal for search queries
  readonly searchQuery = signal<string>('');

  // Computed signal to filter recent users dynamically based on search query
  readonly filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.users();
    if (!query) {
      return list;
    }
    return list.filter(user => 
      user.name.toLowerCase().includes(query) || 
      user.role.toLowerCase().includes(query) || 
      user.status.toLowerCase().includes(query)
    );
  });

  // Action methods to update state dynamically
  approveVerification(candidateId: string): void {
    const token = localStorage.getItem('sanad_admin_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.patch<any>(
      `http://localhost:5000/api/admin/companions/verify-companion/${candidateId}`,
      { status: 'verified' },
      { headers }
    ).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const list = this.pendingVerifications();
          const candidate = list.find(c => c.id === candidateId);
          
          if (candidate) {
            // 1. Remove from pending verifications
            this.pendingVerifications.set(list.filter(c => c.id !== candidateId));

            // 2. Add to recent activities
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

            // 3. Refresh Dashboard KPIs and Users from backend
            this.loadDashboardStats();
            this.loadRecentUsers();
          }
        }
      },
      error: (err) => {
        console.error('Error verifying companion:', err);
      }
    });
  }

  addNewBooking(): void {
    // Increment completed bookings and active requests as a demo trigger
    this.kpis.update(kpis => kpis.map(kpi => {
      if (kpi.id === 'active-requests') {
        const rawVal = parseInt(kpi.value, 10);
        return { ...kpi, value: (rawVal + 1).toString() };
      }
      return kpi;
    }));

    const newAct: Activity = {
      id: `act-${Date.now()}`,
      title: 'New Booking Created',
      description: 'Pending caregiver assignment',
      time: 'Just now',
      type: 'booking_ok',
      icon: 'event_note',
      iconBg: 'bg-primary-container/20',
      iconColor: 'text-primary'
    };
    this.recentActivities.set([newAct, ...this.recentActivities()]);
  }

  loadDashboardStats(): void {
    const token = localStorage.getItem('sanad_admin_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<DashboardStatsResponse>(this.API_URL, { headers }).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.statsData.set(response.data);
          const apiKpis = response.data.kpis;
          this.kpis.update(kpis => kpis.map(kpi => {
            switch (kpi.id) {
              case 'total-users':
                return { ...kpi, value: apiKpis.globalUsers.toLocaleString() };
              case 'total-families':
                return { ...kpi, value: apiKpis.totalFamilies.toLocaleString() };
              case 'total-caregivers':
                return { ...kpi, value: apiKpis.totalCompanions.toLocaleString() };
              case 'active-requests':
                return { ...kpi, value: apiKpis.activeServices.toLocaleString() };
              case 'completed-bookings':
                return { ...kpi, value: apiKpis.completedServices.toLocaleString() };
              default:
                return kpi;
            }
          }));
        }
      },
      error: (err) => {
        console.error('Error loading dashboard stats:', err);
      }
    });
  }

  loadRecentUsers(): void {
    const token = localStorage.getItem('sanad_admin_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<AdminUsersResponse>('http://localhost:5000/api/admin/users', { headers }).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const filteredSorted = response.users
            .filter(u => u.role !== 'admin')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const mappedUsers: User[] = filteredSorted.map(u => ({
            id: u._id,
            name: u.name,
            initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            role: u.role,
            status: u.isBanned ? 'Banned' : 'Active'
          }));

          this.users.set(mappedUsers);
        }
      },
      error: (err) => {
        console.error('Error loading recent users:', err);
      }
    });
  }

  loadPendingCompanions(): void {
    const token = localStorage.getItem('sanad_admin_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<PendingCompanionsResponse>('http://localhost:5000/api/admin/companions/pending-companions', { headers }).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const companions = response.data.pendingCompanions;
          const mapped: CaregiverCandidate[] = companions.map(c => ({
            id: c._id,
            name: c.userId ? c.userId.name : 'Unknown User',
            role: c.specialization && c.specialization !== 'none' ? c.specialization : c.companionType,
            avatar: c.userId ? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.userId.name)}&background=006767&color=fff&size=128` : 'https://ui-avatars.com/api/?name=U&background=006767&color=fff&size=128',
            details: c.bio
          }));
          this.pendingVerifications.set(mapped);
        }
      },
      error: (err) => {
        console.error('Error loading pending companions:', err);
      }
    });
  }
}
