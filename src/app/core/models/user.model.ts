// ── User Models ──────────────────────────────────────────────────────────────

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'family' | 'companion' | 'admin';
  isBanned: boolean;
  avatar?: { url?: string; public_id?: string };
  location?: {
    geo?: { type: string; coordinates: number[] };
    readableAddress?: string;
    city?: string;
    governorate?: string;
  };
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
