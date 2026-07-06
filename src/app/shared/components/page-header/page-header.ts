import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable page header with title, subtitle, and optional right-side content slot.
 * Usage: <app-page-header title="Family Management" subtitle="Review accounts..." />
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pb-5 mb-6 border-b border-outline-variant/30 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 class="font-headline-md text-headline-md text-on-surface font-bold">{{ title }}</h2>
        @if (subtitle) {
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{{ subtitle }}</p>
        }
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
