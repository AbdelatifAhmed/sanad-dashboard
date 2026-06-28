import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  authService = inject(AuthService);
  showLogoutModal = signal<boolean>(false);

  navItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Caregivers', route: '/caregivers', icon: 'medical_services' },
    { label: 'Families', route: '/families', icon: 'family_restroom' },
    { label: 'Requests / Bookings', route: '/bookings', icon: 'event_note' },
    { label: 'Reports', route: '/reports', icon: 'bar_chart' },
    { label: 'Messages', route: '/messages', icon: 'chat' }
  ];

  openLogoutModal(event: Event): void {
    event.preventDefault();
    this.showLogoutModal.set(true);
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.authService.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}
