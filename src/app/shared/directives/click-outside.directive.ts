import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Emits when a click occurs outside the host element.
 * Usage: <div (clickOutside)="closeMenu()">...</div>
 * Import: ClickOutsideDirective in the component's imports array.
 */
@Directive({
  selector: '[clickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private el: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (target && !this.el.nativeElement.contains(target as Node)) {
      this.clickOutside.emit();
    }
  }
}
