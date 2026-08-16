import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import {
  IProviderBookingMutationResponse,
  IProviderBookingsResponse,
  ProviderBookingStatus,
} from '../models/provider.model';
import { AuthService } from './auth.service';

/**
 * Auth-required bookings API for the logged-in provider.
 *
 * Backend (`bookingRoutes.js` + `bookingController.js`):
 * - `GET   /api/bookings/provider-bookings` → only the provider's own
 *   bookings, `clientId` (name phone email) and `serviceId` (name price
 *   duration) populated, newest first.
 * - `PATCH /api/bookings/:id/status` → transition to any of the five statuses.
 * - `PATCH /api/bookings/:id/no-show` → marks no-show and applies the client
 *   no-show penalty (returns `clientReliability`).
 *
 * Note: the list endpoint has no server-side status filter, so filtering is
 * done client-side by the provider bookings page.
 */
@Service()
export class ProviderBookingsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  private baseUrl = `${environment.baseUrl}/bookings`;

  /** `GET /api/bookings/provider-bookings` */
  getProviderBookings(): Observable<IProviderBookingsResponse> {
    return this.http.get<IProviderBookingsResponse>(
      `${this.baseUrl}/provider-bookings`,
      { headers: this.buildHeaders() },
    );
  }

  /** `PATCH /api/bookings/:id/status` */
  updateBookingStatus(
    bookingId: string,
    status: ProviderBookingStatus,
  ): Observable<IProviderBookingMutationResponse> {
    return this.http.patch<IProviderBookingMutationResponse>(
      `${this.baseUrl}/${bookingId}/status`,
      { status },
      { headers: this.buildHeaders() },
    );
  }

  /** `PATCH /api/bookings/:id/no-show` */
  markBookingNoShow(bookingId: string): Observable<IProviderBookingMutationResponse> {
    return this.http.patch<IProviderBookingMutationResponse>(
      `${this.baseUrl}/${bookingId}/no-show`,
      {},
      { headers: this.buildHeaders() },
    );
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
