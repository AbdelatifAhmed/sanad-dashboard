import { Injectable, signal, computed } from '@angular/core';

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

@Injectable({
  providedIn: 'root'
})
export class StatsService {
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

  readonly users = signal<User[]>([
    { id: 'usr-1', name: 'Lina Ahmed', initials: 'LA', role: 'Family', status: 'Active' },
    { id: 'usr-2', name: 'Omar Malik', initials: 'OM', role: 'Caregiver', status: 'Pending' },
    { id: 'usr-3', name: 'Sara Yasin', initials: 'SY', role: 'Family', status: 'Active' }
  ]);

  readonly pendingVerifications = signal<CaregiverCandidate[]>([
    {
      id: 'cand-1',
      name: 'Fatima Nour',
      role: 'RN, 5 yrs Experience',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDC4OhyMg1p71s7M-w6qpSHGallZWnDOLRecoTy3UOKBGQ_ljURVLBRkGD5wcVMvCPJjjKo7B1UtBIC8bkUdY8ulYdMfbQUNn_dw_6BCHhjWGQUuRDTV3jW2NfyhTLq9rgyszdRNLQX6LFnTiDqdqvTEsdi4bU_wVfN2OlXi7I6IBWXUqh2a49y7_kEdjTtuF8vDYm0-v5MzKFE0OIBR9r4nkioRgHokvq894RHp-M82j6gp9xrjfXTF5Gr3kCI7Gx3oPfkYfGvQ9eY',
    },
    {
      id: 'cand-2',
      name: 'Zaid Khalil',
      role: 'Specialized Physiotherapist',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDnS9WYjv9cVd_U5mC_Z_qxzAfDZnsIDY3HnNXrmyYno1vZVEdUm1A1Lk1Gjr4oB0VSbZ4cliHP5a6epULKyi72DHVJekAp2XqOAb5dKvuRiBgTgYK-hpMFioNOotKmAb_EZHS8jUKPMy_T-0DLD0PP-URuiAXQiQi1z7VvtlL0nDtdZwfrRfL94f04EOcAwgplJqhnv9xrtegDA_sfowzVOYb1Ho8ydtDrxiHhGW8_Bdh5nKwfADl5dsyZP10-zVZ1NA27i7ZesZ9',
    },
    {
      id: 'cand-3',
      name: 'Hana Bakri',
      role: 'Certified Home Aid',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5eYJ3yH1ihxweqDFDAsO3EZ4mCxsJWgR9aMJHBHPIdDneSU0L-sMvUxtKcGVM4BexeUzIXyuqcsSOEB64mL8Wg8L2J_CdVZy8Dwmv0lwIqBunWc93FtRsXrUJRSR2hakDBW5y1-CpzjycjMV6fgcq66m9FJuM45MlxiKoiiOmKyFcM_gmdYUHtPhPjvn9akkJVHjXl6vZ8ra7JbySizZTcW1qYlyPz7PW8l1q6ef97jwvgDGtC_qnubbfZxiJmzCpBdG7C7kVzVKX',
    }
  ]);

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

      // 3. Update KPIs (increase total users/caregivers, decrease pending count if applicable)
      this.kpis.update(kpis => kpis.map(kpi => {
        if (kpi.id === 'total-caregivers') {
          const rawVal = parseInt(kpi.value.replace(/,/g, ''), 10);
          return { ...kpi, value: (rawVal + 1).toLocaleString() };
        }
        if (kpi.id === 'total-users') {
          const rawVal = parseInt(kpi.value.replace(/,/g, ''), 10);
          return { ...kpi, value: (rawVal + 1).toLocaleString() };
        }
        return kpi;
      }));

      // 4. Add user to the main list
      const newUser: User = {
        id: `usr-${Date.now()}`,
        name: candidate.name,
        initials: candidate.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        role: 'Caregiver',
        status: 'Active'
      };
      this.users.set([newUser, ...this.users()]);
    }
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
}
