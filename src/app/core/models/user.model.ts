export interface IUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  averageRating: number;
  reviewsCount: number;
  subscriptionStatus: string;
  portfolioImages: any[];
  noShowCount: number;
  isRestricted: boolean;

  /** Provider-only fields (mirror the backend `User.js` schema). */
  salonName?: string;
  providerStatus?: 'pending' | 'approved' | 'rejected';
  isVerified?: boolean;
  isActive?: boolean;
}
