import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';
import { NotificationDropdownComponent } from '../../../shared/components/notification-dropdown/notification-dropdown.component';
import { AuthService } from '../../services/auth.service';
import { CookieService } from 'ngx-cookie-service';
import {
  AUTH_TOKEN_COOKIE,
  AUTH_USER_COOKIE,
} from '../../constants/auth.constants';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, AdminSidebarComponent, NotificationDropdownComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  /** Controls the mobile sidebar drawer (off-canvas below lg breakpoint). */
  readonly isSidebarOpen = signal(false);
  authService = inject(AuthService);
  cookieService = inject(CookieService);
  router = inject(Router);

  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
  onLogout(): void {
    this.cookieService.delete(AUTH_TOKEN_COOKIE);
    this.cookieService.delete(AUTH_USER_COOKIE);
    this.authService.token.set(null);
    this.authService.userData.set(null);
    this.authService.userRole.set('client');
    this.closeSidebar();
    this.router.navigateByUrl('/login');
  }
}
