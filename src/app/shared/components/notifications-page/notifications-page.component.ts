import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationItem, NotificationType } from '../../../core/models/notification.model';

export type FilterTab = 'all' | 'unread' | 'system' | 'bookings';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.css',
})
export class NotificationsPageComponent implements OnInit {
  private notifService = inject(NotificationService);
  protected router = inject(Router);

  // ربط الداتا من السيرفس المركزية مباشرة
  readonly allNotifications = this.notifService.notifications;
  readonly isLoading = this.notifService.isLoading;
  readonly unreadCount = this.notifService.unreadCount;

  activeFilter = signal<FilterTab>('all');
  isMarkingAllRead = signal(false);

  // Pagination
  currentPage = signal(1);
  pageSize = 20;

  filteredNotifications = computed(() => {
    const filter = this.activeFilter();
    const notifications = this.allNotifications();

    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.isRead);
      case 'system':
        return notifications.filter((n) => n.type === 'system');
      case 'bookings':
        return notifications.filter((n) =>
          ['booking_created', 'booking_updated', 'booking_cancelled'].includes(n.type),
        );
      case 'all':
      default:
        return notifications;
    }
  });

  paginatedNotifications = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredNotifications().slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredNotifications().length / this.pageSize));

  filterTabs = [
    { id: 'all' as FilterTab, label: 'الكل', icon: 'pi pi-list' },
    { id: 'unread' as FilterTab, label: 'غير مقروءة', icon: 'pi pi-bell' },
    { id: 'system' as FilterTab, label: 'النظام', icon: 'pi pi-cog' },
    { id: 'bookings' as FilterTab, label: 'الحجوزات', icon: 'pi pi-calendar' },
  ];

  bookingStatusAr: { [key: string]: string } = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    'no-show': 'لم يحضر',
  };

  ngOnInit(): void {
    this.notifService.loadNotifications();
  }

  setFilter(filter: FilterTab): void {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
  }

  markAsRead(id: string, event: Event): void {
    event.stopPropagation();
    this.notifService.markAsRead(id);
  }

  markAllAsRead(event: Event): void {
    event.stopPropagation();
    this.isMarkingAllRead.set(true);
    this.notifService.markAllAsRead();
    this.isMarkingAllRead.set(false);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  trackById(index: number, notification: NotificationItem): string {
    return notification._id;
  }

  convertToNumber(page: any): number {
    return Number(page);
  }

  back(): void {
    window.history.back();
  }

  // --- دوال المساعدة والعرض (التي كانت ناقصة) ---

  getNotificationIcon(type: NotificationType): {
    icon: string;
    bgClass: string;
    iconClass: string;
    label: string;
  } {
    switch (type) {
      case 'booking_created':
        return {
          icon: 'pi-calendar-plus',
          bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          label: 'حجز جديد',
        };
      case 'booking_updated':
        return {
          icon: 'pi-calendar',
          bgClass: 'bg-sky-100 dark:bg-sky-900/30',
          iconClass: 'text-sky-600 dark:text-sky-400',
          label: 'تحديث حجز',
        };
      case 'booking_cancelled':
        return {
          icon: 'pi-calendar-times',
          bgClass: 'bg-red-100 dark:bg-red-900/30',
          iconClass: 'text-red-600 dark:text-red-400',
          label: 'إلغاء حجز',
        };
      case 'review_created':
        return {
          icon: 'pi-star-fill',
          bgClass: 'bg-amber-100 dark:bg-amber-900/30',
          iconClass: 'text-amber-600 dark:text-amber-400',
          label: 'تقييم جديد',
        };
      case 'system':
      default:
        return {
          icon: 'pi-bell',
          bgClass: 'bg-violet-100 dark:bg-violet-900/30',
          iconClass: 'text-violet-600 dark:text-violet-400',
          label: 'النظام',
        };
    }
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return this.formatDateTime(dateString);
  }

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
          message: notification.message || '',
        };

      default:
        return {
          title: notification.title || 'إشعار جديد',
          message: notification.message || '',
        };
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push('...');
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < total - 2) {
        pages.push('...');
      }
      pages.push(total);
    }
    return pages;
  }
}
