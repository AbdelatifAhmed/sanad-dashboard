import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Redirect root to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Public: Login
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent),
    title: 'Sanad Admin — Sign In',
  },

  // Protected shell — all admin pages live here
  {
    path: '',
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout').then(
        (m) => m.AdminLayoutComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Dashboard',
      },
      {
        path: 'caregivers',
        loadComponent: () =>
          import('./features/caregiver-verification/caregiver-verification').then(
            (m) => m.CaregiverVerificationComponent
          ),
        title: 'Sanad Admin — Caregiver Verification',
      },
      {
        path: 'caregivers/:id',
        loadComponent: () =>
          import('./features/caregiver-details/caregiver-details.component').then(
            (m) => m.CaregiverDetailsComponent
          ),
        title: 'Sanad Admin — Caregiver Details',
      },
      {
        path: 'families',
        loadComponent: () =>
          import('./features/family-management/family-list/family-list.component').then(
            (m) => m.FamilyListComponent
          ),
        title: 'Sanad Admin — Family Management',
      },
      {
        path: 'families/:id',
        loadComponent: () =>
          import('./features/family-management/family-details/family-details.component').then(
            (m) => m.FamilyDetailsComponent
          ),
        title: 'Sanad Admin — Family Details',
      },
      {
        path: 'activity',
        loadComponent: () =>
          import('./features/activity-history/activity-history.component').then(
            (m) => m.ActivityHistoryComponent
          ),
        title: 'Sanad Admin — Activity History',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
        title: 'Sanad Admin — Settings',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            (m) => m.ReportsComponent
          ),
        title: 'Sanad Admin — Reports & Analytics',
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/reviews/reviews.component').then(
            (m) => m.ReviewsComponent
          ),
        title: 'Sanad Admin — Reviews Management',
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/security/security.component').then(
            (m) => m.SecurityComponent
          ),
        title: 'Sanad Admin — Security & AI Monitoring',
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/bookings/bookings.component').then(
            (m) => m.BookingsComponent
          ),
        title: 'Sanad Admin — Requests & Bookings',
      },
      {
        path: 'bookings/:id',
        loadComponent: () =>
          import('./features/bookings/booking-details/booking-details.component').then(
            (m) => m.BookingDetailsComponent
          ),
        title: 'Sanad Admin — Booking Details',
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/messages/messages.component').then(
            (m) => m.MessagesComponent
          ),
        title: 'Sanad Admin — Messages',
      },
      // ── Routes not yet implemented ────────────────────────────────────────
      { path: 'users', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Wildcard
  { path: '**', redirectTo: 'login' },
];
