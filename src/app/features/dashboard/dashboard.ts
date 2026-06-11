import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService } from '../../core/services/stats.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, StatCardComponent, ChartCardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  statsService = inject(StatsService);

  // Expose signals to the template
  kpis = this.statsService.kpis;
  recentActivities = this.statsService.recentActivities;
  pendingVerifications = this.statsService.pendingVerifications;
  filteredUsers = this.statsService.filteredUsers;
  totalUsersCount = this.statsService.totalUsersCount;
  familiesPercentage = this.statsService.familiesPercentage;
  caregiversPercentage = this.statsService.caregiversPercentage;

  approve(candidateId: string): void {
    this.statsService.approveVerification(candidateId);
  }

  createBooking(): void {
    this.statsService.addNewBooking();
  }

  viewUser(userName: string): void {
    alert(`Viewing profile details for: ${userName}`);
  }
}
