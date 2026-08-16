import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from '../../services/auth.service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../constants/auth.constants';
import { IUser } from '../../models/user.model';
import { ProviderSidebarComponent } from './provider-sidebar/provider-sidebar.component';
import { NotificationDropdownComponent } from '../../../shared/components/notification-dropdown/notification-dropdown.component';


/** Approval state shown in the top header status pill. */
type ProviderApproval = 'approved' | 'pending' | 'rejected';

@Component({
  selector: 'app-provider-layout',
  imports: [RouterOutlet, ProviderSidebarComponent, NotificationDropdownComponent],
  templateUrl: './provider-layout.component.html',
  styleUrl: './provider-layout.component.css',
})
export class ProviderLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  /** Controls the mobile sidebar drawer (off-canvas below lg breakpoint). */
  readonly isSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  ngOnInit(): void {
    // Restore the session after a hard refresh (the auth signals are in-memory).
    if (isPlatformBrowser(this.platformId)) {
      this.restoreSession();
    }
  }

  /** Salon / owner name shown in the top header greeting. */
  readonly displaySalonName = computed<string>(() => {
    const user = this.authService.userData();
    return user?.salonName?.trim() || user?.name?.trim() || 'لوحة مزود الخدمة';
  });

  /**
   * Provider approval status for the header pill. Once the provider guard
   * let the user in, a missing value means the account is active → 'approved'.
   */
  readonly providerStatus = computed<ProviderApproval>(() => {
    return this.authService.userData()?.providerStatus ?? 'approved';
  });

  readonly statusLabel = computed<string>(() => {
    switch (this.providerStatus()) {
      case 'pending':
        return 'قيد المراجعة';
      case 'rejected':
        return 'مرفوض';
      case 'approved':
      default:
        return 'نشط';
    }
  });

  readonly statusPillClass = computed<string>(() => {
    switch (this.providerStatus()) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 ring-red-500/30';
      case 'approved':
      default:
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
    }
  });

  /** Clears auth state (cookies + in-memory signals) and returns to login. */
  onLogout(): void {
    this.cookieService.delete(AUTH_TOKEN_COOKIE);
    this.cookieService.delete(AUTH_USER_COOKIE);
    this.authService.token.set(null);
    this.authService.userData.set(null);
    this.authService.userRole.set('client');
    this.closeSidebar();
    this.router.navigateByUrl('/login');
  }

  private restoreSession(): void {
    try {
      if (
        this.cookieService.check(AUTH_TOKEN_COOKIE) &&
        this.cookieService.check(AUTH_USER_COOKIE)
      ) {
        const user = JSON.parse(this.cookieService.get(AUTH_USER_COOKIE)) as IUser;
        this.authService.token.set(this.cookieService.get(AUTH_TOKEN_COOKIE));
        this.authService.userData.set(user);
        this.authService.userRole.set(user.role);
      }
    } catch {
      // Malformed cookie — the provider guard will bounce the user to login.
    }
  }
}

