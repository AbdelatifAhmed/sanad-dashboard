import { Component, Input } from '@angular/core';

/**
 * Reusable empty state component.
 * Usage: <app-empty-state icon="groups" title="No families found" subtitle="Try adjusting filters." />
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-20 text-center px-6">
      <span class="material-symbols-outlined text-[56px] text-outline/30">{{ icon }}</span>
      <h4 class="font-title-lg text-title-lg font-bold text-on-surface mt-3">{{ title }}</h4>
      @if (subtitle) {
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-xs">{{ subtitle }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
