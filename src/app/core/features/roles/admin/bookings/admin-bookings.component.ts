import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { BookingStatus, IAdminBooking } from './../../../../models/admin.model';
import { AdminService } from './../../../../services/admin.service';
import { NotifyService } from './../../../../services/notify.service';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { formatTimeTo12Hour } from './../../../../utils/time-format.util';

/** Statuses accepted by the filter dropdown (server-side filter). */
export type BookingStatusFilter = BookingStatus | 'all';

/** A single option rendered in the status filter dropdown. */
export interface BookingStatusOption {
  value: BookingStatus | 'all';
  label: string;
}

/** A single option rendered in the per-row status-change dropdown. */
export interface BookingChangeStatusOption {
  value: BookingStatus;
  label: string;
}

/** A single quick-overview statistic shown above the bookings list. */
export interface BookingsStatChip {
  label: string;
  value: string;
  icon: string;
  iconClasses: string;
}

@Component({
  selector: 'app-admin-bookings',
  imports: [LoaderComponent],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.css',
})
export class AdminBookingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  readonly bookings = signal<IAdminBooking[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  readonly statusFilter = signal<BookingStatusFilter>('all');

  /** Booking id currently being updated (drives the row-level loading state). */
  readonly busyBookingId = signal<string | null>(null);

  /** Options for the filter dropdown (includes "all"). */
  readonly statusFilterOptions: BookingStatusOption[] = [
    { value: 'all', label: 'كل الحالات' },
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'confirmed', label: 'مؤكد' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
    { value: 'no-show', label: 'لم يحضر' },
  ];

  /** Options for the per-row status-change dropdown. */
  readonly statusChangeOptions: BookingChangeStatusOption[] = [
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'confirmed', label: 'تأكيد الحجز' },
    { value: 'completed', label: 'إتمام الحجز' },
    { value: 'cancelled', label: 'إلغاء الحجز' },
    { value: 'no-show', label: 'عدم حضور' },
  ];

  private readonly numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn');
  private readonly currencyFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  });

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  readonly currentStatusLabel = computed(
    () =>
      this.statusFilterOptions.find((option) => option.value === this.statusFilter())?.label ??
      'كل الحالات',
  );

  readonly statChips = computed<BookingsStatChip[]>(() => {
    const list = this.bookings();
    const totalValue = list.reduce(
      (acc, booking) => acc + (booking.totalPrice ?? booking.serviceId?.price ?? 0),
      0,
    );
    return [
      {
        label: 'عدد الحجوزات',
        value: this.formatNumber(list.length),
        icon: 'pi-calendar',
        iconClasses: 'bg-primary/10 text-primary',
      },
      {
        label: 'الحالة المعروضة',
        value: this.currentStatusLabel(),
        icon: 'pi-filter',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
      },
      {
        label: 'قيمة الحجوزات',
        value: this.formatCurrency(totalValue),
        icon: 'pi-money-bill',
        iconClasses: 'bg-emerald-500/10 text-emerald-600',
      },
    ];
  });

  ngOnInit(): void {
    this.loadBookings();
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  loadBookings(): void {
    const status =
      this.statusFilter() === 'all' ? undefined : (this.statusFilter() as BookingStatus);
    this.isLoading.set(true);
    this.hasError.set(false);
    this.adminService
      .getBookings(status)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.bookings.set(response.bookings ?? []);
          this.totalCount.set(response.count ?? response.bookings?.length ?? 0);
        },
        error: (error) => {
          this.bookings.set([]);
          this.totalCount.set(0);
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message || 'تعذر تحميل الحجوزات');
        },
      });
  }

  onStatusFilterChange(value: string): void {
    const next = value === 'all' ? 'all' : (value as BookingStatus);
    if (next === this.statusFilter()) {
      return;
    }
    this.statusFilter.set(next);
    this.busyBookingId.set(null);
    this.loadBookings();
  }

  // -------------------------------------------------------------------------
  // Status update
  // -------------------------------------------------------------------------
  onStatusChange(booking: IAdminBooking, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as BookingStatus;
    const currentStatus = booking.status;
    if (!newStatus || newStatus === currentStatus) {
      select.value = currentStatus;
      return;
    }
    const bookingId = this.bookingKey(booking);
    if (!bookingId) {
      return;
    }
    this.busyBookingId.set(bookingId);
    this.adminService
      .updateBookingStatus(bookingId, newStatus)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyBookingId.set(null)),
      )
      .subscribe({
        next: (response) => {
          this.applyUpdatedBooking(response.booking);
          this.notifyService.showSuccess(
            `تم تحديث حالة الحجز إلى «${this.statusLabel(newStatus)}»`,
          );
        },
        error: (error) => {
          // Revert the dropdown to the server-side status so the UI never
          // displays a status that was not actually applied.
          select.value = currentStatus;
          this.notifyService.showError(error?.error?.message || 'تعذر تحديث حالة الحجز');
        },
      });
  }

  isRowBusy(booking: IAdminBooking): boolean {
    return this.busyBookingId() === this.bookingKey(booking);
  }

  bookingKey(booking: IAdminBooking): string {
    return booking._id ?? booking.id ?? '';
  }

  /**
   * Merge the server-returned booking into the list. When a status filter is
   * active and the booking moved out of it, drop the row instead of showing a
   * stale entry that no longer matches the filter.
   */
  private applyUpdatedBooking(updated: IAdminBooking): void {
    const key = this.bookingKey(updated);
    const filter = this.statusFilter();
    if (filter !== 'all' && updated.status !== filter) {
      this.bookings.update((list) => list.filter((booking) => this.bookingKey(booking) !== key));
      this.totalCount.update((count) => Math.max(0, count - 1));
      return;
    }
    this.bookings.update((list) =>
      list.map((booking) =>
        this.bookingKey(booking) === key ? { ...booking, ...updated } : booking,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Nested-object helpers (backend populates clientId / providerId / serviceId)
  // -------------------------------------------------------------------------
  clientName(booking: IAdminBooking): string {
    return booking.clientId?.name?.trim() || '—';
  }

  clientPhone(booking: IAdminBooking): string {
    return booking.clientId?.phone?.trim() || '—';
  }

  clientInitial(booking: IAdminBooking): string {
    const name = this.clientName(booking);
    return name === '—' ? '?' : name.charAt(0);
  }

  providerName(booking: IAdminBooking): string {
    return booking.providerId?.salonName?.trim() || booking.providerId?.name?.trim() || '—';
  }

  serviceName(booking: IAdminBooking): string {
    return booking.serviceId?.name?.trim() || '—';
  }

  bookingPrice(booking: IAdminBooking): number {
    return booking.totalPrice ?? booking.serviceId?.price ?? 0;
  }

  // -------------------------------------------------------------------------
  // Presentation helpers
  // -------------------------------------------------------------------------
  statusLabel(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'confirmed':
        return 'مؤكد';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغي';
      case 'no-show':
        return 'لم يحضر';
      default:
        return status;
    }
  }

  statusBadgeClass(status: BookingStatus | string): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'pending':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
      case 'confirmed':
        return 'bg-sky-500/10 text-sky-700 ring-sky-500/30';
      case 'cancelled':
      case 'no-show':
        return 'bg-red-500/10 text-red-600 ring-red-500/30';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
    }
  }

  statusDotClass(status: BookingStatus | string): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'pending':
        return 'bg-amber-500';
      case 'confirmed':
        return 'bg-sky-500';
      case 'cancelled':
      case 'no-show':
        return 'bg-red-500';
      default:
        return 'bg-on-surface-variant/50';
    }
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('ar-EG-u-nu-latn');
  }

  formatTime(value?: string | null): string {
    return formatTimeTo12Hour(value);
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.numberFormatter.format(value);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.currencyFormatter.format(value);
  }
}

