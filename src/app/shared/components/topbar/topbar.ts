import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../core/services/layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class TopbarComponent {
  readonly authService  = inject(AuthService);
  readonly layout       = inject(LayoutService);
  readonly router       = inject(Router);
  readonly showLogoutModal = signal<boolean>(false);

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
