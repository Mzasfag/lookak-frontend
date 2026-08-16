import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

import { AuthService } from '../../services/auth.service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../constants/auth.constants';
import { ClientSidebarComponent } from './client-sidebar/client-sidebar.component';
import { NotificationDropdownComponent } from '../../../shared/components/notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-client-layout',
  imports: [RouterOutlet, ClientSidebarComponent, NotificationDropdownComponent],
  templateUrl: './client-layout.component.html',
  styleUrl: './client-layout.component.css',
})
export class ClientLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Controls mobile drawer open state. */
  readonly isSidebarOpen = signal(false);

  constructor() {
    // Automatically close sidebar on mobile when navigating to a new route
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.closeSidebar();
      });
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  readonly displayName = computed<string>(() => {
    return this.authService.userData()?.name?.trim() || 'عميل';
  });

  readonly userInitial = computed<string>(() => {
    const name = this.displayName();
    return name.charAt(0).toUpperCase();
  });

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

