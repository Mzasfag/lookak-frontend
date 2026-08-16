import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../../constants/auth.constants';
import { AuthService } from '../../../services/auth.service';

/** A single navigation entry rendered inside the provider sidebar. */
export interface ProviderNavLink {
  route: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-provider-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './provider-sidebar.component.html',
  styleUrl: './provider-sidebar.component.css',
})
export class ProviderSidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  /** Controls the mobile drawer visibility (driven by the provider layout). */
  readonly isOpen = input(false);

  /** Emitted when the sidebar asks the layout to close the mobile drawer. */
  readonly closed = output<void>();

  readonly navLinks: ProviderNavLink[] = [
    { route: '/provider/bookings', label: 'مواعيد اليوم والحجوزات', icon: 'pi-calendar' },
    { route: '/provider/services', label: 'خدماتي وأسعارها', icon: 'pi-list' },
    { route: '/provider/working-hours', label: 'مواعيد العمل', icon: 'pi-clock' },
    { route: '/provider/notifications', label: 'الإشعارات', icon: 'pi-bell' },
    { route: '/provider/profile', label: 'إعدادات الصالون والمعرض', icon: 'pi-cog' },
  ];

  /** Close the mobile drawer after navigating to a link. */
  onNavClick(): void {
    this.closed.emit();
  }

  /** Clears auth state (cookies + in-memory signals) and returns to login. */
  onLogout() {
    this.cookieService.delete('lookak-token');
    this.cookieService.delete('lookak-user');
    this.authService.token.set(null);
    this.authService.userData.set(null);
    this.authService.userRole.set('client');
    this.closed.emit();
    this.router.navigateByUrl('/login');
  }
}
