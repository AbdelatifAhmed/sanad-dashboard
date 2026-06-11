import { Component, Input } from '@angular/core';

export interface BarData {
  label: string;
  height: number;
}

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

  // Data for the Bar Chart
  trendsData: BarData[] = [
    { label: 'Mon', height: 40 },
    { label: 'Tue', height: 55 },
    { label: 'Wed', height: 45 },
    { label: 'Thu', height: 75 },
    { label: 'Fri', height: 95 },
    { label: 'Sat', height: 60 },
    { label: 'Sun', height: 35 },
    { label: 'Mon', height: 50 },
    { label: 'Tue', height: 80 },
    { label: 'Wed', height: 40 }
  ];

  // Data for the Donut Chart
  @Input() familiesPercentage = 0;
  @Input() caregiversPercentage = 0;
  @Input() totalCount: string | number = 0;
}
