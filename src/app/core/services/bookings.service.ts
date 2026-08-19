import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import { AuthService } from './auth.service';

@Service()
export class BookingsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);

  private baseUrl = `${environment.baseUrl}/bookings`;

  getAvailableSlots(providerId: string, serviceId: string, date: string): Observable<any> {
    console.log('[DEBUG] BookingsService.getAvailableSlots called with:', { providerId, serviceId, date });
    console.log('[DEBUG] Request URL:', `${this.baseUrl}/available-slots`);
    console.log('[DEBUG] Request params:', { providerId, serviceId, date });
    return this.http.get<any>(`${this.baseUrl}/available-slots`, {
      params: { providerId, serviceId, date },
    });
  }

  createBooking(payload: any): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload, { headers: this.buildHeaders() });
  }

  getMyBookings(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/my-bookings`, { headers: this.buildHeaders() });
  }

  cancelBooking(bookingId: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/${bookingId}/cancel`, {}, { headers: this.buildHeaders() });
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
