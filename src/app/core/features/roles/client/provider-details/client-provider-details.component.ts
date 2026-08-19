import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize, catchError, of } from 'rxjs';

import { ProvidersService } from '../../../../../core/services/providers.service';
import { ProviderServicesService } from '../../../../../core/services/provider-services.service';
import { BookingsService } from '../../../../../core/services/bookings.service';
import { ReviewsService } from '../../../../../core/services/reviews.service';
import { NotifyService } from '../../../../../core/services/notify.service';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { IReview } from '../../../../../core/models/review.model';
import { IClientBooking } from '../../../../../core/models/client.model';
import { IProviderProfile, IProviderService } from '../../../../models/provider.model';

@Component({
  selector: 'app-client-provider-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, LoaderComponent, ErrorAlertComponent],
  templateUrl: './client-provider-details.component.html',
  styleUrl: './client-provider-details.component.css',
})
export class ClientProviderDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly providersService = inject(ProvidersService);
  private readonly providerServicesService = inject(ProviderServicesService);
  private readonly bookingsService = inject(BookingsService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly providerId = signal<string>('');
  readonly provider = signal<IProviderProfile | null>(null);
  readonly services = signal<IProviderService[]>([]);
  readonly portfolioImages = signal<{ url: string; caption?: string }[]>([]);
  readonly reviews = signal<IReview[]>([]);
  readonly completedBookings = signal<IClientBooking[]>([]);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  // Booking Flow State
  readonly currentStep = signal<'services' | 'datetime' | 'confirm'>('services');
  readonly selectedServiceId = signal<string | null>(null);
  readonly selectedDate = signal<string>('');
  readonly availableSlots = signal<{ startTime: string; endTime: string }[]>([]);
  readonly selectedTimeSlot = signal<string | null>(null);

  readonly isSlotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly isBooking = signal(false);

  // Reviews State
  readonly isReviewsLoading = signal(false);
  readonly reviewsError = signal<string | null>(null);
  readonly showReviewForm = signal(false);
  readonly isSubmittingReview = signal(false);

  readonly reviewRating = new FormControl<number>(5, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.max(5)],
  });
  readonly reviewComment = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });

  readonly hoverRating = signal<number>(0);

  readonly activeServices = computed(() => this.services().filter((s) => s.isActive !== false));

  readonly selectedService = computed(() => {
    const id = this.selectedServiceId();
    if (!id) return null;
    return this.services().find((s) => (s._id || s.id) === id) || null;
  });

  readonly minDate = computed(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  readonly maxDate = computed(() => {
    const max = new Date();
    max.setDate(max.getDate() + 30);
    return max.toISOString().split('T')[0];
  });

  readonly groupedSlots = computed(() => {
    const slots = this.availableSlots();
    const morning: { label: string; value: string }[] = [];
    const afternoon: { label: string; value: string }[] = [];
    const evening: { label: string; value: string }[] = [];

    slots.forEach((slot) => {
      const timeStr = slot.startTime;
      const hour = parseInt(timeStr.split(':')[0], 10);
      const formattedLabel = this.formatTimeTo12Hour(timeStr);
      const item = { label: formattedLabel, value: timeStr };

      if (hour < 12) {
        morning.push(item);
      } else if (hour < 17) {
        afternoon.push(item);
      } else {
        evening.push(item);
      }
    });

    return { morning, afternoon, evening };
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.hasError.set(true);
      this.errorMessage.set('معرف المزود غير موجود.');
      this.isLoading.set(false);
      return;
    }
    this.providerId.set(id);
    this.loadData(id);
  }

  loadData(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      providerRes: this.providersService.getProviderById(id).pipe(catchError(() => of(null))),
      servicesRes: this.providerServicesService
        .getProviderServices(id)
        .pipe(catchError(() => of(null))),
      reviewsRes: this.reviewsService.getProviderReviews(id).pipe(catchError(() => of(null))),
      bookingsRes: this.bookingsService.getMyBookings().pipe(catchError(() => of(null))),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          const provData: any = res.providerRes?.provider ?? res.providerRes;
          if (!provData) {
            this.hasError.set(true);
            this.errorMessage.set('تعذر العثور على بيانات المزود.');
            return;
          }

          this.provider.set(provData);

          const rawPortfolio = provData.portfolio || [];
          const rawLegacy = provData.portfolioImages || [];
          const combined = [
            ...rawPortfolio.map((p: any) =>
              typeof p === 'string' ? { url: p } : { url: p.url, caption: p.caption },
            ),
            ...rawLegacy.map((url: string) => ({ url })),
          ];
          const uniqueImages = Array.from(
            new Map(combined.map((item) => [item.url, item])).values(),
          );
          this.portfolioImages.set(uniqueImages);

          const srvData: any = res.servicesRes;
          const srvList = srvData?.services ?? (Array.isArray(srvData) ? srvData : []);
          this.services.set(srvList);

          const revData: any = res.reviewsRes;
          this.reviews.set(revData?.reviews ?? (Array.isArray(revData) ? revData : []));

          const bookData: any = res.bookingsRes;
          const userBookings = bookData?.bookings ?? (Array.isArray(bookData) ? bookData : []);
          const completed = userBookings.filter((b: IClientBooking) => {
            const pId = typeof b.providerId === 'object' ? b.providerId?._id : b.providerId;
            return pId === id && b.status === 'completed';
          });
          this.completedBookings.set(completed);
        },
        error: (err) => {
          this.hasError.set(true);
          this.errorMessage.set(err?.error?.message ?? 'حدث خطأ أثناء تحميل بيانات الصالون');
        },
      });
  }

  selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
    this.currentStep.set('datetime');
    if (this.selectedDate()) {
      this.fetchAvailableSlots();
    }
  }

  onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.selectedTimeSlot.set(null);
    if (date && this.selectedServiceId()) {
      this.fetchAvailableSlots();
    }
  }

  fetchAvailableSlots(): void {
    const pId = this.providerId();
    const sId = this.selectedServiceId();
    const date = this.selectedDate();

    if (!pId || !sId || !date) return;

    this.isSlotsLoading.set(true);
    this.slotsError.set(null);
    this.availableSlots.set([]);

    this.bookingsService
      .getAvailableSlots(pId, sId, date)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSlotsLoading.set(false)),
      )
      .subscribe({
        next: (res: any) => {
          const slots = res?.slots ?? (Array.isArray(res) ? res : []);
          this.availableSlots.set(slots);
        },
        error: (err) => {
          this.slotsError.set('تعذر تحميل المواعيد المتاحة برجاء تحديد تاريخ أخر.');
        },
      });
  }

  retryLoadSlots(): void {
    this.fetchAvailableSlots();
  }

  selectTimeSlot(slotValue: string): void {
    this.selectedTimeSlot.set(slotValue);
  }

  goToConfirm(): void {
    if (this.canSubmitBooking()) {
      this.currentStep.set('confirm');
    }
  }

  goBack(step: 'services' | 'datetime'): void {
    this.currentStep.set(step);
  }

  canSubmitBooking(): boolean {
    return !!(this.selectedServiceId() && this.selectedDate() && this.selectedTimeSlot());
  }

  submitBooking(): void {
    if (!this.canSubmitBooking() || this.isBooking()) return;

    this.isBooking.set(true);
    let payload = {
      providerId: this.providerId(),
      serviceId: this.selectedServiceId()!,
      date: this.selectedDate(),
      timeSlot: this.selectedTimeSlot()!,
    };

    this.bookingsService
      .createBooking(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isBooking.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.notifyService.showSuccess('تم حجز الموعد بنجاح!');
          this.completedBookings.update((oldBooking) => [...oldBooking, res?.booking]);
          this.providerId.set('');
          this.selectedServiceId.set('');
          this.selectedDate.set('');
          this.selectedTimeSlot.set('');
          this.currentStep.set('services');
        },
        error: (err) => {
          this.notifyService.showError(
            err?.error?.message ?? 'تعذر إتمام الحجز، يرجى المحاولة مرة أخرى.',
          );
        },
      });
  }

  toggleReviewForm(): void {
    if (this.completedBookings().length === 0) {
      this.notifyService.showError('عذراً، يمكنك تقييم المزود فقط بعد إتمام حجز وإكماله بنجاح.');
      return;
    }
    this.showReviewForm.update((v) => !v);
  }

  setRating(rating: number): void {
    this.reviewRating.setValue(rating);
  }

  onStarHover(star: number): void {
    this.hoverRating.set(star);
  }

  onStarLeave(): void {
    this.hoverRating.set(0);
  }

  getDisplayRating(): number {
    return this.hoverRating() > 0 ? this.hoverRating() : this.reviewRating.value;
  }

  submitReview(): void {
    if (this.reviewRating.invalid || this.isSubmittingReview()) return;

    const completed = this.completedBookings();
    if (completed.length === 0) {
      this.notifyService.showError('لا يوجد حجز مكتمل لهذا المزود لتتمكن من تقييمه.');
      return;
    }

    const bookingId = completed[0]._id || completed[0].id;

    this.isSubmittingReview.set(true);
    const payload = {
      bookingId,
      rating: this.reviewRating.value,
      comment: this.reviewComment.value.trim() || undefined,
    };

    this.reviewsService
      .createReview(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmittingReview.set(false)),
      )
      .subscribe({
        next: () => {
          this.notifyService.showSuccess('تم إضافة تقييمك بنجاح');
          this.showReviewForm.set(false);
          this.reviewComment.setValue('');
          this.loadProviderReviews(this.providerId());
        },
        error: (err) => {
          this.notifyService.showError(err?.error?.message ?? 'تعذر إرسال التقييم');
        },
      });
  }

  loadProviderReviews(id: string): void {
    this.isReviewsLoading.set(true);
    this.reviewsService
      .getProviderReviews(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isReviewsLoading.set(false)),
      )
      .subscribe({
        next: (res: any) => {
          this.reviews.set(res?.reviews ?? (Array.isArray(res) ? res : []));
        },
        error: (err) => {
          this.reviewsError.set(err?.error?.message ?? 'تعذر تحميل التقييمات');
        },
      });
  }

  getServiceId(svc: IProviderService): string {
    return svc._id || svc.id || '';
  }

  providerInitial(): string {
    const name = this.provider()?.salonName || this.provider()?.name || 'ص';
    return name.charAt(0).toUpperCase();
  }

  getProviderId(): string {
    const p = this.provider();
    return p?._id || p?.id || this.providerId();
  }

  getCoverGradient(id: string): string {
    const gradients = [
      'from-primary to-primary-container',
      'from-brand-gold to-primary',
      'from-tertiary to-primary',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }

  getWorkingStatus(workingHours: any[]): { isOpen: boolean; text: string } {
    if (!workingHours || !Array.isArray(workingHours) || workingHours.length === 0) {
      return { isOpen: true, text: 'متاح للحجز' };
    }
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todaySchedule = workingHours.find((w) => w.dayOfWeek === dayOfWeek);
    if (!todaySchedule || !todaySchedule.isOpen) {
      return { isOpen: false, text: 'مغلق اليوم' };
    }
    return {
      isOpen: true,
      text: `مفتوح اليوم حتى ${this.formatTimeTo12Hour(todaySchedule.endTime)}`,
    };
  }

  formatTimeTo12Hour(timeStr: string): string {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let hour = parseInt(hStr, 10);
    const minute = mStr || '00';
    const period = hour >= 12 ? 'م' : 'ص';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${hour}:${minute} ${period}`;
  }

  formatDuration(minutes: number): string {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours} ساعة و ${mins} دقيقة`;
    if (hours > 0) return `${hours} ساعة`;
    return `${mins} دقيقة`;
  }

  formatCurrency(amount: number): string {
    return `${amount ?? 0} ج.م`;
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatReviewDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getAverageRating(): number {
    const prov = this.provider();
    if (prov?.averageRating !== undefined && prov?.averageRating !== null) {
      return prov.averageRating;
    }
    const revs = this.reviews();
    if (revs.length === 0) return 0;
    const sum = revs.reduce((acc, r) => acc + (r.rating || 0), 0);
    return sum / revs.length;
  }

  getRoundAverage(): number {
    return Math.round(this.getAverageRating());
  }

  getReviewerName(review: IReview): string {
    if (typeof review.clientId === 'object' && review.clientId !== null) {
      return (review.clientId as any).name || 'عميل لوكاك';
    }
    return 'عميل لوكاك';
  }

  getReviewerInitial(review: IReview): string {
    const name = this.getReviewerName(review);
    return name.charAt(0).toUpperCase();
  }
}
