import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { IUser } from '../models/user.model';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

@Service()
export class AuthService {
  private http = inject(HttpClient);
  token = signal<string | null>(null);
  userData = signal<IUser | null>(null);
  userRole = signal<'provider' | 'client' | 'admin' | string>('client');
  private baseUrl = `${environment.baseUrl}/auth/`;

  // login
  login(data: any): Observable<{ message: string; token: string; user: IUser }> {
    return this.http.post<{ message: string; token: string; user: IUser }>(
      this.baseUrl + 'login',
      data,
    );
  }
  // forget password
  forgetPassword(data: any): Observable<{ message: string; resetToken: string }> {
    return this.http.post<{ message: string; resetToken: string }>(
      this.baseUrl + 'forgot-password',
      data,
    );
  }
  // reset password
  resetPassword(data: any): Observable<{ message: string; token: string; user: IUser }> {
    return this.http.post<{ message: string; token: string; user: IUser }>(
      this.baseUrl + 'reset-password',
      data,
    );
  }

  // register
  register(data: any): Observable<{ message: string; token: string; user: IUser }> {
    return this.http.post<{ message: string; token: string; user: IUser }>(
      this.baseUrl + 'register',
      data,
    );
  }
}
