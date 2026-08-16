import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize, catchError, of } from 'rxjs';

import { UserService } from './../../../../../core/services/user.service';
import { BookingsService } from './../../../../../core/services/bookings.service';
import { NotificationApiService } from './../../../../../core/services/notification-api.service';
import { NotifyService } from './../../../../../core/services/notify.service';
import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { ErrorAlertComponent } from './../../../../../shared/components/error-alert/error-alert.component';

import { BookingStatus } from './../../../../../core/models/admin.model';
import {
  IClientBooking,
  IClientBookingsResponse,
  IClientProfile,
  IClientProfileResponse,
} from './../../../../../core/models/client.model';
import { GetNotificationsResponse, NotificationItem } from './../../../../../core/models/notification.model';

/** A single KPI card rendered on the dashboard. */
export interface ClientKpiCard {
  label: string;
  value: number | string;
  icon: string;
  iconClasses: string;
  badgeClasses?: string;
}

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule, RouterLink, LoaderComponent, ErrorAlertComponent],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.css',
})
export class ClientDashboardComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly bookingsService = inject(BookingsService);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<IClientProfile | null>(null);
  readonly bookings = signal<IClientBooking[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly unreadNotifications = signal<number>(0);

  readonly userInitial = computed<string>(() => {
    const name = this.profile()?.name?.trim() || '';
    return name ? name.charAt(0).toUpperCase() : 'ع';
  });

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  /** Row-level busy flag while marking all notifications as read. */
  readonly isMarkingAllRead = signal(false);

  /** Upcoming bookings = not cancelled / not no-show, sorted by date ascending. */
  readonly upcomingBookings = computed<IClientBooking[]>(() => {
    return this.bookings()
      .filter((b) => b.status === 'pending' || b.status === 'confirmed')
      .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
  });

  readonly recentBookings = computed<IClientBooking[]>(() =>
    [...this.bookings()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  );

  /** Most recent notifications (newest first), capped for the dashboard panel. */
  readonly recentNotifications = computed<NotificationItem[]>(() =>
    [...this.notifications()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  );

  readonly kpis = computed<ClientKpiCard[]>(() => {
    const bookings = this.bookings();
    const total = bookings.length;
    const upcoming = this.upcomingBookings().length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

    return [
      {
        label: 'إجمالي الحجوزات',
        value: total,
        icon: 'pi-calendar',
        iconClasses: 'bg-primary/10 text-primary ring-1 ring-primary/20',
      },
      {
        label: 'الحجوزات القادمة',
        value: upcoming,
        icon: 'pi-clock',
        iconClasses: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
      },
      {
        label: 'الحجوزات المكتملة',
        value: completed,
        icon: 'pi-check-circle',
        iconClasses: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20',
      },
      {
        label: 'إشعارات غير مقروءة',
        value: this.unreadNotifications(),
        icon: 'pi-bell',
        iconClasses: 'bg-brand-gold/15 text-brand-gold ring-1 ring-brand-gold/20',
      },
      {
        label: 'الحجوزات الملغاة',
        value: cancelled,
        icon: 'pi-times-circle',
        iconClasses: 'bg-red-500/10 text-red-600 ring-1 ring-red-500/20',
      },
    ];
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      me: this.userService.getMe().pipe(catchError(() => of(null))),
      bookings: this.bookingsService.getMyBookings(),
      notifications: this.notificationApi.getNotifications(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          const me = res.me as IClientProfileResponse;
          const bookings = res.bookings as IClientBookingsResponse;
          const notifications = res.notifications as GetNotificationsResponse;

          this.profile.set(me?.user ?? null);
          this.bookings.set(bookings?.bookings ?? []);
          const notifList = notifications?.notifications ?? [];
          this.notifications.set(notifList);
          this.unreadNotifications.set(notifList.filter((n) => !n.isRead).length);
        },
        error: (error) => {
          this.hasError.set(true);
          this.errorMessage.set(error?.error?.message ?? 'تعذر تحميل بيانات لوحة التحكم');
          this.notifyService.showError(error?.error?.message ?? 'حدث خطأ أثناء تحميل البيانات');
        },
      });
  }

  /** Marks every notification as read via `PATCH /api/notifications/read-all`. */
  markAllNotificationsRead(): void {
    if (this.isMarkingAllRead() || this.unreadNotifications() === 0) return;

    this.isMarkingAllRead.set(true);
    this.notificationApi
      .markAllAsRead()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isMarkingAllRead.set(false)),
      )
      .subscribe({
        next: () => {
          this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
          this.unreadNotifications.set(0);
          this.notifyService.showSuccess('تم تعليم جميع الإشعارات كمقروءة');
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message ?? 'تعذر تعليم الإشعارات كمقروءة');
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Presentation helpers
  // ---------------------------------------------------------------------------

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
        return 'bg-primary/10 text-primary ring-primary/30';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/10 text-red-600 ring-red-500/30';
      case 'no-show':
        return 'bg-on-surface-variant/10 text-on-surface-variant ring-outline-variant/40';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/20';
    }
  }

  statusDotClass(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-500';
      case 'confirmed':
        return 'bg-primary';
      case 'completed':
        return 'bg-emerald-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'no-show':
        return 'bg-on-surface-variant';
      default:
        return 'bg-on-surface-variant';
    }
  }

  /** Human-friendly booking date, e.g. "الأربعاء، 14 أغسطس 2026". */
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

  /** Relative-ish notification timestamp, e.g. "14 أغسطس، 10:30 ص". */
  formatNotificationTime(date: string): string {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleString('ar-EG-u-nu-latn', {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /** Maps a notification type to a PrimeIcons class for the dashboard list. */
  notificationIcon(type: string): string {
    switch (type) {
      case 'booking_created':
        return 'pi-calendar-plus';
      case 'booking_updated':
        return 'pi-calendar-edit';
      case 'booking_cancelled':
        return 'pi-calendar-times';
      case 'review_created':
        return 'pi-star';
      default:
        return 'pi-bell';
    }
  }

  /** "2026-08-14" → sortable key (keeps upcoming list chronological). */
  private sortKey(b: IClientBooking): string {
    return `${b?.date || ''}T${b?.timeSlot || '00:00'}`;
  }
}