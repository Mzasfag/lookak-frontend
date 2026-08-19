import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { IProviderBooking, ProviderBookingStatus } from './../../../../models/provider.model';
import { ProviderBookingsService } from './../../../../services/provider-bookings.service';
import { NotifyService } from './../../../../services/notify.service';
import { isPlatformBrowser } from '@angular/common';
import { formatTimeTo12Hour } from './../../../../utils/time-format.util';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

/** Statuses accepted by the filter pills (client-side filter). */
export type ProviderBookingStatusFilter = ProviderBookingStatus | 'all';

/** A single option rendered in the status filter pills. */
export interface ProviderBookingStatusOption {
  value: ProviderBookingStatusFilter;
  label: string;
}

/** A single quick-overview statistic shown above the bookings list. */
export interface ProviderBookingsStatChip {
  label: string;
  value: string;
  icon: string;
  iconClasses: string;
}

@Component({
  selector: 'app-provider-bookings',
  imports: [LoaderComponent],
  templateUrl: './provider-bookings.component.html',
  styleUrl: './provider-bookings.component.css',
})
export class ProviderBookingsComponent implements OnInit {
  private readonly providerBookingsService = inject(ProviderBookingsService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  readonly bookings = signal<IProviderBooking[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  readonly statusFilter = signal<ProviderBookingStatusFilter>('all');

  /** Booking id currently being updated (drives the row-level loading state). */
  readonly busyBookingId = signal<string | null>(null);

  readonly statusFilterOptions: ProviderBookingStatusOption[] = [
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
  readonly statusCounts = computed<Record<ProviderBookingStatus, number>>(() => {
    const counts: Record<ProviderBookingStatus, number> = {
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

  /** Filtered (client-side) list, newest date first (mirrors the API order). */
  readonly filteredBookings = computed(() => {
    const filter = this.statusFilter();
    const list =
      filter === 'all' ? this.bookings() : this.bookings().filter((b) => b.status === filter);
    return [...list].sort((a, b) => {
      const diff = new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
      if (diff !== 0) return diff;
      return (b.timeSlot ?? '').localeCompare(a.timeSlot ?? '');
    });
  });

  /** Today's bookings within the active filter, earliest slot first. */
  readonly todayBookings = computed(() =>
    this.filteredBookings()
      .filter((booking) => this.isToday(booking.date))
      .sort((a, b) => (a.timeSlot ?? '').localeCompare(b.timeSlot ?? '')),
  );

  readonly statChips = computed<ProviderBookingsStatChip[]>(() => {
    const todayCount = this.bookings().filter((booking) => this.isToday(booking.date)).length;
    const counts = this.statusCounts();
    return [
      {
        label: 'مواعيد اليوم',
        value: this.formatNumber(todayCount),
        icon: 'pi-sun',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
      },
      {
        label: 'قيد الانتظار',
        value: this.formatNumber(counts.pending),
        icon: 'pi-clock',
        iconClasses: 'bg-amber-500/10 text-amber-600',
      },
      {
        label: 'مؤكدة',
        value: this.formatNumber(counts.confirmed),
        icon: 'pi-check-circle',
        iconClasses: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'مكتملة',
        value: this.formatNumber(counts.completed),
        icon: 'pi-check-square',
        iconClasses: 'bg-emerald-500/10 text-emerald-600',
      },
    ];
  });

  ngOnInit(): void {
    // The auth token lives in a browser-only cookie; skip the initial fetch
    // during SSR so hydration never flashes an auth error.
    if (isPlatformBrowser(this.platformId)) {
      this.loadBookings();
    }
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  loadBookings(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.providerBookingsService
      .getProviderBookings()
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

  onStatusFilterChange(value: ProviderBookingStatusFilter): void {
    if (value === this.statusFilter()) {
      return;
    }
    this.statusFilter.set(value);
    this.busyBookingId.set(null);
  }

  // -------------------------------------------------------------------------
  // Status updates
  // -------------------------------------------------------------------------
  updateBookingStatus(booking: IProviderBooking, status: ProviderBookingStatus): void {
    const bookingId = this.bookingKey(booking);
    if (!bookingId || this.isRowBusy(booking)) {
      return;
    }
    this.busyBookingId.set(bookingId);
    this.providerBookingsService
      .updateBookingStatus(bookingId, status)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyBookingId.set(null)),
      )
      .subscribe({
        next: (response) => {
          this.applyUpdatedBooking(response.booking);
          this.notifyService.showSuccess(`تم تحديث حالة الحجز إلى «${this.statusLabel(status)}»`);
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message || 'تعذر تحديث حالة الحجز');
        },
      });
  }

  markNoShow(booking: IProviderBooking): void {
    const bookingId = this.bookingKey(booking);
    if (!bookingId || this.isRowBusy(booking)) {
      return;
    }
    this.busyBookingId.set(bookingId);
    this.providerBookingsService
      .markBookingNoShow(bookingId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyBookingId.set(null)),
      )
      .subscribe({
        next: (response) => {
          this.applyUpdatedBooking(response.booking);
          const reliability = response.clientReliability;
          if (reliability?.isRestricted || reliability?.isBookingRestricted) {
            this.notifyService.showWarn(
              'تم تقييد العميل من حجز مواعيد جديدة بسبب تكرار عدم الحضور',
            );
          } else {
            this.notifyService.showSuccess('تم تسجيل عدم الحضور');
          }
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message || 'تعذر تحديث حالة الحجز');
        },
      });
  }

  isRowBusy(booking: IProviderBooking): boolean {
    return this.busyBookingId() === this.bookingKey(booking);
  }

  bookingKey(booking: IProviderBooking): string {
    return booking._id ?? booking.id ?? '';
  }

  /**
   * Merge the server-returned booking into the list. Only the status is taken
   * from the mutation response because the backend re-populates only
   * `serviceId.name` there (the full `clientId` / `serviceId` come from the
   * list endpoint). When a status filter is active and the booking moved out
   * of it, drop the row instead of showing a stale entry.
   */
  private applyUpdatedBooking(updated: IProviderBooking): void {
    const key = this.bookingKey(updated);
    const filter = this.statusFilter();
    if (filter !== 'all' && updated.status !== filter) {
      this.bookings.update((list) => list.filter((booking) => this.bookingKey(booking) !== key));
      this.totalCount.update((count) => Math.max(0, count - 1));
      return;
    }
    this.bookings.update((list) =>
      list.map((booking) =>
        this.bookingKey(booking) === key ? { ...booking, status: updated.status } : booking,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Nested-object helpers (backend populates clientId / serviceId)
  // -------------------------------------------------------------------------
  clientName(booking: IProviderBooking): string {
    return booking.clientId?.name?.trim() || '—';
  }

  clientPhone(booking: IProviderBooking): string {
    return booking.clientId?.phone?.trim() || '—';
  }

  clientInitial(booking: IProviderBooking): string {
    const name = this.clientName(booking);
    return name === '—' ? '?' : name.charAt(0);
  }

  serviceName(booking: IProviderBooking): string {
    return booking.serviceId?.name?.trim() || '—';
  }

  bookingPrice(booking: IProviderBooking): number {
    return booking.totalPrice ?? booking.serviceId?.price ?? 0;
  }

  // -------------------------------------------------------------------------
  // Action availability
  // -------------------------------------------------------------------------
  canConfirm(booking: IProviderBooking): boolean {
    return booking.status === 'pending';
  }

  canComplete(booking: IProviderBooking): boolean {
    return booking.status === 'confirmed';
  }

  canMarkNoShow(booking: IProviderBooking): boolean {
    return booking.status === 'pending' || booking.status === 'confirmed';
  }

  canCancel(booking: IProviderBooking): boolean {
    return booking.status === 'pending' || booking.status === 'confirmed';
  }

  hasNoActions(booking: IProviderBooking): boolean {
    return (
      !this.canConfirm(booking) &&
      !this.canComplete(booking) &&
      !this.canMarkNoShow(booking) &&
      !this.canCancel(booking)
    );
  }

  // -------------------------------------------------------------------------
  // Presentation helpers
  // -------------------------------------------------------------------------
  statusLabel(status: ProviderBookingStatus | string): string {
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

  statusBadgeClass(status: ProviderBookingStatus | string): string {
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

  statusDotClass(status: ProviderBookingStatus | string): string {
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

  isToday(value?: string | null): boolean {
    return this.toDateKey(value) === this.toDateKey(new Date().toISOString());
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

  formatFullDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('ar-EG-u-nu-latn', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  formatTime(value?: string | null): string {
    return formatTimeTo12Hour(value);
  }

  formatTimeRange(booking: IProviderBooking): string {
    const start = this.formatTime(booking.timeSlot); // وقت البداية (مثلاً 12:45 م)
    const end = this.formatTime(booking.endTime); // وقت النهاية (مثلاً 2:45 م)

    // بنرجعهم بالترتيب الصحيح (البداية - النهاية) ومع الـ dir="ltr" فوق هيتثبتوا تماماً
    return `${start} - ${end}`;
  }
  formatDuration(minutes: number | null | undefined): string {
    if (minutes == null || Number.isNaN(minutes) || minutes <= 0) {
      return '—';
    }
    if (minutes % 60 === 0) {
      return `${this.formatNumber(minutes / 60)} ساعة`;
    }
    if (minutes < 60) {
      return `${this.formatNumber(minutes)} دقيقة`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${this.formatNumber(hours)} س و${this.formatNumber(rest)} د`;
  }

  formatNumber(value: number): string {
    return this.numberFormatter.format(value);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.currencyFormatter.format(value);
  }

  private toDateKey(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // إرجاع اسم اليوم بالعربي (مثل: الأحد، الإثنين، اليوم، غداً)
  formatDayName(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();

    // مقارنة الأيام لتحديد "اليوم" أو "غداً"
    if (date.toDateString() === today.toDateString()) {
      return 'اليوم';
    }

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'غداً';
    }

    // إرجاع اسم اليوم بالأسبوع بالعربي
    return date.toLocaleDateString('ar-EG', { weekday: 'long' });
  }

  // دمج اسم اليوم مع التاريخ بالكامل
  formatDayNameAndDate(dateStr: string): string {
    if (!dateStr) return '';
    const dayName = this.formatDayName(dateStr);
    // لو اليوم أو غداً نعرضها بشكل مميز
    if (dayName === 'اليوم' || dayName === 'غداً') {
      return `${dayName} (${this.formatDate(dateStr)})`;
    }
    return `${dayName}، ${this.formatDate(dateStr)}`;
  }
}
