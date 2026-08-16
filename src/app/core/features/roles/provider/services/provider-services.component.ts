import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { AUTH_USER_COOKIE } from './../../../../constants/auth.constants';
import { IProviderService, IProviderServicePayload } from './../../../../models/provider.model';
import { IUser } from './../../../../models/user.model';
import { AuthService } from './../../../../services/auth.service';
import { NotifyService } from './../../../../services/notify.service';
import { ProviderServicesService } from './../../../../services/provider-services.service';
import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CookieService } from 'ngx-cookie-service';
import { finalize } from 'rxjs';

/** A single quick-overview statistic shown above the services grid. */
export interface ProviderServicesStatChip {
  label: string;
  value: string;
  icon: string;
  iconClasses: string;
}

@Component({
  selector: 'app-provider-services',
  imports: [ReactiveFormsModule, LoaderComponent],
  templateUrl: './provider-services.component.html',
  styleUrl: './provider-services.component.css',
})
export class ProviderServicesComponent implements OnInit {
  private readonly providerServicesService = inject(ProviderServicesService);
  private readonly notifyService = inject(NotifyService);
  private readonly authService = inject(AuthService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  readonly services = signal<IProviderService[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  // Add / edit modal
  readonly isFormOpen = signal(false);
  readonly editingService = signal<IProviderService | null>(null);
  readonly isSaving = signal(false);

  // Delete confirmation modal
  readonly serviceToDelete = signal<IProviderService | null>(null);
  readonly isDeleting = signal(false);

  /** Service id currently being toggled (drives the card-level loading state). */
  readonly busyServiceId = signal<string | null>(null);

  readonly isEditMode = computed(() => this.editingService() !== null);

  private readonly numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn');
  private readonly currencyFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  });

  // ---------------------------------------------------------------------------
  // Reactive form — mirrors the POST /api/services body
  // (validators match the backend `Service.js` + `serviceSchemas`).
  // ---------------------------------------------------------------------------
  readonly serviceForm = new FormGroup({
    /** Service name — required, 2..100 chars. */
    name: new FormControl('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(100),
    ]),
    /** Optional free-text description — max 500 chars. */
    description: new FormControl('', [Validators.maxLength(500)]),
    /** Price in EGP — required, non-negative. */
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    /** Duration in minutes — required, 5..480. */
    duration: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(5),
      Validators.max(480),
    ]),
  });

  get nameControl(): AbstractControl | null {
    return this.serviceForm.get('name');
  }

  get descriptionControl(): AbstractControl | null {
    return this.serviceForm.get('description');
  }

  get priceControl(): AbstractControl | null {
    return this.serviceForm.get('price');
  }

  get durationControl(): AbstractControl | null {
    return this.serviceForm.get('duration');
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  readonly statChips = computed<ProviderServicesStatChip[]>(() => {
    const list = this.services();
    const activeCount = list.filter((service) => service.isActive).length;
    const prices = list
      .map((service) => service.price)
      .filter((price) => price != null && !Number.isNaN(price));
    const durations = list
      .map((service) => service.duration)
      .filter((duration) => duration != null && duration > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : null;

    return [
      {
        label: 'إجمالي الخدمات',
        value: this.formatNumber(list.length),
        icon: 'pi-list',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
      },
      {
        label: 'خدمات نشطة',
        value: this.formatNumber(activeCount),
        icon: 'pi-check-circle',
        iconClasses: 'bg-emerald-500/10 text-emerald-600',
      },
      {
        label: 'أقل سعر',
        value: minPrice != null ? this.formatCurrency(minPrice) : '—',
        icon: 'pi-tag',
        iconClasses: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'أطول مدة',
        value: maxDuration != null ? this.formatDuration(maxDuration) : '—',
        icon: 'pi-clock',
        iconClasses: 'bg-amber-500/10 text-amber-600',
      },
    ];
  });

  ngOnInit(): void {
    // The auth token + provider id live in browser-only cookies; skip the
    // initial fetch during SSR so hydration never flashes an auth error.
    if (isPlatformBrowser(this.platformId)) {
      this.loadServices();
    }
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  loadServices(): void {
    const providerId = this.resolveProviderId();
    if (!providerId) {
      this.hasError.set(true);
      this.notifyService.showError('تعذر تحديد حساب مزود الخدمة');
      return;
    }

    this.isLoading.set(true);
    this.hasError.set(false);
    this.providerServicesService
      .getProviderServices(providerId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.services.set(response.services ?? []);
          this.totalCount.set(response.count ?? response.services?.length ?? 0);
          console.log(response);
        },
        error: (error) => {
          this.services.set([]);
          this.totalCount.set(0);
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message || 'تعذر تحميل الخدمات');
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Add / edit modal
  // ---------------------------------------------------------------------------
  openAddModal(): void {
    this.editingService.set(null);
    this.serviceForm.reset({ name: '', description: '', price: null, duration: null });
    this.isFormOpen.set(true);
  }

  openEditModal(service: IProviderService): void {
    this.editingService.set(service);
    this.serviceForm.reset({
      name: service.name,
      description: service.description ?? '',
      price: service.price,
      duration: service.duration,
    });
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    if (this.isSaving()) {
      return;
    }
    this.isFormOpen.set(false);
    this.editingService.set(null);
  }

  onSubmit(): void {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      this.notifyService.showWarn('يرجى استكمال بيانات الخدمة بشكل صحيح');
      return;
    }

    const editing = this.editingService();
    const isEdit = editing !== null;
    const payload = this.buildPayload();

    this.isSaving.set(true);
    const request$ = isEdit
      ? this.providerServicesService.updateService(this.serviceKey(editing), payload)
      : this.providerServicesService.createService(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (response) => {
          if (response.service) {
            this.upsertService(response.service);
          }
          this.isFormOpen.set(false);
          this.editingService.set(null);
          this.notifyService.showSuccess(
            isEdit ? 'تم تحديث الخدمة بنجاح' : 'تمت إضافة الخدمة بنجاح',
          );
        },
        error: (error) => {
          this.notifyService.showError(
            error?.error?.message || (isEdit ? 'تعذر تحديث الخدمة' : 'تعذر إضافة الخدمة'),
          );
        },
      });
  }

  private buildPayload(): IProviderServicePayload {
    const description = (this.descriptionControl?.value ?? '').toString().trim();
    return {
      name: (this.nameControl?.value ?? '').toString().trim(),
      description: description || undefined,
      price: Number(this.priceControl?.value ?? 0),
      duration: Number(this.durationControl?.value ?? 0),
    };
  }

  // ---------------------------------------------------------------------------
  // Active toggle (PATCH isActive) — paused services stay in the local grid as
  // «موقوفة» so the provider can re-activate them anytime without deleting them.
  // ---------------------------------------------------------------------------
  toggleActive(service: IProviderService): void {
    if (this.isDeleting() || this.isRowBusy(service)) {
      return;
    }

    const serviceId = this.serviceKey(service);
    this.busyServiceId.set(serviceId);
    this.providerServicesService
      .updateServiceStatus(serviceId, !service.isActive)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyServiceId.set(null)),
      )
      .subscribe({
        next: (response) => {
          // The backend echoes the updated document; the fallback keeps the UI
          // consistent even if a future API drops the `service` field.
          const updated = response.service ?? { ...service, isActive: !service.isActive };
          // Upsert (never remove) so the provider can flip it back to active
          // anytime. Permanent removal is handled exclusively by confirmDelete.
          this.upsertService(updated);
          this.notifyService.showSuccess(
            updated.isActive ? 'تم تفعيل الخدمة' : 'تم إيقاف الخدمة مؤقتًا',
          );
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message || 'تعذر تحديث حالة الخدمة');
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Permanent delete (with confirmation modal)
  // ---------------------------------------------------------------------------
  requestDelete(service: IProviderService): void {
    if (this.isDeleting() || this.isRowBusy(service)) {
      return;
    }
    this.serviceToDelete.set(service);
  }

  cancelDelete(): void {
    if (this.isDeleting()) {
      return;
    }
    this.serviceToDelete.set(null);
  }

  confirmDelete(): void {
    const service = this.serviceToDelete();
    if (!service || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.providerServicesService
      .permanentlyDeleteService(this.serviceKey(service))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDeleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.removeService(service);
          this.serviceToDelete.set(null);
          this.notifyService.showSuccess(`تم حذف خدمة «${service.name}» نهائيًا`);
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message || 'تعذر حذف الخدمة');
        },
      });
  }

  isRowBusy(service: IProviderService): boolean {
    return this.busyServiceId() === this.serviceKey(service);
  }

  // ---------------------------------------------------------------------------
  // Local list mutation helpers
  // ---------------------------------------------------------------------------
  serviceKey(service: IProviderService): string {
    return service._id ?? service.id ?? '';
  }

  /**
   * Insert or replace a service returned by a mutation. The list endpoint
   * sorts by name, so keep the same order after local edits.
   */
  private upsertService(updated: IProviderService): void {
    const key = this.serviceKey(updated);
    this.services.update((list) => {
      const exists = list.some((service) => this.serviceKey(service) === key);
      const next = exists
        ? list.map((service) =>
            this.serviceKey(service) === key ? { ...service, ...updated } : service,
          )
        : [...list, updated];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });
    this.totalCount.set(this.services().length);
  }

  private removeService(removed: IProviderService | string): void {
    const key = typeof removed === 'string' ? removed : this.serviceKey(removed);
    this.services.update((list) => list.filter((service) => this.serviceKey(service) !== key));
    this.totalCount.set(this.services().length);
  }

  private resolveProviderId(): string | null {
    if (isPlatformBrowser(this.platformId) && this.cookieService.check(AUTH_USER_COOKIE)) {
      try {
        const user = JSON.parse(this.cookieService.get(AUTH_USER_COOKIE)) as IUser;
        const id = this.userIdOf(user);
        if (id) {
          return id;
        }
      } catch {
        // Malformed cookie — fall back to the in-memory auth state below.
      }
    }
    return this.userIdOf(this.authService.userData());
  }

  private userIdOf(user: IUser | null | undefined): string | null {
    if (!user) {
      return null;
    }
    const extended = user as IUser & { _id?: string };
    return extended.id ?? extended._id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Presentation helpers
  // ---------------------------------------------------------------------------
  fieldInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  formatNumber(value: number): string {
    return this.numberFormatter.format(value);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.currencyFormatter.format(value);
  }

  formatDuration(minutes: number | null | undefined): string {
    if (minutes == null || Number.isNaN(minutes) || minutes <= 0) {
      return '—';
    }
    if (minutes % 60 === 0) {
      return `${this.formatNumber(minutes / 60)} ساعة`;
    }
    if (minutes < 60) {
      return `${this.formatNumber(minutes)} دقيقة`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${this.formatNumber(hours)} س و${this.formatNumber(rest)} د`;
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('ar-EG-u-nu-latn');
  }

  statusLabel(service: IProviderService): string {
    return service.isActive ? 'نشط' : 'موقوفة';
  }

  statusBadgeClass(service: IProviderService): string {
    return service.isActive
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30'
      : 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
  }

  statusDotClass(service: IProviderService): string {
    return service.isActive ? 'bg-emerald-500' : 'bg-on-surface-variant/50';
  }

  toggleLabel(service: IProviderService): string {
    return service.isActive ? 'إيقاف' : 'تفعيل';
  }

  /**
   * Card surface tone — paused services drop onto a muted container background
   * with a softer ring so they visually recede next to the active ones.
   * (The static element classes carry layout; these bind the color surface.)
   */
  cardClass(service: IProviderService): string {
    return service.isActive
      ? 'bg-surface-container-lowest ring-outline-variant/20 hover:ring-brand-gold/30'
      : 'bg-surface-container/60 ring-outline-variant/40 hover:ring-outline-variant/60';
  }

  /**
   * Toggle button tone — a solid, high-contrast «تفعيل» action for paused
   * services, versus the muted outline «إيقاف» for active ones.
   */
  toggleButtonClass(service: IProviderService): string {
    return service.isActive
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 hover:bg-emerald-500/15'
      : 'bg-emerald-600 text-white ring-emerald-600/40 shadow-sm shadow-emerald-600/20 hover:bg-emerald-700';
  }
}
