import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GetNotificationsResponse, MarkReadResponse, MarkAllReadResponse } from '../models/notification.model';
import { AUTH_TOKEN_COOKIE } from '../constants/auth.constants';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);
  
  private baseUrl = `${environment.baseUrl}/notifications`;

  getNotifications(): Observable<GetNotificationsResponse> {
    return this.http.get<GetNotificationsResponse>(this.baseUrl, { headers: this.buildHeaders() });
  }

  markAsRead(id: string): Observable<MarkReadResponse> {
    return this.http.patch<MarkReadResponse>(`${this.baseUrl}/${id}/read`, {}, { headers: this.buildHeaders() });
  }

  markAllAsRead(): Observable<MarkAllReadResponse> {
    return this.http.patch<MarkAllReadResponse>(`${this.baseUrl}/read-all`, {}, { headers: this.buildHeaders() });
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

