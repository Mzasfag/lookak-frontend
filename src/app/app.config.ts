import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import Lara from '@primeuix/themes/lara';
import { MessageService } from 'primeng/api';
import { CookieService } from 'ngx-cookie-service';
import { loadingInterceptor } from './core/interceptors/loading-interceptor.interceptor';
import { handleTokenInterceptor } from './core/interceptors/handle-token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    CookieService,
    provideRouter(routes),
    provideClientHydration(),
    MessageService,
    provideHttpClient(withInterceptors([handleTokenInterceptor, loadingInterceptor])),
    providePrimeNG({
      license:
        'eyJpZCI6ImYwYzc0MmE2LWFhMWUtNGJlYS04NzNiLTNlOTA3ODNjMzM2MiIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODUwMjQwOTksImV4cCI6MTgxNjU2MDA5OX0.6RX1AMaXf5kW3ICxYpVGdG5Tgrm4f31JmFu3lLoS8VWeW2TbUOo64T6pb1BqjOvtwnk2Q5dMHfXWucNEGl1ZCA',
      ripple: true,
      theme: {
        preset: Lara,
      },
    }),
  ],
};
