import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from '../../../services/auth.service';
import { ProviderSidebarComponent } from './provider-sidebar.component';

describe('ProviderSidebarComponent', () => {
  let fixture: ComponentFixture<ProviderSidebarComponent>;
  let component: ProviderSidebarComponent;
  let authService: AuthService;
  let router: Router;

  const routes = [
    { path: 'provider/bookings', component: ProviderSidebarComponent },
    { path: 'provider/services', component: ProviderSidebarComponent },
    { path: 'provider/working-hours', component: ProviderSidebarComponent },
    { path: 'provider/profile', component: ProviderSidebarComponent },
    { path: 'somewhere-else', component: ProviderSidebarComponent },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderSidebarComponent],
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        CookieService,
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ProviderSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders all navigation links with their routes and labels', () => {
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a'));
    expect(links.length).toBe(4);
    expect(links.map((link) => (link as HTMLElement).getAttribute('href'))).toEqual([
      '/provider/bookings',
      '/provider/services',
      '/provider/working-hours',
      '/provider/profile',
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('مواعيد اليوم والحجوزات');
    expect(text).toContain('خدماتي وأسعارها');
    expect(text).toContain('مواعيد العمل');
    expect(text).toContain('إعدادات الصالون والمعرض');
  });

  it('highlights the active route with the is-active class', async () => {
    await router.navigateByUrl('/provider/bookings');
    await fixture.whenStable();
    fixture.detectChanges();

    const active = fixture.nativeElement.querySelector(
      'nav a.is-active',
    ) as HTMLElement;
    expect(active).toBeTruthy();
    expect(active.getAttribute('href')).toBe('/provider/bookings');
  });

  it('does not highlight any link when on an unrelated route', async () => {
    await router.navigateByUrl('/somewhere-else');
    await fixture.whenStable();
    fixture.detectChanges();

    const active = fixture.nativeElement.querySelector('nav a.is-active');
    expect(active).toBeNull();
  });

  it('emits closed when a nav link is clicked', () => {
    const emitSpy = vi.spyOn(component.closed, 'emit');
    fixture.detectChanges();

    const servicesLink = Array.from(
      fixture.nativeElement.querySelectorAll('nav a'),
    ).find((link) => (link as HTMLElement).getAttribute('href') === '/provider/services');

    expect(servicesLink).toBeTruthy();
    (servicesLink as HTMLAnchorElement).click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('clears auth state, emits closed, and redirects to login on logout', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    const emitSpy = vi.spyOn(component.closed, 'emit');
    const tokenSpy = vi.spyOn(authService.token, 'set');
    const userDataSpy = vi.spyOn(authService.userData, 'set');
    const roleSpy = vi.spyOn(authService.userRole, 'set');
    fixture.detectChanges();

    const logoutButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => (button as HTMLElement).textContent?.includes('تسجيل الخروج'));

    expect(logoutButton).toBeTruthy();
    (logoutButton as HTMLButtonElement).click();

    expect(tokenSpy).toHaveBeenCalledWith(null);
    expect(userDataSpy).toHaveBeenCalledWith(null);
    expect(roleSpy).toHaveBeenCalledWith('client');
    expect(emitSpy).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('emits closed when the mobile close button is clicked', () => {
    const emitSpy = vi.spyOn(component.closed, 'emit');
    fixture.detectChanges();

    const closeButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => (button as HTMLElement).getAttribute('aria-label') === 'إغلاق القائمة');

    expect(closeButton).toBeTruthy();
    (closeButton as HTMLButtonElement).click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
