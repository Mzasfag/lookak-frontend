import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';
import { NotificationDropdownComponent } from '../../../shared/components/notification-dropdown/notification-dropdown.component';


@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, AdminSidebarComponent, NotificationDropdownComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  /** Controls the mobile sidebar drawer (off-canvas below lg breakpoint). */
  readonly isSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}
