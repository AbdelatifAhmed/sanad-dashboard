import { Component, OnInit, inject } from '@angular/core';
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
export class DashboardComponent implements OnInit {
  statsService = inject(StatsService);

  // ── KPI & Chart Signals ────────────────────────────────────────────────────
  kpis                 = this.statsService.kpis;
  trendsData           = this.statsService.trendsData;
  familiesPercentage   = this.statsService.familiesPercentage;
  caregiversPercentage = this.statsService.caregiversPercentage;
  totalUsersCount      = this.statsService.totalUsersCount;

  // ── Loading & Error Signals ────────────────────────────────────────────────
  isLoading      = this.statsService.isLoading;
  usersLoading   = this.statsService.usersLoading;
  pendingLoading = this.statsService.pendingLoading;
  statsError     = this.statsService.statsError;

  // ── List Signals ───────────────────────────────────────────────────────────
  recentActivities     = this.statsService.recentActivities;
  pendingVerifications = this.statsService.pendingVerifications;
  filteredUsers        = this.statsService.filteredUsers;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Called here — after the auth guard has already confirmed a valid session,
    // so the token is guaranteed to be present in localStorage.
    this.statsService.loadAll();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  approve(candidateId: string): void {
    this.statsService.approveVerification(candidateId);
  }

  reject(candidateId: string): void {
    this.statsService.rejectVerification(candidateId);
  }

  createBooking(): void {
    this.statsService.addNewBooking();
  }

  viewUser(userName: string): void {
    alert(`Viewing profile details for: ${userName}`);
  }

  retryLoad(): void {
    this.statsService.loadAll();
  }
}
