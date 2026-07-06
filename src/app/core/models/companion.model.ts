// ── Companion / Caregiver Models ─────────────────────────────────────────────

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

export interface SkillDetails {
  _id: string;
  nameAr: string;
  nameEn: string;
  category: string;
}

export interface AvailabilitySlot {
  day: string;
  slots: string[];
}

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
  data: { companion: CompanionProfile };
}

export interface PendingCompanion {
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
  data: { pendingCompanions: PendingCompanion[] };
}
