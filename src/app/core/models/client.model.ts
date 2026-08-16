/**
 * Client (role: 'client') models — shaped to match the backend's authenticated
 * user + booking endpoints consumed by the client dashboard / bookings pages:
 *   GET  /api/users/me          → the caller's profile (`{ user }`)
 *   GET  /api/bookings/my-bookings → the caller's own bookings (`{ count, bookings }`)
 *
 * Booking statuses reuse the shared `BookingStatus` enum from `admin.model.ts`
 * (the backend `Booking.js` schema is identical for every role).
 */

import { BookingStatus } from './admin.model';

/** Populated `providerId` ref inside a client booking (`name salonName phone`). */
export interface IClientBookingProviderRef {
  id?: string;
  _id?: string;
  name: string;
  salonName?: string;
  phone?: string;
}

/** Populated `serviceId` ref inside a client booking (`name price duration`). */
export interface IClientBookingServiceRef {
  id?: string;
  _id?: string;
  name: string;
  price: number;
  duration: number;
}

/** Booking record returned by `GET /api/bookings/my-bookings`. */
export interface IClientBooking {
  _id: string;
  id?: string;
  providerId: IClientBookingProviderRef;
  serviceId: IClientBookingServiceRef;
  date: string;
  timeSlot: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  totalPrice: number;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/bookings/my-bookings` response body. */
export interface IClientBookingsResponse {
  count: number;
  bookings: IClientBooking[];
}

/** The client profile as returned by `GET /api/users/me`. */
export interface IClientProfile {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  averageRating?: number;
  reviewsCount?: number;
  noShowCount?: number;
  isRestricted?: boolean;
  isBookingRestricted?: boolean;
  bookingRestrictionReason?: string;
  bookingBlockedUntil?: string;
}

/** `GET /api/users/me` response body. */
export interface IClientProfileResponse {
  user: IClientProfile;
}
