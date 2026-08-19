import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';

import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../../constants/auth.constants';
import { AuthService } from '../../../services/auth.service';
import { IUser } from '../../../models/user.model';
import { isPlatformBrowser } from '@angular/common';

export interface ClientNavLink {
  route: string;
  label: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'app-client-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './client-sidebar.component.html',
  styleUrl: './client-sidebar.component.css',
})
export class ClientSidebarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly user = signal<IUser | null>(null);

  readonly userName = computed(() => this.user()?.name?.trim() || 'العميل');

  readonly userPhoneOrEmail = computed(
    () => this.user()?.phone?.trim() || this.user()?.email?.trim() || 'حساب عميل',
  );

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const hasToken = this.cookieService.check(AUTH_TOKEN_COOKIE);
      if (hasToken) {
        const userData: IUser | null =
          JSON.parse(this.cookieService.get(AUTH_USER_COOKIE)) || this.authService.userData();
        this.user.set(userData);
      }
    }
  }

  readonly navLinks: ClientNavLink[] = [
    { route: '/client/dashboard', label: 'لوحة التحكم', icon: 'pi-home', exact: true },
    { route: '/client/providers', label: 'تصفح مزودي الخدمة', icon: 'pi-search', exact: false },
    { route: '/client/bookings', label: 'حجوزاتي', icon: 'pi-calendar', exact: false },
    { route: '/client/notifications', label: 'الإشعارات', icon: 'pi-bell', exact: false },
    { route: '/client/profile', label: 'الملف الشخصي', icon: 'pi-user', exact: false },
  ];

  onNavClick(): void {
    this.closed.emit();
  }

  onLogout(): void {
    this.cookieService.delete(AUTH_TOKEN_COOKIE);
    this.cookieService.delete(AUTH_USER_COOKIE);
    this.authService.token.set(null);
    this.authService.userData.set(null);
    this.authService.userRole.set('client');
    this.closed.emit();
    this.router.navigateByUrl('/login');
  }
}
