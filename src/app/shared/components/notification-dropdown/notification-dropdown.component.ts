import { NotificationApiService } from './../../../core/services/notification-api.service';
import { NotificationItem } from './../../../core/models/notification.model';
import { Component, inject, OnInit, signal, DestroyRef, ViewChild, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { BadgeModule } from 'primeng/badge';
import { timer, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule, ButtonModule, Popover, BadgeModule, RouterLink],
  templateUrl: './notification-dropdown.component.html',
})
export class NotificationDropdownComponent implements OnInit {
  private notificationApi = inject(NotificationApiService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  
  @ViewChild('op') op!: Popover;
  notifications = signal<NotificationItem[]>([]);
  unreadCount = signal(0);
  isMuted = signal(false);

  private audio: HTMLAudioElement | null = null;
  private lastUnreadCount: number | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.audio = new Audio('assets/sounds/notification.mp3');
      this.audio.load();
    }
  }

  get notificationsRoute() {
    const url = this.router.url;
    if (url.startsWith('/admin')) return '/admin/notifications';
    if (url.startsWith('/provider')) return '/provider/notifications';
    if (url.startsWith('/client')) return '/client/notifications';
    return '/notifications';
  }

  toggleMute() {
    this.isMuted.set(!this.isMuted());
  }

  playSound() {
    if (this.isMuted() || !this.audio) return;
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn('Audio playback failed', e));
  }
// ... rest of the code

  ngOnInit() {
    this.startPolling();
  }

  private startPolling() {
    // Poll every 30 seconds
    timer(0, 30000)
      .pipe(
        switchMap(() => this.notificationApi.getNotifications()),
        catchError(err => {
          console.error('Error fetching notifications:', err);
          return of({ count: 0, notifications: [] });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.notifications.set(res.notifications);
        const currentUnreadCount = res.notifications.filter(n => !n.isRead).length;
        
        if (this.lastUnreadCount !== null && currentUnreadCount > this.lastUnreadCount) {
            this.playSound();
        }
        
        this.unreadCount.set(currentUnreadCount);
        this.lastUnreadCount = currentUnreadCount;
      });
  }

  markAsRead(id: string) {
    this.notificationApi.markAsRead(id).pipe(
      catchError(err => {
        console.error('Error marking as read:', err);
        return of(null);
      })
    ).subscribe(() => {
      // Optimistic local state update
      this.notifications.update(list => list.map(n => n._id === id ? {...n, isRead: true} : n));
      this.unreadCount.update(count => Math.max(0, count - 1));
    });
  }

  markAllAsRead() {
    this.notificationApi.markAllAsRead().pipe(
      catchError(err => {
        console.error('Error marking all as read:', err);
        return of(null);
      })
    ).subscribe(() => {
      // Optimistic local state update
      this.notifications.update(list => list.map(n => ({...n, isRead: true})));
      this.unreadCount.set(0);
    });
  }
}
