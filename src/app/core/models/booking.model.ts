// ── Booking Models ────────────────────────────────────────────────────────────

export interface Booking {
  _id: string;
  familyId?: { _id: string; name: string; email: string };
  companionId?: { _id: string; name: string; email: string };
  jobPostId?: string;
  status: 'pending' | 'pending_payment' | 'approved' | 'active' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  totalHours: number;
  totalPrice: number;
  hourlyRateAtBooking: number;
  adminFee: number;
  companionEarnings: number;
  startDate: string;
  endDate: string;
  workingDays: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingsResponse {
  status: string;
  results: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  data: { bookings: Booking[] };
}
