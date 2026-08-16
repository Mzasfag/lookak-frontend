/**
 * Public provider (salon) models — shaped to match the backend's public
 * `GET /api/providers` endpoint (`listProviders` in providerController.js).
 *
 * These endpoints require no auth token: only active salons/providers
 * (`role: 'provider'`, `isActive: true`) are returned, sorted by rating.
 */

/** Mirrors the backend `workingHoursSchema` (User.js). */
export interface IWorkingHoursEntry {
  dayOfWeek: number;
  isOpen: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Salon/profile as returned by the public listing endpoint — the exact field
 * subset selected by `listProviders` (`name salonName bio address
 * averageRating reviewsCount workingHours`).
 */
export interface IPublicProvider {
  /** Raw Mongo `_id` (the backend serializes the document as-is). */
  _id: string;
  /** Kept optional for forward-compat if the API ever serializes `id`. */
  id?: string;
  /** Owner name (fallback when no `salonName` is set). */
  name: string;
  salonName?: string;
  bio?: string;
  address?: string;
  averageRating?: number;
  reviewsCount?: number;
  workingHours?: IWorkingHoursEntry[];
  category?: string;
}

/** `GET /api/providers` response body. */
export interface IPublicProvidersResponse {
  providers: IPublicProvider[];
}

// =============================================================================
// Provider working hours (auth-required) — shaped to match the backend's
// authenticated-user routes (`userRoutes.js` + `userController.js`):
//   GET  /api/users/me   → the caller's profile incl. `workingHours`
//   PATCH /api/users/me  → update the caller's profile (accepts `workingHours`)
// =============================================================================

/** `GET /api/users/me` — profile of the logged-in provider (subset consumed on this page). */
export interface IUserMeResponse {
  user: {
    id?: string;
    _id?: string;
    name?: string;
    salonName?: string;
    workingHours?: IWorkingHoursEntry[];
  };
}

/** `PATCH /api/users/me` — echo of the updated profile. */
export interface IUserMeMutationResponse {
  message: string;
  user: {
    id?: string;
    _id?: string;
    name?: string;
    salonName?: string;
    workingHours?: IWorkingHoursEntry[];
  };
}

// =============================================================================
// Provider bookings (auth-required) — shaped to match the backend's
// `GET /api/bookings/provider-bookings` (`getProviderBookings` in
// bookingController.js). Only the logged-in provider's own bookings are
// returned, with `clientId` / `serviceId` populated.
// =============================================================================

/** Status lifecycle of a booking (`Booking.js` enum + bookingSchemas.updateStatus). */
export type ProviderBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no-show';

/** Populated `clientId` ref inside a provider booking (`name phone email`). */
export interface IProviderBookingClientRef {
  id?: string;
  _id?: string;
  name: string;
  phone: string;
  email?: string;
}

/** Populated `serviceId` ref inside a provider booking (`name price duration`). */
export interface IProviderBookingServiceRef {
  id?: string;
  _id?: string;
  name: string;
  price: number;
  duration: number;
}

/** Booking record returned by `GET /api/bookings/provider-bookings`. */
export interface IProviderBooking {
  _id: string;
  id?: string;
  clientId: IProviderBookingClientRef;
  serviceId: IProviderBookingServiceRef;
  date: string;
  timeSlot: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  totalPrice: number;
  status: ProviderBookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/bookings/provider-bookings` response body. */
export interface IProviderBookingsResponse {
  count: number;
  bookings: IProviderBooking[];
}

/**
 * Client reliability snapshot returned when a provider marks a booking as
 * no-show — the backend applies a penalty that can restrict the client from
 * creating new bookings.
 */
export interface IClientReliability {
  noShowCount?: number;
  isRestricted?: boolean;
  isBookingRestricted?: boolean;
  threshold?: number;
}

/** Response of `PATCH /api/bookings/:id/status` and `PATCH /api/bookings/:id/no-show`. */
export interface IProviderBookingMutationResponse {
  message: string;
  booking: IProviderBooking;
  clientReliability?: IClientReliability;
}

// =============================================================================
// Provider services CRUD (auth-required) — shaped to match the backend's
// service routes (`serviceRoutes.js` + `serviceController.js`):
//   GET    /api/services/provider/:providerId   → the provider's services
//   POST   /api/services                        → create a service owned by caller
//   PATCH  /api/services/:id                    → update own service (incl. isActive)
//   DELETE /api/services/:id                    → permanently delete own service
// =============================================================================

/** A salon service as stored in the backend `services` collection (Service.js). */
export interface IProviderService {
  /** Raw Mongo `_id` (the backend serializes the document as-is). */
  _id: string;
  /** Kept optional for forward-compat if the API ever serializes `id`. */
  id?: string;
  /** Owning provider (Mongo `_id` of the `User` document). */
  providerId: string;
  /** Service name — min 2, max 100 chars. */
  name: string;
  /** Free-text description — optional, max 500 chars. */
  description?: string;
  /** Price in EGP — non-negative. */
  price: number;
  /** Duration in minutes — 5..480. */
  duration: number;
  /** `true` while the service is bookable; it is changed independently via PATCH. */
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** `GET /api/services/provider/:providerId` response body. */
export interface IProviderServicesResponse {
  provider: {
    _id: string;
    id?: string;
    name: string;
    salonName?: string;
    averageRating?: number;
    reviewsCount?: number;
  };
  count: number;
  services: IProviderService[];
}

/** Body accepted by `POST /api/services` (create) and `PATCH /api/services/:id`. */
export interface IProviderServicePayload {
  name: string;
  description?: string;
  price: number;
  duration: number;
  /** Allowed on update only (the create validator rejects it). */
  isActive?: boolean;
}

/** Response of the service mutation endpoints (`POST` / `PATCH`). */
export interface IProviderServiceMutationResponse {
  message: string;
  service: IProviderService;
}

// =============================================================================
// Provider profile + portfolio — shaped to match the backend's authenticated
// user routes (`userRoutes.js` + `userController.js`):
//   GET   /api/users/me   → the caller's full profile (see `publicUserFields`)
//   PATCH /api/users/me   → update the caller's profile (`updateMe` allow-list)
// =============================================================================

/** One entry of the backend `portfolio` sub-document (`User.js`). */
export interface IProviderPortfolioEntry {
  /** Portfolio sub-document id required by `DELETE /api/portfolio/:portfolioImageId`. */
  portfolioImageId?: string;
  /** MongoDB's usual serialized sub-document identifier. */
  _id?: string;
  /** Alternate serialized identifier used by some API response serializers. */
  id?: string;
  /** Publicly reachable image URL (Cloudinary `secure_url`). */
  url: string;
  /** Remote Cloudinary asset id; this is not the portfolio API deletion id. */
  publicId: string;
  /** Optional short caption displayed as the image's accessible description. */
  caption?: string;
}

/** The provider profile as returned by `GET /api/users/me`. */
export interface IProviderProfile {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  /** Salon display name (shown to clients + in the dashboard greeting). */
  salonName?: string;
  description?: string;
  /** Free-text bio shown on the public salon card (landing page). */
  bio?: string;
  address?: string;
  location?: { type?: string; coordinates?: number[] };
  /** Structured gallery entries. */
  portfolio?: IProviderPortfolioEntry[];
  /** Legacy flat list of image URLs. */
  portfolioImages?: string[];
  averageRating?: number;
  reviewsCount?: number;
  subscriptionStatus?: string;
  workingHours?: IWorkingHoursEntry[];
  noShowCount?: number;
  isRestricted?: boolean;
  isBookingRestricted?: boolean;
  bookingRestrictionReason?: string;
  bookingBlockedUntil?: string;
}

/** `GET /api/users/me` response body. */
export interface IProviderProfileResponse {
  user: IProviderProfile;
}

/** `PATCH /api/users/me` response body. */
export interface IProviderProfileMutationResponse {
  message: string;
  user: IProviderProfile;
}

/** Field subset accepted by `PATCH /api/users/me` (`updateMe` allow-list). */
export interface IProviderProfilePayload {
  name?: string;
  phone?: string;
  salonName?: string;
  description?: string;
  bio?: string;
  address?: string;
}

/**
 * Response returned by `POST /api/portfolio`.
 *
 * `images` is the current upload API contract. The remaining optional fields
 * keep the client compatible with earlier response envelopes while providers
 * deploy the new endpoint.
 */
export interface IProviderPortfolioMutationResponse {
  message: string;
  images?: IProviderPortfolioEntry[];
  image?: IProviderPortfolioEntry;
  portfolio?: IProviderPortfolioEntry[];
  user?: Pick<IProviderProfile, 'portfolio'>;
}
