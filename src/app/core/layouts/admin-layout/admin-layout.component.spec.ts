import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CookieService } from 'ngx-cookie-service';
import { AdminLayoutComponent } from './admin-layout.component';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';

describe('AdminLayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideHttpClient(),
        CookieService,
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the admin sidebar and the router outlet', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-admin-sidebar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('passes the drawer state to the sidebar and can toggle/close it', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const sidebar = fixture.debugElement.query(By.directive(AdminSidebarComponent))
      .componentInstance as AdminSidebarComponent;

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
    const fixture = TestBed.createComponent(AdminLayoutComponent);
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
});
