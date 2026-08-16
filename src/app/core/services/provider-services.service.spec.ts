import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from './auth.service';
import { ProviderServicesService } from './provider-services.service';

describe('ProviderServicesService', () => {
  let service: ProviderServicesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { token: signal<string | null>('provider-jwt-token') },
        },
        {
          provide: CookieService,
          useValue: { check: () => false, get: () => '' },
        },
      ],
    });

    service = TestBed.inject(ProviderServicesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('updates only isActive when toggling a service status', () => {
    service.updateServiceStatus('service-id', false).subscribe();

    const request = httpTesting.expectOne('http://localhost:5000/api/services/service-id');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isActive: false });
    expect(request.request.headers.get('Authorization')).toBe('Bearer provider-jwt-token');
    request.flush({ message: 'updated', service: {} });
  });

  it('permanently deletes a service through the authenticated DELETE endpoint', () => {
    service.permanentlyDeleteService('service/id 1').subscribe();

    const request = httpTesting.expectOne('http://localhost:5000/api/services/service%2Fid%201');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer provider-jwt-token');
    request.flush({ message: 'permanently deleted' });
  });
});