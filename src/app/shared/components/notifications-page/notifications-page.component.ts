import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationApiService } from '../../../core/services/notification-api.service';
import { NotificationItem } from '../../../core/models/notification.model';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './notifications-page.component.html',
})
export class NotificationsPageComponent implements OnInit {
  private notificationApi = inject(NotificationApiService);
  notifications = signal<NotificationItem[]>([]);

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.notificationApi.getNotifications().subscribe(res => {
      this.notifications.set(res.notifications);
    });
  }

  markAsRead(id: string) {
    this.notificationApi.markAsRead(id).subscribe(() => {
        this.loadNotifications();
    });
  }
}