import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from './auth.service';
import { ProviderProfileService } from './provider-profile.service';

describe('ProviderProfileService', () => {
  let service: ProviderProfileService;
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

    service = TestBed.inject(ProviderProfileService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('posts all selected images and an optional caption as authenticated multipart form data', () => {
    const firstFile = new File(['first image'], 'first.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['second image'], 'second.webp', { type: 'image/webp' });

    service.uploadPortfolioImages([firstFile, secondFile], '  تصفيف زفاف  ').subscribe();

    const request = httpTesting.expectOne('http://localhost:5000/api/portfolio');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer provider-jwt-token');
    expect(request.request.headers.has('Content-Type')).toBe(false);

    const body = request.request.body as FormData;
    expect(body.getAll('images')).toEqual([firstFile, secondFile]);
    expect(body.get('caption')).toBe('تصفيف زفاف');

    request.flush({
      message: 'uploaded',
      images: [
        { url: 'https://images.example.com/first.jpg', publicId: 'first' },
        { url: 'https://images.example.com/second.webp', publicId: 'second' },
      ],
    });
  });

  it('omits a blank caption from the multipart payload', () => {
    const file = new File(['image'], 'image.png', { type: 'image/png' });

    service.uploadPortfolioImages([file], '   ').subscribe();

    const request = httpTesting.expectOne('http://localhost:5000/api/portfolio');
    expect((request.request.body as FormData).get('caption')).toBeNull();
    request.flush({ message: 'uploaded', images: [] });
  });

  it('sends no more than the supported eight images in a request', () => {
    const files = Array.from(
      { length: 9 },
      (_, index) => new File(['image'], `image-${index}.webp`, { type: 'image/webp' }),
    );

    service.uploadPortfolioImages(files).subscribe();

    const request = httpTesting.expectOne('http://localhost:5000/api/portfolio');
    expect((request.request.body as FormData).getAll('images')).toEqual(files.slice(0, 8));
    request.flush({ message: 'uploaded', images: [] });
  });

  it('deletes a portfolio image by id with the provider bearer token', () => {
    service.deletePortfolioImage('portfolio/image 1').subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:5000/api/portfolio/portfolio%2Fimage%201',
    );
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer provider-jwt-token');
    request.flush({ message: 'deleted' });
  });
});