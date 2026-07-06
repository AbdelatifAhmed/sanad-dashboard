import { Injectable, signal } from '@angular/core';

/**
 * Shared service for layout state — primarily the mobile sidebar toggle.
 * Components inject this to open/close the sidebar without direct parent-child coupling.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal<boolean>(false);

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
