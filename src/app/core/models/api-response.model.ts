// ── Generic API Response Wrappers ─────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  status: 'success';
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  status: 'error' | 'fail';
  message: string;
  error?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  status: string;
  results: number;
  pagination: PaginationMeta;
  data: T;
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export interface DashboardKpis {
  globalUsers: number;
  totalFamilies: number;
  totalCompanions: number;
  activeServices: number;
  completedServices: number;
}

export interface DashboardStatsResponse {
  status: string;
  data: {
    kpis: DashboardKpis;
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

// ── Activity Feed ──────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  category: string;
  type: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  relatedId: string;
  relatedModel: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  badgeLabel: string;
  badgeClass: string;
  timestamp: string;
  exactDate: string;
  navigateTo: string;
}

export interface ActivityResponse {
  status: string;
  results: number;
  pagination: PaginationMeta;
  data: { activities: ActivityEvent[] };
}
