import { Component, Input } from '@angular/core';
import type { BarData } from '../../../core/services/stats.service';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [],
  templateUrl: './chart-card.html',
  styleUrl: './chart-card.css'
})
export class ChartCardComponent {
  @Input({ required: true }) type: 'trends' | 'distribution' = 'trends';
  @Input() title: string = '';
  @Input() isLoading: boolean = false;

  // Live trends data from parent — parent is responsible for supplying real values
  @Input() trendsData: BarData[] = [];

  // Data for the Donut Chart
  @Input() familiesPercentage = 0;
  @Input() caregiversPercentage = 0;
  @Input() totalCount: string | number = 0;
}
