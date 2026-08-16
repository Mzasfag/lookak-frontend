import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IPublicProvidersResponse } from '../models/provider.model';

/**
 * Public (no auth) browsing of salons/providers.
 *
 * Backend: `GET /api/providers` → active salons (`role: 'provider'`,
 * `isActive: true`) sorted by average rating, then review count. Consumed by
 * the landing page to render real registered salons + derived stats.
 */
@Service()
export class ProvidersService {
  private http = inject(HttpClient);

  private baseUrl = `${environment.baseUrl}/providers`;

  /** Lists all active salons/providers, highest rated first. */
  getProviders(): Observable<IPublicProvidersResponse> {
    return this.http.get<IPublicProvidersResponse>(this.baseUrl);
  }

  /** Get details for a specific salon/provider by ID. */
  getProviderById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

}
