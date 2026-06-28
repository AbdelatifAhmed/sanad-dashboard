import { Component, Input } from '@angular/core';
import { KPI } from '../../../core/services/stats.service';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css'
})
export class StatCardComponent {
  @Input({ required: true }) kpi!: KPI;
  @Input() isLoading: boolean = false;
}
