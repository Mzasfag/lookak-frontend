import { inject, PLATFORM_ID } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from '../services/auth.service';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../constants/auth.constants';
import { IUser } from '../models/user.model';

// admin guard
export const adminGuard: CanActivateFn = (route, state) => {
  const cookieService = inject(CookieService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (isPlatformBrowser(platformId)) {
    const token = cookieService.check(AUTH_TOKEN_COOKIE);
    const userData: IUser = JSON.parse(cookieService.get(AUTH_USER_COOKIE));
    if (!token) {
      return router.createUrlTree(['/login']);
    }

    if (token && userData.role == 'admin') {
      return true;
    }

    if (token && userData.role !== 'admin') {
      return router.createUrlTree(['/forbidden']);
    }
  }

  return router.createUrlTree(['/login']);
};
