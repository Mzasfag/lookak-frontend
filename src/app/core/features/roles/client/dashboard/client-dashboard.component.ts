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
import {
  GetNotificationsResponse,
  NotificationItem,
} from './../../../../../core/models/notification.model';
import { NotificationService } from '../../../../services/notification.service';

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
  notifService = inject(NotificationService);

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
    [...this.bookings()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  );

  /** Most recent notifications (newest first), capped for the dashboard panel. */
  readonly recentNotifications = computed<NotificationItem[]>(() =>
    [...this.notifications()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
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
        // Brand gold for pending/upcoming
        iconClasses: 'bg-brand-gold/15 text-brand-gold ring-1 ring-brand-gold/20',
      },
      {
        label: 'الحجوزات المكتملة',
        value: completed,
        icon: 'pi-check-circle',
        // Tertiary (blue) for completed
        iconClasses: 'bg-tertiary/10 text-tertiary ring-1 ring-tertiary/20',
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
        // Error (red) for cancelled
        iconClasses: 'bg-error/10 text-error ring-1 ring-error/20',
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

  /** Returns design-system-compliant badge classes for a booking status. */
  statusBadgeClass(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        // Brand gold for pending/awaiting
        return 'bg-brand-gold/10 text-brand-gold ring-brand-gold/30';
      case 'confirmed':
        // Primary for confirmed
        return 'bg-primary/10 text-primary ring-primary/30';
      case 'completed':
        // Tertiary (blue) for completed
        return 'bg-tertiary/10 text-tertiary ring-tertiary/30';
      case 'cancelled':
        // Error (red) for cancelled
        return 'bg-error/10 text-error ring-error/30';
      case 'no-show':
        // Muted surface variant for no-show
        return 'bg-on-surface-variant/10 text-on-surface-variant ring-outline-variant/40';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/20';
    }
  }

  /** Returns design-system-compliant dot color for a booking status. */
  statusDotClass(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'bg-brand-gold';
      case 'confirmed':
        return 'bg-primary';
      case 'completed':
        return 'bg-tertiary';
      case 'cancelled':
        return 'bg-error';
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

  // 1. دالة تحويل الوقت من 24 ساعة إلى 12 ساعة (AM / PM) بالعربي أو الإنجليزي
  formatTimeTo12Hour(timeStr: string): string {
    if (!timeStr) return '';
    // لو الوقت جاي بصيغة "14:30" أو "14:30:00"
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const period = hours >= 12 ? 'م' : 'ص'; // أو استخدم 'PM' / 'AM' حسب رغبتك

    hours = hours % 12;
    hours = hours ? hours : 12; // الساعة 0 تبقى 12

    const formattedHours = hours < 10 ? '0' + hours : hours;
    return `${formattedHours}:${minutes} ${period}`;
  }



  /** "2026-08-14" → sortable key (keeps upcoming list chronological). */
  private sortKey(b: IClientBooking): string {
    return `${b?.date || ''}T${b?.timeSlot || '00:00'}`;
  }

  bookingStatusAr: { [key: string]: string } = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    'no-show': 'لم يحضر',
  };

  // دالة تحويل وتوليد الإشعار بالعربي بناءً على الـ type والـ data
  formatNotificationArabic(notification: any): { title: string; message: string } {
    const type = notification.type;
    const data = notification.data || {};
    const senderName = notification.senderId?.name || 'مستخدم';

    switch (type) {
      case 'booking_created':
        return {
          title: 'طلب حجز جديد',
          message: `قام ${senderName} بحجز موعد جديد${data.date ? ' بتاريخ ' + data.date : ''}`,
        };

      case 'booking_updated': {
        const statusText = this.bookingStatusAr[data.status] || data.status || 'محدثة';
        return {
          title: 'تحديث حالة الحجز',
          message: `أصبحت حالة الحجز الخاص بك: ${statusText}`,
        };
      }

      case 'booking_cancelled':
        return {
          title: 'تم إلغاء الحجز',
          message: `قام ${senderName} بإلغاء الحجز`,
        };

      case 'review_created':
        return {
          title: 'تقييم جديد',
          message: `قام ${senderName} بتقييم الخدمة${data.rating ? ' بقيمة ' + data.rating + ' ⭐' : ''}`,
        };

      case 'system':
        if (data.noShowCount) {
          return {
            title: 'تم تقييد الحساب',
            message: `تم تقييد حسابك مؤقتاً بسبب تكرار عدم الحضور (${data.noShowCount} مرات). يرجى مراجعة الإدارة.`,
          };
        }
        return {
          title: 'إشعار من النظام',
          message: notification.message, // fallback لو إشعار نظام عام
        };

      default:
        return {
          title: notification.title || 'إشعار جديد',
          message: notification.message || '',
        };
    }
  }
}
