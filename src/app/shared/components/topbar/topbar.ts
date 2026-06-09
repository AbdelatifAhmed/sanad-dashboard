import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StatsService } from '../../../core/services/stats.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class TopbarComponent {
  statsService = inject(StatsService);
  authService = inject(AuthService);
  router = inject(Router);

  // Bind keyup to search query signal
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.statsService.searchQuery.set(target.value);
  }

  logout(): void {
    this.authService.logout();
  }
}
