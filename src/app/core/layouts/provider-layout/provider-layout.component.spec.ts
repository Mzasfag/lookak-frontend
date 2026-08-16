import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CookieService } from 'ngx-cookie-service';
import { ProviderLayoutComponent } from './provider-layout.component';
import { ProviderSidebarComponent } from './provider-sidebar/provider-sidebar.component';
import { AuthService } from '../../services/auth.service';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../constants/auth.constants';

describe('ProviderLayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderLayoutComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideHttpClient(),
        CookieService,
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the provider sidebar and the router outlet', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-provider-sidebar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('passes the drawer state to the sidebar and can toggle/close it', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const sidebar = fixture.debugElement.query(By.directive(ProviderSidebarComponent))
      .componentInstance as ProviderSidebarComponent;

    expect(component.isSidebarOpen()).toBe(false);
    expect(sidebar.isOpen()).toBe(false);

    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.isSidebarOpen()).toBe(true);
    expect(sidebar.isOpen()).toBe(true);

    component.closeSidebar();
    fixture.detectChanges();
    expect(component.isSidebarOpen()).toBe(false);
    expect(sidebar.isOpen()).toBe(false);
  });

  it('renders the mobile backdrop only while the drawer is open', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('div[data-testid="drawer-backdrop"]'),
    ).toBeNull();

    component.toggleSidebar();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('div[data-testid="drawer-backdrop"]'),
    ).toBeTruthy();
  });

  it('restores the session from cookies and shows the salon greeting + status', () => {
    const cookieService = TestBed.inject(CookieService);
    cookieService.set(AUTH_TOKEN_COOKIE, 'token-xyz');
    cookieService.set(
      AUTH_USER_COOKIE,
      JSON.stringify({
        name: 'أحمد',
        salonName: 'صالون النور',
        role: 'provider',
        providerStatus: 'approved',
      }),
    );

    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('صالون النور');
    // The header pill shows account-active («نشط») for approved providers.
    expect(text).toContain('نشط');
  });

  it('falls back to a generic title when no user session exists', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('لوحة مزود الخدمة');
  });

  it('clears auth state and redirects to login on logout', () => {
    const fixture = TestBed.createComponent(ProviderLayoutComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const authService = TestBed.inject(AuthService);

    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    const tokenSpy = vi.spyOn(authService.token, 'set');
    const userDataSpy = vi.spyOn(authService.userData, 'set');
    const roleSpy = vi.spyOn(authService.userRole, 'set');
    fixture.detectChanges();

    component.onLogout();

    expect(tokenSpy).toHaveBeenCalledWith(null);
    expect(userDataSpy).toHaveBeenCalledWith(null);
    expect(roleSpy).toHaveBeenCalledWith('client');
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
