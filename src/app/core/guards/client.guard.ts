import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../constants/auth.constants';
import { IUser } from '../models/user.model';

export const clientGuard: CanActivateFn = (_route, _state) => {
  const cookieService = inject(CookieService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  // SSR/prerender: the cookie store is not available — let the route render.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (!cookieService.check(AUTH_TOKEN_COOKIE)) {
    return router.createUrlTree(['/login']);
  }

  try {
    const userData = JSON.parse(cookieService.get(AUTH_USER_COOKIE)) as IUser;

    if (userData.role !== 'client') {
      return router.createUrlTree(['/forbidden']);
    }

    return true;
  } catch {
    return router.createUrlTree(['/login']);
  }
};
