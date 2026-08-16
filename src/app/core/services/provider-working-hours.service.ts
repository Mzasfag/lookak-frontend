import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import {
  IUserMeMutationResponse,
  IUserMeResponse,
  IWorkingHoursEntry,
} from '../models/provider.model';
import { AuthService } from './auth.service';

/**
 * Auth-required working-hours management for the logged-in provider.
 *
 * The backend does NOT expose a dedicated `/api/provider/working-hours` pair
 * yet — the live integration points are the authenticated-user routes
 * (`userRoutes.js` + `userController.js`), both behind `verifyToken`:
 * - `GET   /api/users/me` → the caller's profile incl. `workingHours`.
 * - `PATCH /api/users/me` → update the caller's profile (accepts `workingHours`).
 *
 * If dedicated routes land later, just repoint `baseUrl` (or add methods with
 * the same payload shapes) — component callers stay unchanged.
 */
@Service()
export class ProviderWorkingHoursService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  /** Base for the authenticated-user endpoints. */
  private baseUrl = `${environment.baseUrl}/users`;

  /** `GET /api/users/me` — fetch the provider's persisted working hours. */
  getWorkingHours(): Observable<IUserMeResponse> {
    return this.http.get<IUserMeResponse>(`${this.baseUrl}/me`, {
      headers: this.buildHeaders(),
    });
  }

  /** `PATCH /api/users/me` — persist a fresh plan of open/closed days. */
  updateWorkingHours(
    workingHours: IWorkingHoursEntry[],
  ): Observable<IUserMeMutationResponse> {
    return this.http.patch<IUserMeMutationResponse>(
      `${this.baseUrl}/me`,
      { workingHours },
      { headers: this.buildHeaders() },
    );
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