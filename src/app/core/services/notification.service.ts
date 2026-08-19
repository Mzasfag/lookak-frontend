import { Injectable, inject, PLATFORM_ID, signal, computed, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer, switchMap, catchError, of, Subscription } from 'rxjs';
import { NotificationApiService } from './notification-api.service';
import { NotificationItem, NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationApi = inject(NotificationApiService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  // حالة الإشعارات الموحدة للموقع بالكامل
  private readonly _notifications = signal<NotificationItem[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isMuted = signal<boolean>(false);

  // Read-only signals
  readonly notifications = this._notifications.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isMuted = this._isMuted.asReadonly();

  // العداد المشترك لغير المقروءة
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.isRead).length);

  private audio: HTMLAudioElement | null = null;
  private lastUnreadCount: number | null = null;
  private pollingRef: Subscription | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.audio = new Audio('./assets/notification.mp3');
      this.audio.load();
    }
  }

  // بدء الـ Polling من مكان واحد فقط (في الهيدر أو التطبيق)
  startPolling(): void {
    if (this.pollingRef) return;

    this.pollingRef = timer(0, 30000)
      .pipe(
        switchMap(() => this.notificationApi.getNotifications()),
        catchError((err) => {
          console.error('Error fetching notifications:', err);
          return of({ count: 0, notifications: [] });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const newNotifications = res.notifications;
        const currentUnreadCount = newNotifications.filter((n) => !n.isRead).length;

        // تشغيل الصوت لو زاد عدد غير المقروءة
        if (this.lastUnreadCount !== null && currentUnreadCount > this.lastUnreadCount) {
          this.playSound();
        }

        this._notifications.set(newNotifications);
        this.lastUnreadCount = currentUnreadCount;
      });
  }

  loadNotifications(): void {
    this._isLoading.set(true);
    this.notificationApi
      .getNotifications()
      .pipe(
        catchError((err) => {
          console.error('Error fetching notifications:', err);
          return of({ count: 0, notifications: [] });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this._notifications.set(res.notifications);
        this._isLoading.set(false);
      });
  }

  markAsRead(id: string): void {
    this.notificationApi
      .markAsRead(id)
      .pipe(
        catchError((err) => {
          console.error('Error marking as read:', err);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this._notifications.update((list) =>
          list.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
        );
      });
  }

  markAllAsRead(): void {
    this.notificationApi
      .markAllAsRead()
      .pipe(
        catchError((err) => {
          console.error('Error marking all as read:', err);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this._notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
      });
  }

  toggleMute(): void {
    this._isMuted.update((v) => !v);
  }

  playSound(): void {
    if (this._isMuted() || !this.audio) return;
    this.audio.currentTime = 0;
    this.audio.play().catch((e) => console.warn('Audio playback failed', e));
  }
}
