import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';

export const handleTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const cookieService = inject(CookieService);
  if (isPlatformBrowser(platformId)) {
    const token = cookieService.get(AUTH_TOKEN_COOKIE);
    if (cookieService.check(AUTH_TOKEN_COOKIE)) {
      const reqClone = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
      return next(reqClone);
    }
  }

  return next(req);
};
