import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../../constants/auth.constants';
import { AuthService } from '../../../services/auth.service';

/** A single navigation entry rendered inside the admin sidebar. */
export interface AdminNavLink {
  route: string;
  label: string;
  icon: string;
}

/**
 * Admin Sidebar — navigation shell for the admin dashboard.
 *
 * Renders the Lookak brand header, the main admin navigation links
 * (Dashboard / Users / Bookings / Settings) with `RouterLinkActive`
 * highlighting, plus "return to site" and "logout" actions at the bottom.
 *
 * Responsive behaviour is driven by the admin layout:
 *  - Desktop (lg+): always-visible sticky column.
 *  - Mobile: off-canvas drawer controlled via the `isOpen` input; the
 *    component emits `closed` so the layout can collapse the drawer after
 *    navigating or closing.
 */
@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.css',
})
export class AdminSidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  /** Controls the mobile drawer visibility (driven by the admin layout). */
  readonly isOpen = input(false);

  /** Emitted when the sidebar asks the layout to close the mobile drawer. */
  readonly closed = output<void>();

  readonly navLinks: AdminNavLink[] = [
    { route: '/admin/dashboard', label: 'نظرة عامة', icon: 'pi-home' },
    { route: '/admin/users', label: 'إدارة المستخدمين', icon: 'pi-users' },
    { route: '/admin/bookings', label: 'إدارة الحجوزات', icon: 'pi-calendar' },
    { route: '/admin/notifications', label: 'الإشعارات', icon: 'pi-bell' },
    { route: '/admin/settings', label: 'الإعدادات العامة', icon: 'pi-cog' },
  ];

  /** Close the mobile drawer after navigating to a link. */
  onNavClick(): void {
    this.closed.emit();
  }

  onLogout() {
    this.cookieService.delete('lookak-token');
    this.cookieService.delete(AUTH_USER_COOKIE);
    this.authService.token.set(null);
    this.authService.userData.set(null);
    this.authService.userRole.set('client');
    this.closed.emit();
    this.router.navigateByUrl('/login');
  }
}
