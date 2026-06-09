import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Redirect root to dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // Login page (public)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent),
    title: 'Sanad Admin — Sign In'
  },

  // Admin layout shell (protected)
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
        title: 'Sanad Admin — Dashboard'
      },
      // Placeholder routes for future pages (match sidebar nav items)
      {
        path: 'users',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Users'
      },
      {
        path: 'caregivers',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Caregivers'
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Bookings'
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Reports'
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Messages'
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
        title: 'Sanad Admin — Settings'
      }
    ]
  },

  // Wildcard — redirect unknown paths to login
  {
    path: '**',
    redirectTo: 'login'
  }
];
