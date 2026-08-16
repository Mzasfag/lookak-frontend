import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from '../../../services/auth.service';
import { AdminSidebarComponent } from './admin-sidebar.component';

describe('AdminSidebarComponent', () => {
  let fixture: ComponentFixture<AdminSidebarComponent>;
  let component: AdminSidebarComponent;
  let authService: AuthService;
  let router: Router;

  const routes = [
    { path: 'admin/dashboard', component: AdminSidebarComponent },
    { path: 'admin/users', component: AdminSidebarComponent },
    { path: 'somewhere-else', component: AdminSidebarComponent },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSidebarComponent],
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        CookieService,
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AdminSidebarComponent);
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
      '/admin/dashboard',
      '/admin/users',
      '/admin/bookings',
      '/admin/settings',
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('نظرة عامة');
    expect(text).toContain('إدارة المستخدمين');
    expect(text).toContain('إدارة الحجوزات');
    expect(text).toContain('الإعدادات العامة');
  });

  it('highlights the active route with the is-active class', async () => {
    await router.navigateByUrl('/admin/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();

    const active = fixture.nativeElement.querySelector(
      'nav a.is-active',
    ) as HTMLElement;
    expect(active).toBeTruthy();
    expect(active.getAttribute('href')).toBe('/admin/dashboard');
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

    const usersLink = Array.from(
      fixture.nativeElement.querySelectorAll('nav a'),
    ).find((link) => (link as HTMLElement).getAttribute('href') === '/admin/users');

    expect(usersLink).toBeTruthy();
    (usersLink as HTMLAnchorElement).click();
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
    ).find(
      (button) => (button as HTMLElement).getAttribute('aria-label') === 'إغلاق القائمة',
    );

    expect(closeButton).toBeTruthy();
    (closeButton as HTMLButtonElement).click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
