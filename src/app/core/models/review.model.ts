/**
 * Review/Rating models for provider reviews.
 * Backend: POST /api/reviews, GET /api/reviews/:providerId
 */

/** A single review/rating from a client. */
export interface IReview {
  _id?: string;
  id?: string;
  /** Client who left the review (populated). */
  clientId?: {
    _id?: string;
    id?: string;
    name: string;
    email?: string;
  };
  /** Provider being reviewed. */
  providerId: string;
  /** Rating from 1-5. */
  rating: number;
  /** Optional review text/comment. */
  comment?: string;
  /** Creation timestamp. */
  createdAt?: string;
  updatedAt?: string;
}

/** Response from GET /api/reviews/:providerId */
export interface IReviewsResponse {
  reviews: IReview[];
  averageRating?: number;
  totalReviews?: number;
}

/** Payload for POST /api/reviews */
export interface ICreateReviewPayload {
  providerId: string;
  rating: number;
  comment?: string;
}

/** Response from POST /api/reviews */
export interface ICreateReviewResponse {
  message: string;
  review: IReview;
}
