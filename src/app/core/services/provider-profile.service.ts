import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import {
  IProviderPortfolioMutationResponse,
  IProviderProfileMutationResponse,
  IProviderProfilePayload,
  IProviderProfileResponse,
} from '../models/provider.model';
import { AuthService } from './auth.service';

const MAX_PORTFOLIO_UPLOAD_FILES = 8;

/**
 * Auth-required profile & portfolio management for the logged-in provider.
 *
   * Backend (`userRoutes.js` + `userController.js`), both behind `verifyToken`:
 * - `GET   /api/users/me` → the caller's full profile incl. portfolio.
 * - `PATCH /api/users/me` → update the caller's profile (`updateMe` allow-list:
 *   `name`, `phone`, `salonName`, `description`, `bio`, `address`,
 *   `workingHours`).
 *
   * Portfolio image mutations:
 * - `POST /api/portfolio` accepts multipart form data with one or more
 *   repeated `images` fields and an optional `caption` field.
   * - `DELETE /api/portfolio/:portfolioImageId` removes one portfolio
   *   sub-document owned by the authenticated provider.
 * - The request deliberately does not set `Content-Type`; Angular/the browser
 *   adds the multipart boundary when it serializes the `FormData` body.
 */
@Service()
export class ProviderProfileService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  /** Base for the authenticated-user endpoints. */
  private baseUrl = `${environment.baseUrl}/users`;
  private portfolioUrl = `${environment.baseUrl}/portfolio`;

  /** `GET /api/users/me` — fetch the provider's profile + portfolio. */
  getProfile(): Observable<IProviderProfileResponse> {
    return this.http.get<IProviderProfileResponse>(`${this.baseUrl}/me`, {
      headers: this.buildHeaders(),
    });
  }

  /** `PATCH /api/users/me` — persist edited profile fields. */
  updateProfile(payload: IProviderProfilePayload): Observable<IProviderProfileMutationResponse> {
    return this.http.patch<IProviderProfileMutationResponse>(`${this.baseUrl}/me`, payload, {
      headers: this.buildHeaders(),
    });
  }

  /**
   * Uploads up to eight portfolio images in one multipart request.
   *
   * Every file is appended under the exact `images` field name required by the
   * API. `buildHeaders` only adds Authorization, never Content-Type.
   */
  uploadPortfolioImages(
    files: readonly File[],
    caption?: string,
  ): Observable<IProviderPortfolioMutationResponse> {
    const formData = new FormData();
    for (const file of files.slice(0, MAX_PORTFOLIO_UPLOAD_FILES)) {
      formData.append('images', file, file.name);
    }

    const normalizedCaption = caption?.trim();
    if (normalizedCaption) {
      formData.append('caption', normalizedCaption);
    }

    return this.http.post<IProviderPortfolioMutationResponse>(
      this.portfolioUrl,
      formData,
      { headers: this.buildHeaders() },
    );
  }

  /**
   * Removes a persisted portfolio image by its portfolio sub-document id.
   */
  deletePortfolioImage(portfolioImageId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.portfolioUrl}/${encodeURIComponent(portfolioImageId)}`,
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
