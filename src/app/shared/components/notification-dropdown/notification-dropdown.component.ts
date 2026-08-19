import { Component, inject, OnInit, signal, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from './../../../core/services/notification.service';
import { NotificationItem, NotificationType } from './../../../core/models/notification.model';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.css',
  host: {
    class: 'relative',
  },
})
export class NotificationDropdownComponent implements OnInit {
  private notifService = inject(NotificationService);
  private router = inject(Router);
  private elementRef = inject(ElementRef<HTMLElement>);

  // ربط مباشر مع الـ Signals في السيرفس
  readonly notifications = this.notifService.notifications;
  readonly unreadCount = this.notifService.unreadCount;
  readonly isLoading = this.notifService.isLoading;
  readonly isMuted = this.notifService.isMuted;

  isOpen = signal(false);

  bookingStatusAr: { [key: string]: string } = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    'no-show': 'لم يحضر',
  };

  get notificationsRoute(): string {
    const url = this.router.url;
    if (url.startsWith('/admin')) return '/admin/notifications';
    if (url.startsWith('/provider')) return '/provider/notifications';
    if (url.startsWith('/client')) return '/client/notifications';
    return '/notifications';
  }

  get visibleNotifications(): NotificationItem[] {
    return this.notifications().slice(0, 5);
  }

  get hasMoreNotifications(): boolean {
    return this.notifications().length > 5;
  }

  ngOnInit(): void {
    this.notifService.startPolling();
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.notifService.loadNotifications();
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  toggleMute(event: MouseEvent): void {
    event.stopPropagation();
    this.notifService.toggleMute();
  }

  markAsRead(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.notifService.markAsRead(id);
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notifService.markAllAsRead();
  }

  navigateToAll(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
    this.router.navigate([this.notificationsRoute]);
  }

  // --- الدوال المساعدة المطلوبة للـ HTML ---

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
}