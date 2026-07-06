import {
  Directive, Input, HostListener,
  ComponentRef, ApplicationRef, inject,
  createComponent, EnvironmentInjector, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

// ── Tooltip host component ───────────────────────────────────────────────────
@Component({
  selector: 'app-tooltip-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium shadow-lg whitespace-nowrap"
      [style.top.px]="top" [style.left.px]="left">
      {{ text }}
    </div>
  `,
})
export class TooltipHostComponent {
  text = '';
  top = 0;
  left = 0;
}

/**
 * Lightweight tooltip directive.
 * Usage: <button tooltip="Delete this record">...</button>
 * Import: TooltipDirective in the component's imports array.
 */
@Directive({
  selector: '[tooltip]',
  standalone: true,
})
export class TooltipDirective {
  @Input('tooltip') text = '';

  private tooltipRef: ComponentRef<TooltipHostComponent> | null = null;
  private readonly el = inject(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  @HostListener('mouseenter')
  show(): void {
    if (!this.text) return;
    const rect: DOMRect = this.el.nativeElement.getBoundingClientRect();
    this.tooltipRef = createComponent(TooltipHostComponent, {
      environmentInjector: this.injector,
    });
    this.tooltipRef.instance.text = this.text;
    this.tooltipRef.instance.top  = rect.bottom + 6;
    this.tooltipRef.instance.left = rect.left + rect.width / 2;
    this.appRef.attachView(this.tooltipRef.hostView);
    document.body.appendChild(
      (this.tooltipRef.hostView as any).rootNodes[0] as HTMLElement
    );
  }

  @HostListener('mouseleave')
  hide(): void {
    if (this.tooltipRef) {
      this.appRef.detachView(this.tooltipRef.hostView);
      this.tooltipRef.destroy();
      this.tooltipRef = null;
    }
  }
}
