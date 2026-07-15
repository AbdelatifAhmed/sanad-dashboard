import { Component, Input } from '@angular/core';

/**
 * Centred loading spinner with optional message.
 * Usage: <app-loading-spinner message="Loading families..." />
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="border-4 border-primary border-t-transparent rounded-full animate-spin"
        [style.width.px]="size" [style.height.px]="size"></div>
      @if (message) {
        <p class="font-body-sm text-body-sm text-on-surface-variant font-medium">{{ message }}</p>
      }
    </div>
  `,
})
export class LoadingSpinnerComponent {
  @Input() message?: string;
  @Input() size = 40;
}
