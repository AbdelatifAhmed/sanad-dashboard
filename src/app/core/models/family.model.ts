// ── Family Models ─────────────────────────────────────────────────────────────

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

export interface FamilyStats {
  total: number;
  totalActive: number;
  totalSuspended: number;
  totalElderly: number;
  totalActiveRequests: number;
}

export interface FamiliesResponse {
  status: string;
  data: { families: FamilyListEntry[] };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats?: FamilyStats;
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
    location?: unknown;
  };
  profile: FamilyProfile | null;
  requests: JobPostSummary[];
  bookings: BookingSummary[];
  assignedCaregivers: AssignedCaregiver[];
  stats: {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    totalElderly: number;
  };
}

export interface JobPostSummary {
  _id: string;
  title: string;
  description: string;
  serviceType: string;
  budgetPerHour: number;
  status: string;
  createdAt: string;
}

export interface BookingSummary {
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

export interface FamilyDetailsResponse {
  status: string;
  data: FamilyDetailsData;
}
