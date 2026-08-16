import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import { AuthService } from './auth.service';
import {
  BookingStatus,
  IAdminBookingsResponse,
  IAdminListUsersParams,
  IAdminReports,
  IAdminSettings,
  IAdminSummary,
  IAdminUsersResponse,
  IBookingMutationResponse,
  IUpdateUserRestrictionPayload,
  IUserMutationResponse,
  ProviderStatus,
  UserRole,
} from '../models/admin.model';

@Service()
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  private baseUrl = `${environment.baseUrl}/admin`;

  /** `GET /api/admin/summary` */
  getSummary(): Observable<IAdminSummary> {
    return this.http.get<IAdminSummary>(`${this.baseUrl}/summary`, {
      headers: this.buildHeaders(),
    });
  }

  /** `GET /api/admin/reports` */
  getReports(): Observable<IAdminReports> {
    return this.http.get<IAdminReports>(`${this.baseUrl}/reports`, {
      headers: this.buildHeaders(),
    });
  }

  /** `GET /api/admin/settings` */
  getSettings(): Observable<IAdminSettings> {
    return this.http.get<IAdminSettings>(`${this.baseUrl}/settings`, {
      headers: this.buildHeaders(),
    });
  }


  getUsers(params: IAdminListUsersParams = {}): Observable<IAdminUsersResponse> {
    return this.http.get<IAdminUsersResponse>(`${this.baseUrl}/users`, {
      headers: this.buildHeaders(),
      params: this.buildUsersQuery(params),
    });
  }

  /** `PATCH /api/admin/users/:id/restriction` */
  updateUserRestriction(
    userId: string,
    data: IUpdateUserRestrictionPayload,
  ): Observable<IUserMutationResponse> {
    return this.http.patch<IUserMutationResponse>(
      `${this.baseUrl}/users/${userId}/restriction`,
      data,
      { headers: this.buildHeaders() },
    );
  }

  /** `DELETE /api/admin/users/:id` (soft delete → `isActive: false`) */
  deleteUser(userId: string): Observable<IUserMutationResponse> {
    return this.http.delete<IUserMutationResponse>(`${this.baseUrl}/users/${userId}`, {
      headers: this.buildHeaders(),
    });
  }

  /** `PATCH /api/admin/providers/:id/status` */
  updateProviderStatus(
    providerId: string,
    providerStatus: ProviderStatus,
  ): Observable<IUserMutationResponse> {
    return this.http.patch<IUserMutationResponse>(
      `${this.baseUrl}/providers/${providerId}/status`,
      { providerStatus },
      { headers: this.buildHeaders() },
    );
  }

  /** `GET /api/admin/bookings` — optionally filtered by status. */
  getBookings(status?: BookingStatus): Observable<IAdminBookingsResponse> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<IAdminBookingsResponse>(`${this.baseUrl}/bookings`, {
      headers: this.buildHeaders(),
      params,
    });
  }

  /** `PATCH /api/admin/bookings/:id/status` */
  updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
  ): Observable<IBookingMutationResponse> {
    return this.http.patch<IBookingMutationResponse>(
      `${this.baseUrl}/bookings/${bookingId}/status`,
      { status },
      { headers: this.buildHeaders() },
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildUsersQuery(params: IAdminListUsersParams): HttpParams {
    let query = new HttpParams();
    if (params.role) {
      query = query.set('role', params.role);
    }
    if (params.q) {
      query = query.set('q', params.q);
    }
    // The backend matches the literal string `'true'` (`listAdminUsers`).
    if (params.restricted !== undefined) {
      query = query.set('restricted', String(params.restricted));
    }
    if (params.providerStatus) {
      query = query.set('providerStatus', params.providerStatus);
    }
    return query;
  }

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
