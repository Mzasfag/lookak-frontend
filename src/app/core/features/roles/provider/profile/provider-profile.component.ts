import { isPlatformBrowser, NgClass } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Toast } from 'primeng/toast';
import { finalize } from 'rxjs';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import {
  IProviderPortfolioEntry,
  IProviderPortfolioMutationResponse,
  IProviderProfile,
  IProviderProfilePayload,
} from '../../../../models/provider.model';
import { NotifyService } from '../../../../services/notify.service';
import { ProviderProfileService } from '../../../../services/provider-profile.service';

/** Maximum number of showcase photos a provider may add to the gallery. */
export const MAX_PORTFOLIO_IMAGES = 8;

/** Maximum accepted image size (5 MB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Broad international number validation; spaces, brackets and dashes are supported. */
export const PHONE_PATTERN = '^\\+?\\d[\\d\\s()-]{6,19}$';

/** MIME types accepted by the image uploader and advertised by the file picker. */
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPTED_IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

/** A single tile in the portfolio gallery (server URL or local preview). */
export interface ProviderPortfolioImage {
  /** Stable local key used for `@for` tracking and per-image state updates. */
  id: string;
  /** Display source — a remote URL (persisted) or a local data URL. */
  url: string;
  /** Optional accessible caption supplied by the backend. */
  caption?: string;
  /** Portfolio sub-document id required to delete a persisted image. */
  portfolioImageId?: string;
  /** `true` until an upload is confirmed by the server. */
  isLocal: boolean;
  /** `true` while this exact image is being uploaded. */
  isUploading: boolean;
  /** `true` while this exact persisted image is being deleted. */
  isDeleting?: boolean;
  /** `true` if a remote image could not be loaded by the browser. */
  hasLoadError?: boolean;
}

/** Read-only shape of the loaded profile used by the summary card. */
export interface ProviderProfileView {
  name: string;
  email: string;
  phone: string;
  salonName: string;
  address: string;
  description: string;
  averageRating: number;
  reviewsCount: number;
  subscriptionStatus: string;
}

@Component({
  selector: 'app-provider-profile',
  imports: [ReactiveFormsModule, LoaderComponent, Toast, NgClass],
  templateUrl: './provider-profile.component.html',
  styleUrl: './provider-profile.component.css',
})
export class ProviderProfileComponent implements OnInit {
  private readonly profileService = inject(ProviderProfileService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly isSaving = signal(false);
  readonly isUploading = signal(false);

  /** Exposed for the template so gallery limits never diverge from the upload logic. */
  readonly maxPortfolioImages = MAX_PORTFOLIO_IMAGES;

  /** Last successfully loaded profile — feeds the read-only summary card. */
  readonly profile = signal<ProviderProfileView | null>(null);

  /** Portfolio gallery tiles (server images + optimistic local previews). */
  readonly portfolioImages = signal<ProviderPortfolioImage[]>([]);

  /** Number of in-flight uploads (drives the global upload spinner). */
  private activeUploads = 0;

  // ---------------------------------------------------------------------------
  // Reactive form — validators mirror the backend's user/profile requirements.
  // ---------------------------------------------------------------------------
  readonly profileForm = new FormGroup({
    /** Owner / account name. */
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern('.*\\S.*'),
        Validators.minLength(2),
        Validators.maxLength(60),
      ],
    }),
    /** Salon display name — core to the public salon profile. */
    salonName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern('.*\\S.*'),
        Validators.minLength(2),
        Validators.maxLength(80),
      ],
    }),
    /** Provider contact number. */
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(PHONE_PATTERN)],
    }),
    /** Physical address of the salon. */
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern('.*\\S.*'), Validators.maxLength(200)],
    }),
    /** Public salon description. */
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern('.*\\S.*'),
        Validators.minLength(10),
        Validators.maxLength(1000),
      ],
    }),
  });

  /** Optional caption submitted with the currently selected gallery images. */
  readonly portfolioCaption = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(200)],
  });

  // ---------------------------------------------------------------------------
  // Lifecycle and profile persistence
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    this.loadProfile();
  }

  /** Fetches the provider's profile and server-persisted portfolio. */
  loadProfile(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.hasError.set(false);

    this.profileService
      .getProfile()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ user }) => this.applyProfile(user, true),
        error: () => this.hasError.set(true),
      });
  }

  /** Persists the edited profile fields through `PATCH /api/users/me`. */
  onSave(): void {
    if (this.isSaving()) {
      return;
    }
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notifyService.showWarn('يرجى استكمال البيانات المطلوبة قبل الحفظ');
      return;
    }

    const value = this.profileForm.getRawValue();
    const description = value.description.trim();
    const payload: IProviderProfilePayload = {
      name: value.name.trim(),
      salonName: value.salonName.trim(),
      phone: value.phone.trim(),
      address: value.address.trim(),
      description,
      // Keep the legacy public-card field in sync until all consumers use description.
      bio: description,
    };

    this.isSaving.set(true);
    this.profileService
      .updateProfile(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: ({ user }) => {
          // A PATCH response may omit portfolio fields, so never clear the gallery here.
          this.applyProfile(user, false);
          this.notifyService.showSuccess('تم حفظ التغييرات بنجاح');
        },
        error: () => this.notifyService.showError('تعذر حفظ التغييرات، حاول مرة أخرى'),
      });
  }

  // ---------------------------------------------------------------------------
  // Portfolio management
  // ---------------------------------------------------------------------------
  /** Validates selected files, then creates optimistic previews and uploads them. */
  onFilesSelected(event: Event): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Permit selecting the exact same file again after it is removed.
    input.value = '';

    if (!files.length) {
      return;
    }

    const availableSlots = Math.max(0, MAX_PORTFOLIO_IMAGES - this.portfolioImages().length);
    if (!availableSlots) {
      this.notifyService.showWarn(`يمكنك إضافة ${MAX_PORTFOLIO_IMAGES} صور كحد أقصى في المعرض`);
      return;
    }

    const validFiles = files.filter((file) => this.isAcceptedImage(file));
    const acceptedFiles = validFiles.slice(0, availableSlots);
    if (validFiles.length > acceptedFiles.length) {
      this.notifyService.showWarn(`تم اختيار أول ${availableSlots} صور فقط لبلوغ الحد الأقصى`);
    }

    if (!acceptedFiles.length) {
      return;
    }

    const caption = this.portfolioCaption.value.trim();
    if (this.portfolioCaption.invalid) {
      this.portfolioCaption.markAsTouched();
      this.notifyService.showWarn('يجب ألا يتجاوز وصف الصور 200 حرف');
      return;
    }

    this.previewAndUpload(acceptedFiles, caption);
  }

  /** Removes a local preview or deletes a persisted image, then removes its tile on success. */
  onRemoveImage(image: ProviderPortfolioImage): void {
    if (image.isUploading || image.isDeleting) {
      return;
    }

    if (image.isLocal) {
      this.portfolioImages.update((list) => list.filter((item) => item.id !== image.id));
      return;
    }

    if (!image.portfolioImageId) {
      this.notifyService.showWarn('تعذر تحديد الصورة المطلوب حذفها، حدّث الصفحة ثم حاول مرة أخرى');
      return;
    }

    this.portfolioImages.update((list) =>
      list.map((item) => (item.id === image.id ? { ...item, isDeleting: true } : item)),
    );

    this.profileService
      .deletePortfolioImage(image.portfolioImageId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() =>
          this.portfolioImages.update((list) =>
            list.map((item) => (item.id === image.id ? { ...item, isDeleting: false } : item)),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.portfolioImages.update((list) => list.filter((item) => item.id !== image.id));
          this.notifyService.showSuccess('تم حذف الصورة من المعرض');
        },
        error: () => this.notifyService.showError('تعذر حذف الصورة، حاول مرة أخرى'),
      });
  }

  /** Replaces a broken image tile with a clear fallback state instead of a broken image icon. */
  onImageLoadError(image: ProviderPortfolioImage): void {
    this.portfolioImages.update((list) =>
      list.map((item) => (item.id === image.id ? { ...item, hasLoadError: true } : item)),
    );
  }

  // ---------------------------------------------------------------------------
  // Presentation helpers
  // ---------------------------------------------------------------------------
  fieldInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  get submitDisabled(): boolean {
    return this.profileForm.invalid || !this.profileForm.dirty || this.isSaving();
  }

  get uploadHint(): string {
    return `حتى ${MAX_PORTFOLIO_IMAGES} صورة، بحد أقصى 5 ميجابايت للصورة الواحدة.`;
  }

  /** Formats a decimal rating for the summary card (for example, `4.8`). */
  formatRating(value?: number): string {
    return (value ?? 0).toFixed(1);
  }

  profileInitial(): string {
    const value = this.profile()?.salonName || this.profile()?.name || 'ص';
    return value.trim().charAt(0).toUpperCase() || 'ص';
  }

  portfolioImageAlt(image: ProviderPortfolioImage, index: number): string {
    return (
      image.caption?.trim() ||
      `صورة ${index + 1} من أعمال ${this.profile()?.salonName || 'الصالون'}`
    );
  }

  /** Arabic label for the subscription status shown in the summary card. */
  subscriptionLabel(status?: string): string {
    switch (status) {
      case 'active':
        return 'اشتراك نشط';
      case 'trial':
        return 'فترة تجريبية';
      case 'past_due':
        return 'متأخر الدفع';
      case 'cancelled':
        return 'ملغي';
      case 'free':
      default:
        return 'الباقة المجانية';
    }
  }

  subscriptionPillClass(status?: string): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'trial':
        return 'bg-sky-500/10 text-sky-700 ring-sky-500/30';
      case 'past_due':
        return 'bg-red-500/10 text-red-600 ring-red-500/30';
      case 'cancelled':
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
      case 'free':
      default:
        return 'bg-brand-gold/10 text-brand-gold ring-brand-gold/30';
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private previewAndUpload(files: File[], caption: string): void {
    this.beginUpload();

    void Promise.all(
      files.map(async (file) => ({
        id: this.uid(),
        url: await this.readFileAsDataURL(file),
        caption: caption || undefined,
        isLocal: true,
        isUploading: true,
      })),
    )
      .then((images) => {
        this.portfolioImages.update((list) => [...list, ...images]);

        this.profileService
          .uploadPortfolioImages(files, caption || undefined)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.endUpload()),
          )
          .subscribe({
            next: (response) => {
              const uploadedImages = this.uploadedEntries(response, images.length);
              this.applyUploadedImages(images, uploadedImages);
              this.portfolioCaption.reset();
              this.notifyService.showSuccess('تمت إضافة الصورة إلى المعرض');
            },
            error: () => {
              // Preserve the preview so the provider can still decide to keep or remove it.
              this.portfolioImages.update((list) =>
                list.map((item) =>
                  images.some((image) => image.id === item.id)
                    ? { ...item, isUploading: false, isLocal: true }
                    : item,
                ),
              );
              this.notifyService.showWarn(
                'تعذر رفع الصور الآن؛ ستظهر لك محلياً حتى تعيد تحميل الصفحة',
              );
            },
          });
      })
      .catch(() => {
        this.endUpload();
        this.notifyService.showError('تعذر قراءة إحدى الصور المختارة');
      });
  }

  /** Checks both the browser-reported MIME type and extension fallback for JPEG files. */
  private isAcceptedImage(file: File): boolean {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type) && !ACCEPTED_IMAGE_EXTENSION.test(file.name)) {
      this.notifyService.showWarn(`\"${file.name}\" ليس ملف JPEG أو PNG أو WebP`);
      return false;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      this.notifyService.showWarn(`يجب ألا يتجاوز حجم \"${file.name}\" 5 ميجابايت`);
      return false;
    }
    return true;
  }

  /** Extracts uploaded entries from the current API response and earlier response envelopes. */
  private uploadedEntries(
    response: IProviderPortfolioMutationResponse,
    expectedCount: number,
  ): IProviderPortfolioEntry[] {
    const directEntries = response.images?.length
      ? response.images
      : response.image
        ? [response.image]
        : [];
    if (directEntries.length) {
      return directEntries.filter((entry) => !!entry?.url);
    }

    const portfolio = response.portfolio ?? response.user?.portfolio ?? [];
    return portfolio.slice(-expectedCount).filter((entry) => !!entry?.url);
  }

  /** Replaces local previews with persisted image metadata returned by the API. */
  private applyUploadedImages(
    localImages: ProviderPortfolioImage[],
    uploadedImages: IProviderPortfolioEntry[],
  ): void {
    if (uploadedImages.length !== localImages.length) {
      this.portfolioImages.update((list) =>
        list.map((item) =>
          localImages.some((image) => image.id === item.id)
            ? { ...item, isUploading: false, isLocal: true }
            : item,
        ),
      );
      // A successful response without per-image metadata can still be synced
      // from the provider profile endpoint without discarding the preview first.
      this.loadProfile();
      return;
    }

    const entriesByLocalId = new Map(
      localImages.map((image, index) => [image.id, uploadedImages[index]]),
    );
    this.portfolioImages.update((list) =>
      list.map((item) => {
        const uploaded = entriesByLocalId.get(item.id);
        return uploaded
          ? {
              ...item,
              url: uploaded.url,
              caption: uploaded.caption ?? item.caption,
              portfolioImageId: this.portfolioImageId(uploaded),
              isLocal: false,
              isUploading: false,
              hasLoadError: false,
            }
          : item;
      }),
    );
  }

  private applyProfile(user: IProviderProfile, syncPortfolio: boolean): void {
    const previous = this.profile();
    const description = user.description || user.bio || previous?.description || '';
    const profile: ProviderProfileView = {
      name: user.name ?? previous?.name ?? '',
      email: user.email ?? previous?.email ?? '',
      phone: user.phone ?? previous?.phone ?? '',
      salonName: user.salonName ?? previous?.salonName ?? '',
      address: user.address ?? previous?.address ?? '',
      description,
      averageRating: user.averageRating ?? previous?.averageRating ?? 0,
      reviewsCount: user.reviewsCount ?? previous?.reviewsCount ?? 0,
      subscriptionStatus: user.subscriptionStatus ?? previous?.subscriptionStatus ?? 'free',
    };

    this.profile.set(profile);
    this.profileForm.patchValue({
      name: profile.name,
      salonName: profile.salonName,
      phone: profile.phone,
      address: profile.address,
      description: profile.description,
    });
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();

    if (syncPortfolio) {
      this.portfolioImages.set(this.normalizePortfolio(user.portfolio, user.portfolioImages));
    }
  }

  private normalizePortfolio(
    portfolio?: IProviderPortfolioEntry[],
    legacyUrls?: string[],
  ): ProviderPortfolioImage[] {
    const knownUrls = new Set<string>();
    const tiles: ProviderPortfolioImage[] = [];

    for (const entry of portfolio ?? []) {
      if (!entry.url || knownUrls.has(entry.url)) {
        continue;
      }
      knownUrls.add(entry.url);
      tiles.push({
        id: this.uid(),
        url: entry.url,
        caption: entry.caption,
        portfolioImageId: this.portfolioImageId(entry),
        isLocal: false,
        isUploading: false,
      });
    }

    for (const url of legacyUrls ?? []) {
      if (!url || knownUrls.has(url)) {
        continue;
      }
      knownUrls.add(url);
      tiles.push({ id: this.uid(), url, isLocal: false, isUploading: false });
    }

    return tiles.slice(0, MAX_PORTFOLIO_IMAGES);
  }

  private beginUpload(): void {
    this.activeUploads += 1;
    this.isUploading.set(true);
  }

  private endUpload(): void {
    this.activeUploads = Math.max(0, this.activeUploads - 1);
    this.isUploading.set(this.activeUploads > 0);
  }

  /** Supports the API's explicit id field and common MongoDB serialization variants. */
  private portfolioImageId(entry: IProviderPortfolioEntry): string | undefined {
    return entry.portfolioImageId ?? entry._id ?? entry.id;
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId)) {
        reject(new Error('FileReader is unavailable on the server'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
  }

  private uid(): string {
    if (
      isPlatformBrowser(this.platformId) &&
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
