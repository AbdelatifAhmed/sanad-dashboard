import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  navItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Users (Families)', route: '/users', icon: 'group' },
    { label: 'Caregivers', route: '/caregivers', icon: 'medical_services' },
    { label: 'Requests / Bookings', route: '/bookings', icon: 'event_note' },
    { label: 'Reports', route: '/reports', icon: 'bar_chart' },
    { label: 'Messages', route: '/messages', icon: 'chat' }
  ];
}
