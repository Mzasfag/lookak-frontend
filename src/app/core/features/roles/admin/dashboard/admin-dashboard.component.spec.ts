import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { IAdminReports, IAdminSummary } from '../../../models/admin.model';
import { AdminService } from '../../../services/admin.service';
import { AdminDashboardComponent } from './admin-dashboard.component';

const summaryMock: IAdminSummary = {
  totalUsersCount: 150,
  clientsCount: 120,
  providersCount: 25,
  adminsCount: 5,
  restrictedClientsCount: 3,
  bookingsCount: 210,
  pendingBookingsCount: 20,
  confirmedBookingsCount: 90,
  completedBookingsCount: 70,
  cancelledBookingsCount: 20,
  noShowBookingsCount: 10,
  revenue: 123456,
};

const reportsMock: IAdminReports = {
  bookingsByStatus: [
    { _id: 'pending', count: 20, revenue: 1000 },
    { _id: 'confirmed', count: 90, revenue: 20000 },
    { _id: 'completed', count: 70, revenue: 30000 },
    { _id: 'cancelled', count: 20, revenue: 0 },
    { _id: 'no-show', count: 10, revenue: 0 },
  ],
  usersByRole: [],
  providersByStatus: [
    { _id: 'approved', count: 20 },
    { _id: 'rejected', count: 2 },
    { _id: 'pending', count: 3 },
  ],
  revenueByProvider: [
    { providerId: 'p1', providerName: 'صالون الجمال', revenue: 5000, bookingsCount: 12 },
    { providerId: 'p2', providerName: 'صالون لمسة', revenue: 4000, bookingsCount: 10 },
  ],
};

class MockAdminService {
  getSummary = vi.fn(() => of(summaryMock));
  getReports = vi.fn(() => of(reportsMock));
}

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let service: MockAdminService;

  beforeEach(async () => {
    service = new MockAdminService();
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [{ provide: AdminService, useValue: service }, MessageService],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('fetches the summary and reports on init', () => {
    fixture.detectChanges();
    expect(service.getSummary).toHaveBeenCalledOnce();
    expect(service.getReports).toHaveBeenCalledOnce();
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
  });

  it('renders the user KPI values from the summary', () => {
    fixture.detectChanges();
    const values = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="kpi-value"]'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(values.join(' ')).toContain('150');
    expect(values.join(' ')).toContain('120');
    expect(values.join(' ')).toContain('25');
    expect(values.join(' ')).toContain('5');
  });

  it('renders revenue (SAR) and restricted clients values', () => {
    fixture.detectChanges();
    const revenue = fixture.nativeElement.querySelector(
      '[data-testid="revenue-value"]',
    ) as HTMLElement;
    const restricted = fixture.nativeElement.querySelector(
      '[data-testid="restricted-value"]',
    ) as HTMLElement;
    expect(revenue.textContent).toMatch(/123.{0,2}456/);
    expect(restricted.textContent).toContain('3');
  });

  it('renders the bookings overview KPIs', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('قيد الانتظار');
    expect(text).toContain('مؤكدة');
    expect(text).toContain('مكتملة');
    expect(text).toContain('ملغية');
    expect(text).toContain('لم يحضر');
  });

  it('renders the top providers table', () => {
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="provider-row"]');
    expect(rows.length).toBe(2);
    const first = rows[0] as HTMLElement;
    expect(first.textContent).toContain('صالون الجمال');
    expect(first.textContent).toContain('12');
    expect(first.textContent).toMatch(/5.{0,2}000/);
  });

  it('renders the booking and provider status breakdowns', () => {
    fixture.detectChanges();
    const statusRows = fixture.nativeElement.querySelectorAll('[data-testid="status-row"]');
    expect(statusRows.length).toBe(5);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('مقبول');
    expect(text).toContain('مرفوض');
    expect(text).toContain('قيد المراجعة');
  });

  it('shows the loader while data is being fetched', () => {
    service.getSummary = vi.fn(() => new Observable());
    service.getReports = vi.fn(() => new Observable());
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loader')).toBeTruthy();
  });

  it('shows the error state when the fetch fails', () => {
    service.getSummary = vi.fn(() =>
      new Observable<IAdminSummary>((observer) => observer.error(new Error('boom'))),
    );
    service.getReports = vi.fn(() => of(reportsMock));
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('تعذر تحميل البيانات');
  });

  it('retries loading after an error', () => {
    service.getSummary = vi.fn(() =>
      new Observable<IAdminSummary>((observer) => observer.error(new Error('boom'))),
    );
    service.getReports = vi.fn(() => of(reportsMock));
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);

    // Fix the service and trigger the retry button.
    service.getSummary = vi.fn(() => of(summaryMock));
    const retryButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((btn) =>
      (btn as HTMLElement).textContent?.includes('إعادة المحاولة'),
    ) as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.summary()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('لوحة التحكم');
  });
});

