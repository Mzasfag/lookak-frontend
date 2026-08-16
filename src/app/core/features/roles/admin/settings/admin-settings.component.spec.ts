import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { IAdminSettings } from '../../../models/admin.model';
import { AdminService } from '../../../services/admin.service';
import { AdminSettingsComponent } from './admin-settings.component';

const settingsMock: IAdminSettings = {
  noShowThreshold: 3,
  clientUrl: 'https://lookak.example.com',
  nodeEnv: 'production',
};

class MockAdminService {
  getSettings = vi.fn(() => of(settingsMock));
}

describe('AdminSettingsComponent', () => {
  let fixture: ComponentFixture<AdminSettingsComponent>;
  let component: AdminSettingsComponent;
  let service: MockAdminService;

  beforeEach(async () => {
    service = new MockAdminService();
    await TestBed.configureTestingModule({
      imports: [AdminSettingsComponent],
      providers: [{ provide: AdminService, useValue: service }, MessageService],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('fetches the system settings on init', () => {
    fixture.detectChanges();
    expect(service.getSettings).toHaveBeenCalledOnce();
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
    expect(component.settings()).toEqual(settingsMock);
  });

  it('renders the no-show threshold card with its value', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('حد غياب العملاء المسموح');
    expect(text).toContain('noShowThreshold');
    expect(text).toContain('3');
  });

  it('renders the client URL as a clickable external link', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      '[data-testid="client-url-link"]',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('lookak.example.com');
    expect(link.target).toBe('_blank');
  });

  it('renders the node environment with its Arabic label', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('بيئة النظام');
    expect(text).toContain('بيئة إنتاج');
    expect(text).toContain('production');
  });

  it('shows the loader while the settings are being fetched', () => {
    service.getSettings = vi.fn(() => new Observable());
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loader')).toBeTruthy();
  });

  it('shows the error state when the fetch fails', () => {
    service.getSettings = vi.fn(() =>
      new Observable<IAdminSettings>((observer) => observer.error(new Error('boom'))),
    );
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('تعذر تحميل الإعدادات');
  });

  it('retries loading after an error', () => {
    service.getSettings = vi.fn(() =>
      new Observable<IAdminSettings>((observer) => observer.error(new Error('boom'))),
    );
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);

    // Fix the service and trigger the retry button.
    service.getSettings = vi.fn(() => of(settingsMock));
    const retryButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('إعادة المحاولة'),
    ) as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.settings()).toEqual(settingsMock);
    expect(fixture.nativeElement.textContent).toContain('إعدادات النظام');
  });
});
