import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { IProviderBooking, IProviderBookingsResponse } from '../../../models/provider.model';
import { ProviderBookingsService } from '../../../services/provider-bookings.service';
import { NotifyService } from '../../../services/notify.service';
import { ProviderBookingsComponent } from './provider-bookings.component';

/** ISO date `offset` days from today (local time). */
function daysFromNow(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString();
}

/** Minimal, shape-complete booking fixture (tomorrow by default). */
function makeBooking(overrides: Partial<IProviderBooking> = {}): IProviderBooking {
  return {
    _id: 'b1',
    clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
    serviceId: { _id: 's1', name: 'قص وتصفيف', price: 150, duration: 60 },
    date: daysFromNow(1),
    timeSlot: '11:00',
    endTime: '12:00',
    startMinutes: 660,
    endMinutes: 720,
    durationMinutes: 60,
    totalPrice: 150,
    status: 'pending',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ProviderBookingsComponent', () => {
  const serviceStub = {
    getProviderBookings: vi.fn(),
    updateBookingStatus: vi.fn(),
    markBookingNoShow: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 0, bookings: [] }));
    serviceStub.updateBookingStatus.mockReturnValue(
      of({ message: 'ok', booking: makeBooking() }),
    );
    serviceStub.markBookingNoShow.mockReturnValue(
      of({ message: 'ok', booking: makeBooking({ status: 'no-show' }) }),
    );

    await TestBed.configureTestingModule({
      imports: [ProviderBookingsComponent],
      providers: [
        MessageService,
        NotifyService,
        { provide: ProviderBookingsService, useValue: serviceStub },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the provider bookings and renders client, service and status info', async () => {
    const bookings = [
      makeBooking({
        _id: 'b1',
        clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
        status: 'pending',
      }),
      makeBooking({
        _id: 'b2',
        clientId: { _id: 'c2', name: 'منى خالد', phone: '+201002223344' },
        serviceId: { _id: 's2', name: 'صبغ شعر', price: 300, duration: 120 },
        date: daysFromNow(2),
        status: 'confirmed',
      }),
    ];
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 2, bookings }));

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.bookings().length).toBe(2);
    expect(fixture.componentInstance.totalCount()).toBe(2);
    expect(compiled.querySelectorAll('[data-testid="booking-row"]').length).toBe(2);
    expect(compiled.textContent).toContain('سارة أحمد');
    expect(compiled.textContent).toContain('صبغ شعر');
    expect(compiled.textContent).toContain('مؤكد');
  });

  it('shows the loader while the initial request is in flight', () => {
    const subject = new Subject<IProviderBookingsResponse>();
    serviceStub.getProviderBookings.mockReturnValue(subject.asObservable());

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-loader')).toBeTruthy();

    subject.next({ count: 1, bookings: [makeBooking()] });
    subject.complete();
    fixture.detectChanges();

    expect(compiled.querySelector('app-loader')).toBeNull();
    expect(compiled.querySelectorAll('[data-testid="booking-row"]').length).toBe(1);
  });

  it('filters bookings by status client-side without a server round trip', async () => {
    const bookings = [
      makeBooking({
        _id: 'b1',
        clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
        date: daysFromNow(3),
        status: 'pending',
      }),
      makeBooking({
        _id: 'b2',
        clientId: { _id: 'c2', name: 'منى خالد', phone: '+201002223344' },
        date: daysFromNow(3),
        status: 'confirmed',
      }),
    ];
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 2, bookings }));

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="booking-row"]').length).toBe(2);
    expect(serviceStub.getProviderBookings).toHaveBeenCalledTimes(1);

    const confirmedPill = fixture.nativeElement.querySelector(
      '[data-testid="booking-filter-confirmed"]',
    ) as HTMLButtonElement;
    confirmedPill.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredBookings().length).toBe(1);
    expect(fixture.componentInstance.filteredBookings()[0].status).toBe('confirmed');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="booking-row"]').length).toBe(1);
    expect(serviceStub.getProviderBookings).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent as string).not.toContain('سارة أحمد');
  });

  it('confirms a pending booking via the API and refreshes the row status', async () => {
    const booking = makeBooking({
      _id: 'b1',
      clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
      date: daysFromNow(2),
      status: 'pending',
    });
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 1, bookings: [booking] }));
    serviceStub.updateBookingStatus.mockReturnValue(
      of({ message: 'تم التحديث', booking: { ...booking, status: 'confirmed' } }),
    );

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    const notify = TestBed.inject(NotifyService);
    const successSpy = vi.spyOn(notify, 'showSuccess');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelector(
      '[data-testid="action-confirm"]',
    ) as HTMLButtonElement;
    expect(confirmButton).toBeTruthy();
    confirmButton.click();
    fixture.detectChanges();

    expect(serviceStub.updateBookingStatus).toHaveBeenCalledWith('b1', 'confirmed');
    expect(fixture.componentInstance.bookings()[0].status).toBe('confirmed');
    expect(successSpy).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('مؤكد');
  });

  it('marks a booking as no-show and warns when the client gets restricted', async () => {
    const booking = makeBooking({
      _id: 'b1',
      clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
      date: daysFromNow(2),
      status: 'confirmed',
    });
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 1, bookings: [booking] }));
    serviceStub.markBookingNoShow.mockReturnValue(
      of({
        message: 'marked',
        booking: { ...booking, status: 'no-show' },
        clientReliability: {
          noShowCount: 3,
          isRestricted: true,
          isBookingRestricted: true,
          threshold: 3,
        },
      }),
    );

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    const notify = TestBed.inject(NotifyService);
    const warnSpy = vi.spyOn(notify, 'showWarn');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const noShowButton = fixture.nativeElement.querySelector(
      '[data-testid="action-no-show"]',
    ) as HTMLButtonElement;
    expect(noShowButton).toBeTruthy();
    noShowButton.click();
    fixture.detectChanges();

    expect(serviceStub.markBookingNoShow).toHaveBeenCalledWith('b1');
    expect(fixture.componentInstance.bookings()[0].status).toBe('no-show');
    expect(warnSpy).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('لم يحضر');
  });

  it('shows an error state and recovers on retry', async () => {
    serviceStub.getProviderBookings
      .mockImplementationOnce(() => throwError(() => new Error('network down')))
      .mockReturnValue(of({ count: 1, bookings: [makeBooking()] }));

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="bookings-error"]')).toBeTruthy();

    const retry = fixture.nativeElement.querySelector(
      '[data-testid="retry-bookings"]',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.hasError()).toBe(false);
    expect(fixture.componentInstance.bookings().length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="booking-row"]').length).toBe(1);
  });

  it('renders the empty state when the provider has no bookings', async () => {
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 0, bookings: [] }));

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="bookings-empty"]')).toBeTruthy();
  });

  it('surfaces today bookings in the schedule panel sorted by slot', async () => {
    const today = new Date().toISOString();
    const bookings = [
      makeBooking({
        _id: 'b1',
        clientId: { _id: 'c1', name: 'سارة أحمد', phone: '+201001112233' },
        date: today,
        timeSlot: '13:00',
        endTime: '14:00',
        status: 'pending',
      }),
      makeBooking({
        _id: 'b2',
        clientId: { _id: 'c2', name: 'منى خالد', phone: '+201002223344' },
        date: today,
        timeSlot: '09:00',
        endTime: '10:00',
        status: 'confirmed',
      }),
    ];
    serviceStub.getProviderBookings.mockReturnValue(of({ count: 2, bookings }));

    const fixture = TestBed.createComponent(ProviderBookingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="today-schedule"]');
    expect(panel).toBeTruthy();

    const articles = Array.from(panel.querySelectorAll('article'));
    expect(articles.length).toBe(2);
    // earliest slot first
    expect((articles[0] as HTMLElement).textContent).toContain('09:00');
    expect((articles[1] as HTMLElement).textContent).toContain('13:00');
  });
});
