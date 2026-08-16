import { IUser } from './user.model';

export type UserRole = 'client' | 'provider' | 'admin';
export type ProviderStatus = 'approved' | 'rejected' | 'pending';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

/** Standard JWT payload signed by the backend (`utils/tokens.js`). */
export interface IJwtPayload {
  id: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/** `GET /api/admin/summary` */
export interface IAdminSummary {
  totalUsersCount: number;
  clientsCount: number;
  providersCount: number;
  adminsCount: number;
  restrictedClientsCount: number;
  bookingsCount: number;
  pendingBookingsCount: number;
  confirmedBookingsCount: number;
  completedBookingsCount: number;
  cancelledBookingsCount: number;
  noShowBookingsCount: number;
  revenue: number;
}

/** `GET /api/admin/settings` */
export interface IAdminSettings {
  noShowThreshold: number;
  clientUrl: string;
  nodeEnv: string;
}

/** One entry of the `bookingsByStatus` aggregation bucket. */
export interface IBookingStatusBucket {
  _id: BookingStatus;
  count: number;
  revenue: number;
}

/** One entry of the `usersByRole` aggregation bucket. */
export interface IUsersByRoleBucket {
  _id: UserRole;
  count: number;
}

/** One entry of the `providersByStatus` aggregation bucket. */
export interface IProvidersByStatusBucket {
  _id: ProviderStatus;
  count: number;
}

/** One entry of the `revenueByProvider` top-10 aggregation bucket. */
export interface IRevenueByProvider {
  providerId: string;
  providerName: string;
  revenue: number;
  bookingsCount: number;
}

/** `GET /api/admin/reports` */
export interface IAdminReports {
  bookingsByStatus: IBookingStatusBucket[];
  usersByRole: IUsersByRoleBucket[];
  providersByStatus: IProvidersByStatusBucket[];
  revenueByProvider: IRevenueByProvider[];
}

export interface IWorkingHoursEntry {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

/**
 * Full Admin view of a user — a superset of `IUser`, returned by
 * `GET /api/admin/users` and the user mutation endpoints.
 */
export interface IAdminUser extends IUser {
  role: UserRole;
  /** Raw Mongo `_id` (the backend serializes the document as-is). */
  _id?: string;
  salonName?: string;
  description?: string;
  bio?: string;
  address?: string;
  providerStatus?: ProviderStatus;
  isVerified?: boolean;
  workingHours?: IWorkingHoursEntry[];
  isBookingRestricted?: boolean;
  bookingRestrictionReason?: string;
  bookingBlockedUntil?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Query params accepted by `GET /api/admin/users`. */
export interface IAdminListUsersParams {
  role?: UserRole;
  q?: string;
  restricted?: boolean;
  providerStatus?: ProviderStatus;
}

/** Body accepted by `PATCH /api/admin/users/:id/restriction`. */
export interface IUpdateUserRestrictionPayload {
  isRestricted?: boolean;
  isBookingRestricted?: boolean;
  bookingRestrictionReason?: string;
  bookingBlockedUntil?: string | null;
}

/** Populated `clientId` ref inside an admin booking. */
export interface IAdminBookingClientRef {
  id?: string;
  _id?: string;
  name: string;
  phone: string;
  email?: string;
  noShowCount?: number;
  isRestricted?: boolean;
  isBookingRestricted?: boolean;
}

/** Populated `providerId` ref inside an admin booking. */
export interface IAdminBookingProviderRef {
  id?: string;
  _id?: string;
  name: string;
  salonName?: string;
  phone: string;
  email?: string;
  address?: string;
  averageRating?: number;
}

/** Populated `serviceId` ref inside an admin booking. */
export interface IAdminBookingServiceRef {
  id?: string;
  _id?: string;
  name: string;
  price: number;
  duration: number;
}

/** Booking record returned by `GET /api/admin/bookings`. */
export interface IAdminBooking {
  _id: string;
  id?: string;
  clientId: IAdminBookingClientRef;
  providerId: IAdminBookingProviderRef;
  serviceId: IAdminBookingServiceRef;
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

/** `GET /api/admin/users` response. */
export interface IAdminUsersResponse {
  count: number;
  users: IAdminUser[];
}

/** `GET /api/admin/bookings` response. */
export interface IAdminBookingsResponse {
  count: number;
  bookings: IAdminBooking[];
}

/** Response of the user mutation endpoints (restriction / delete / provider status). */
export interface IUserMutationResponse {
  message: string;
  user: IAdminUser;
}

/** Response of `PATCH /api/admin/bookings/:id/status`. */
export interface IBookingMutationResponse {
  message: string;
  booking: IAdminBooking;
}
