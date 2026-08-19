import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { BookingsService } from './../../../../../core/services/bookings.service';
import { NotifyService } from './../../../../../core/services/notify.service';
import { formatTimeTo12Hour } from './../../../../../core/utils/time-format.util';

import { BookingStatus } from './../../../../../core/models/admin.model';
import { IClientBooking, IClientBookingsResponse } from './../../../../../core/models/client.model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientBookingStatusFilter = BookingStatus | 'all';

export interface ClientBookingStatusOption {
  value: ClientBookingStatusFilter;
  label: string;
}

export interface ClientBookingsStatChip {
  label: string;
  value: string;
  icon: string;
  iconClasses: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-client-bookings',
  imports: [RouterLink],
  templateUrl: './client-bookings.component.html',
  styleUrl: './client-bookings.component.css',
})
export class ClientBookingsComponent implements OnInit {
  private readonly bookingsService = inject(BookingsService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  readonly bookings = signal<IClientBooking[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  readonly statusFilter = signal<ClientBookingStatusFilter>('all');

  /** Booking id currently being cancelled (drives row-level loading). */
  readonly busyBookingId = signal<string | null>(null);

  // Cancel confirmation modal
  readonly bookingToCancel = signal<IClientBooking | null>(null);
  readonly isCancelling = signal(false);

  // Booking details modal
  readonly detailBooking = signal<IClientBooking | null>(null);
  readonly statusFilterOptions: ClientBookingStatusOption[] = [
    { value: 'all', label: 'كل الحالات' },
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'confirmed', label: 'مؤكد' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
    { value: 'no-show', label: 'لم يحضر' },
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

  readonly statusCounts = computed<Record<BookingStatus, number>>(() => {
    const counts: Record<BookingStatus, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      'no-show': 0,
    };
    for (const booking of this.bookings()) {
      counts[booking.status] += 1;
    }
    return counts;
  });

  readonly currentStatusLabel = computed(
    () =>
      this.statusFilterOptions.find((option) => option.value === this.statusFilter())?.label ??
      'كل الحالات',
  );

  readonly filteredBookings = computed<IClientBooking[]>(() => {
    const filter = this.statusFilter();
    const allBookings = this.bookings();

    if (filter === 'all') {
      return allBookings;
    }

    // تصفية الحجوزات بناءً على الحالة المختارة
    return allBookings.filter((booking) => booking.status === filter);
  });
  readonly upcomingCount = computed(
    () => this.bookings().filter((b) => b.status !== 'cancelled' && b.status !== 'no-show').length,
  );

  readonly completedCount = computed(
    () => this.bookings().filter((b) => b.status === 'completed').length,
  );

  readonly cancelledCount = computed(
    () => this.bookings().filter((b) => b.status === 'cancelled').length,
  );

  readonly statChips = computed<ClientBookingsStatChip[]>(() => [
    {
      label: 'إجمالي الحجوزات',
      value: this.formatNumber(this.totalCount()),
      icon: 'pi-calendar',
      iconClasses: 'bg-primary/10 text-primary',
    },
    {
      label: 'حجوزات قادمة',
      value: this.formatNumber(this.upcomingCount()),
      icon: 'pi-clock',
      iconClasses: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'مكتملة',
      value: this.formatNumber(this.completedCount()),
      icon: 'pi-check-circle',
      iconClasses: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'ملغاة',
      value: this.formatNumber(this.cancelledCount()),
      icon: 'pi-times-circle',
      iconClasses: 'bg-red-500/10 text-red-500',
    },
  ]);

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    this.bookingsService
      .getMyBookings()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res: IClientBookingsResponse) => {
          this.bookings.set(res?.bookings);
          this.totalCount.set(res?.count);
        },
        error: (error) => {
          this.hasError.set(true);
          this.errorMessage.set(error?.error?.message ?? 'تعذر تحميل الحجوزات');
          this.notifyService.showError(error?.error?.message ?? 'حدث خطأ أثناء تحميل الحجوزات');
        },
      });
  }

  // -------------------------------------------------------------------------
  // Cancel booking
  // -------------------------------------------------------------------------

  requestCancel(booking: IClientBooking): void {
    this.bookingToCancel.set(booking);
  }

  dismissCancel(): void {
    this.bookingToCancel.set(null);
  }

  confirmCancel(): void {
    const booking = this.bookingToCancel();
    if (!booking) return;

    this.isCancelling.set(true);
    this.busyBookingId.set(booking._id);

    this.bookingsService
      .cancelBooking(booking._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isCancelling.set(false);
          this.busyBookingId.set(null);
          this.bookingToCancel.set(null);
        }),
      )
      .subscribe({
        next: () => {
          this.notifyService.showSuccess('تم إلغاء الحجز بنجاح');
          this.loadBookings();
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message ?? 'تعذر إلغاء الحجز');
        },
      });
  }

  /** Whether the booking can be cancelled by the client. */
  canCancel(booking: IClientBooking): boolean {
    return booking.status === 'pending' || booking.status === 'confirmed';
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
      case 'pending':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
      case 'confirmed':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'completed':
        return 'bg-blue-500/10 text-blue-700 ring-blue-500/30';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-700 ring-rose-500/30';
      case 'no-show':
        return 'bg-on-surface-variant/10 text-on-surface-variant ring-outline-variant/30';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
    }
  }

  /** Opens the self-contained booking details modal. */
  openDetails(booking: IClientBooking): void {
    this.detailBooking.set(booking);
  }

  closeDetails(): void {
    this.detailBooking.set(null);
  }

  /** Resets the status filter back to "all" (used by the empty-state CTA). */
  clearFilter(): void {
    this.statusFilter.set('all');
  }

  formatDate(date: string): string {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('ar-EG-u-nu-latn', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatTime(value?: string | null): string {
    return formatTimeTo12Hour(value);
  }

  formatTimeRange(booking: IClientBooking): string {
    return `${this.formatTime(booking.timeSlot)} – ${this.formatTime(booking.endTime)}`;
  }

  formatDuration(minutes: number | null | undefined): string {
    if (minutes == null || Number.isNaN(minutes) || minutes <= 0) return '—';
    if (minutes % 60 === 0) return `${this.formatNumber(minutes / 60)} ساعة`;
    if (minutes < 60) return `${this.formatNumber(minutes)} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${this.formatNumber(hours)} س و${this.formatNumber(rest)} د`;
  }

  formatNumber(value: number): string {
    return this.numberFormatter.format(value);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return this.currencyFormatter.format(value);
  }

  isRowBusy(booking: IClientBooking): boolean {
    return this.busyBookingId() === booking._id;
  }
}
