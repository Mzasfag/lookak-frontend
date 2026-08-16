export type NotificationType = 'booking_created' | 'booking_updated' | 'booking_cancelled' | 'review_created' | 'system';

export interface NotificationItem {
  _id: string;
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetNotificationsResponse {
  count: number;
  notifications: NotificationItem[];
}

export interface MarkReadResponse {
  message: string;
  notification: NotificationItem;
}

export interface MarkAllReadResponse {
  message: string;
  modifiedCount: number;
}
