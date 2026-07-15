import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { SocketService } from '../../../core/services/socket.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent implements OnInit, OnDestroy {
  private readonly authService   = inject(AuthService);
  private readonly msgsService   = inject(AdminMessagesService);
  private readonly socketService = inject(SocketService);
  readonly layout                = inject(LayoutService);
  readonly showLogoutModal       = signal<boolean>(false);
  readonly totalUnread           = signal<number>(0);

  private readonly destroy$ = new Subject<void>();

  navItems = [
    { label: 'Dashboard',           route: '/dashboard',  icon: 'dashboard'        },
    { label: 'Caregivers',          route: '/caregivers', icon: 'medical_services' },
    { label: 'Families',            route: '/families',   icon: 'family_restroom'  },
    { label: 'Requests / Bookings', route: '/bookings',   icon: 'event_note'       },
    { label: 'Reviews',             route: '/reviews',    icon: 'reviews'          },
    { label: 'Reports',             route: '/reports',    icon: 'bar_chart'        },
    { label: 'Activity History',    route: '/activity',   icon: 'history'          },
    { label: 'AI Security',         route: '/security',   icon: 'shield'           },
  ];

  ngOnInit(): void {
    this.loadUnreadCount();
    this.listenForNewMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUnreadCount(): void {
    this.msgsService.getConversations('unread', '', 1, 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const total = res.data.conversations.reduce(
            (sum, c) => sum + (c.unreadByAdmin || 0), 0
          );
          this.totalUnread.set(total);
        },
        error: () => { /* non-fatal */ },
      });
  }

  private listenForNewMessages(): void {
    this.socketService.on('adminMessage:new', (msg: any) => {
      if (msg.receiverRole === 'admin') {
        this.totalUnread.update((n) => n + 1);
      }
    });

    this.socketService.on('adminMessage:read', () => {
      // Refresh count periodically — not per read to avoid rate limiting
      this.loadUnreadCount();
    });
  }

  openLogoutModal(event: Event): void {
    event.preventDefault();
    this.layout.closeSidebar();
    this.showLogoutModal.set(true);
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.authService.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}
