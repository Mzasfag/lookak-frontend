import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  IReviewsResponse,
  ICreateReviewPayload,
  ICreateReviewResponse,
} from '../models/review.model';

/**
 * Service for managing provider reviews/ratings.
 * Backend: POST /api/reviews (create), GET /api/reviews/:providerId (list)
 */
@Injectable({
  providedIn: 'root',
})
export class ReviewsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.baseUrl}/reviews`;

  /** Get all reviews for a specific provider. */
  getProviderReviews(providerId: string): Observable<IReviewsResponse> {
    return this.http.get<IReviewsResponse>(`${this.baseUrl}/${providerId}`);
  }

  /** Submit a new review/rating (requires authentication). */
  createReview(payload: ICreateReviewPayload): Observable<ICreateReviewResponse> {
    return this.http.post<ICreateReviewResponse>(this.baseUrl, payload);
  }
}
