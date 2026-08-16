import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import {
  IProviderServiceMutationResponse,
  IProviderServicePayload,
  IProviderServicesResponse,
} from '../models/provider.model';
import { AuthService } from './auth.service';

/**
 * Auth-required services management API for the logged-in provider.
 *
 * Backend (`serviceRoutes.js` + `serviceController.js`):
 * - `GET    /api/services/provider/:providerId` → the provider's services,
 *   sorted by name (public endpoint, no token required).
 * - `POST   /api/services` → create a service owned by the caller.
 * - `PATCH  /api/services/:id` → update own service (incl. `isActive` toggle).
 * - `DELETE /api/services/:id` → permanently delete own service.
 *
 * Status changes and permanent deletion are intentionally separate actions:
 * use PATCH with `isActive` to enable/disable a service, and DELETE only when
 * the provider explicitly confirms permanent removal.
 */
@Service()
export class ProviderServicesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  private baseUrl = `${environment.baseUrl}/services`;

  /** `GET /api/services/provider/:providerId` */
  getProviderServices(providerId: string): Observable<IProviderServicesResponse> {
    return this.http.get<IProviderServicesResponse>(
      `${this.baseUrl}/provider/${providerId}`,
    );
  }

  /** `POST /api/services` */
  createService(
    payload: IProviderServicePayload,
  ): Observable<IProviderServiceMutationResponse> {
    return this.http.post<IProviderServiceMutationResponse>(this.baseUrl, payload, {
      headers: this.buildHeaders(),
    });
  }

  /** `PATCH /api/services/:id` */
  updateService(
    serviceId: string,
    payload: Partial<IProviderServicePayload>,
  ): Observable<IProviderServiceMutationResponse> {
    return this.http.patch<IProviderServiceMutationResponse>(
      `${this.baseUrl}/${serviceId}`,
      payload,
      { headers: this.buildHeaders() },
    );
  }

  /** `PATCH /api/services/:id` — enable or disable a service without deleting it. */
  updateServiceStatus(
    serviceId: string,
    isActive: boolean,
  ): Observable<IProviderServiceMutationResponse> {
    return this.updateService(serviceId, { isActive });
  }

  /** `DELETE /api/services/:id` — permanently removes the provider-owned service. */
  permanentlyDeleteService(serviceId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${encodeURIComponent(serviceId)}`, {
      headers: this.buildHeaders(),
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildHeaders(): HttpHeaders {
    const token = this.resolveToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private resolveToken(): string | null {
    if (isPlatformBrowser(this.platformId) && this.cookieService.check(AUTH_TOKEN_COOKIE)) {
      return this.cookieService.get(AUTH_TOKEN_COOKIE);
    }
    return this.authService.token();
  }
}
