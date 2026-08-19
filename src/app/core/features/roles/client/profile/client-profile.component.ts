import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  computed,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { UserService } from '../../../../../core/services/user.service';
import { BookingsService } from '../../../../../core/services/bookings.service';
import { NotifyService } from '../../../../../core/services/notify.service';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { BookingStatus } from '../../../../../core/models/admin.model';
import {
  IClientBooking,
  IClientBookingsResponse,
  IClientProfile,
  IClientProfileResponse,
} from '../../../../../core/models/client.model';
import { CookieService } from 'ngx-cookie-service';
import { IUser } from '../../../../models/user.model';
import { AUTH_TOKEN_COOKIE, AUTH_USER_COOKIE } from '../../../../constants/auth.constants';
import { AuthService } from '../../../../services/auth.service';

/** Non-empty string validator (rejects whitespace-only input). */
function nonEmpty(c: AbstractControl): ValidationErrors | null {
  const v = (c.value || '').trim();
  return v.length > 0 ? null : { nonEmpty: true };
}

/** Broad international phone number validation (mirrors the provider profile form). */
const CLIENT_PHONE_PATTERN = new RegExp('^[+]?[0-9][0-9 ()-]{6,19}$');

/** A single statistics chip rendered at the top of the profile. */
export interface ProfileStat {
  label: string;
  value: number | string;
  icon: string;
  iconClasses: string;
  glowClasses: string;
}

export type ProfileTab = 'personal' | 'bookings' | 'security';
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value as string | undefined;
  const confirmPassword = group.get('confirmPassword')?.value as string | undefined;
  return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
}

/** Tab descriptor used to render the horizontal RTL tab bar. */
interface TabDescriptor {
  id: ProfileTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-client-profile',
  imports: [ReactiveFormsModule, NgClass, RouterLink, LoaderComponent],
  templateUrl: './client-profile.component.html',
  styleUrl: './client-profile.component.css',
})
export class ClientProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly bookingsService = inject(BookingsService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private cookieService = inject(CookieService);
  private platformId = inject(PLATFORM_ID);
  formMode = signal<'forget' | 'reset'>('forget');
  authService = inject(AuthService);

  // ---------------------------------------------------------------------------
  // State (Angular Signals)
  // ---------------------------------------------------------------------------
  readonly profile = signal<IClientProfile | null>(null);
  readonly bookings = signal<IClientBooking[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly isSaving = signal(false);
  readonly isChangingPassword = signal(false);
  readonly isForgetPassword = signal(false);

  readonly activeTab = signal<ProfileTab>('personal');
  readonly isEditing = signal(false);

  readonly tabs: TabDescriptor[] = [
    { id: 'personal', label: 'الشخصية والمعلومات العامة', icon: 'pi pi-id-card' },
    { id: 'bookings', label: 'الحجوزات والمواعيد', icon: 'pi pi-calendar-clock' },
    { id: 'security', label: 'الإعدادات والأمان', icon: 'pi pi-shield' },
  ];

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  readonly userInitials = computed<string>(() => {
    const name = this.profile()?.name?.trim() || '';
    if (!name) return 'ع';
    const parts = name.split(/\s+/);
    return parts.length > 1 ? parts[0][0] + parts[1][0] : name.charAt(0);
  });

  readonly isVerified = computed<boolean>(() => {
    const p = this.profile() as (IClientProfile & Record<string, unknown>) | null;
    return !!p?.['isActive'] || p !== null;
  });

  readonly registrationDate = computed<string>(() => {
    const profileData = this.profile() as Record<string, unknown> | null;
    if (!profileData) return '—';
    
    const value = profileData['createdAt'] || profileData['created_at'];
    if (!value) return '—';

    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '—';

    // استخدام صيغة آمنة ومتوافقة مع الـ SSR والتصميم
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  readonly totalBookings = computed(() => this.bookings().length);
  readonly completedBookings = computed(
    () => this.bookings().filter((b) => b.status === 'completed').length,
  );
  readonly activeAppointments = computed(
    () => this.bookings().filter((b) => b.status === 'pending' || b.status === 'confirmed').length,
  );

  readonly stats = computed<ProfileStat[]>(() => [
    {
      label: 'إجمالي الحجوزات',
      value: this.totalBookings(),
      icon: 'pi-calendar',
      iconClasses: 'bg-primary/10 text-primary ring-1 ring-primary/20',
      glowClasses: 'shadow-primary/10',
    },
    {
      label: 'الحجوزات المكتملة',
      value: this.completedBookings(),
      icon: 'pi-check-circle',
      iconClasses: 'bg-tertiary/10 text-tertiary ring-1 ring-tertiary/20',
      glowClasses: 'shadow-tertiary/10',
    },
    {
      label: 'المواعيد النشطة',
      value: this.activeAppointments(),
      icon: 'pi-clock',
      iconClasses: 'bg-brand-gold/15 text-brand-gold ring-1 ring-brand-gold/20',
      glowClasses: 'shadow-brand-gold/10',
    },
  ]);

  readonly sortedBookings = computed<IClientBooking[]>(() =>
    [...this.bookings()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
  );

  // ---------------------------------------------------------------------------
  // Personal information form
  // ---------------------------------------------------------------------------
  readonly profileForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonEmpty,
        Validators.minLength(2),
        Validators.maxLength(60),
      ],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(CLIENT_PHONE_PATTERN)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
  });

  // ---------------------------------------------------------------------------
  // Security / password form
  // ---------------------------------------------------------------------------
  resetForm = new FormGroup(
    {
      token: new FormControl(''),
      password: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    },
    { validators: passwordsMatch },
  );

  get passwordController() {
    return this.resetForm.get('password');
  }

  get confirmPasswordController() {
    return this.resetForm.get('confirmPassword');
  }

  forgetPasswordForm = new FormGroup({
    identifier: new FormControl('', [Validators.required]),
  });

  get identifierController() {
    return this.forgetPasswordForm.get('identifier');
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    this.loadData()
    if (isPlatformBrowser(this.platformId)) {
      const hasUser = this.cookieService.check(AUTH_USER_COOKIE);
      if (hasUser) {
        const userData = JSON.parse(this.cookieService.get(AUTH_USER_COOKIE));
        this.forgetPasswordForm.patchValue({ identifier: userData.email });
      }
    }
  }

  loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.userService
      .getMe()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          const me = res as IClientProfileResponse;
          this.profile.set(me?.user ?? null);
          this.applyProfileToForm(me?.user ?? null);
          console.log(res);
          this.loadBookings();
        },
        error: (err) => {
          this.hasError.set(true);
          this.errorMessage.set(err?.error?.message ?? 'تعذر تحميل بيانات الملف الشخصي');
          this.notifyService.showError(this.errorMessage());
        },
      });
  }

  private loadBookings(): void {
    this.bookingsService
      .getMyBookings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res as IClientBookingsResponse;
          this.bookings.set(data?.bookings ?? []);
          console.log(res);
        },
        error: () => {
          /* Bookings are secondary; do not block the profile on failure. */
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Personal information editing
  // ---------------------------------------------------------------------------
  private applyProfileToForm(user: IClientProfile | null): void {
    if (!user) return;
    this.profileForm.patchValue({
      name: user.name ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      address: ((user as Record<string, unknown>)['address'] as string) ?? '',
    });
  }

  startEdit(): void {
    this.applyProfileToForm(this.profile());
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.applyProfileToForm(this.profile());
    this.isEditing.set(false);
    this.profileForm.markAsPristine();
  }

  saveProfile(): void {
    if (this.isSaving()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notifyService.showWarn('يرجى استكمال البيانات المطلوبة قبل الحفظ');
      return;
    }

    const value = this.profileForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      phone: value.phone.trim(),
      email: value.email.trim(),
      address: value.address.trim(),
    };

    this.isSaving.set(true);
    this.userService
      .updateMe(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (res) => {
          const updated = (res?.user ?? res) as Partial<IClientProfile>;
          this.profile.set({
            ...(this.profile() as IClientProfile),
            ...payload,
            ...(updated || {}),
          });

          this.isEditing.set(false);
          this.profileForm.markAsPristine();
          this.notifyService.showSuccess('تم حفظ بياناتك بنجاح');
        },
        error: (err) => {
          this.notifyService.showError(err?.error?.message ?? 'تعذر حفظ البيانات');
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Security / password change

  // ---------------------------------------------------------------------------
  forgetPassword() {
    this.isForgetPassword.set(true);
    if (this.forgetPasswordForm.invalid) {
      this.forgetPasswordForm.markAllAsTouched();
      return;
    }

    const data = this.forgetPasswordForm.value;

    this.authService.forgetPassword(data).subscribe({
      next: (res) => {
        this.formMode.set('reset');
        this.isForgetPassword.set(false);
        this.resetForm.get('token')?.setValue(res?.resetToken);
      },
      error: (error) => {
        this.isForgetPassword.set(false);
        this.handleLoginError(error);
      },
    });
  }

  resetPassword(): void {
    this.isChangingPassword.set(true);
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const data = {
      token: this.resetForm.get('token')?.value,
      password: this.resetForm.get('password')?.value,
    };

    this.authService.resetPassword(data).subscribe({
      next: (res) => {
        this.isChangingPassword.set(false);
        this.notifyService.showSuccess('تم تغيير كلمة المرور بنجاح');
        this.formMode.set('forget');
        this.cookieService.set(AUTH_TOKEN_COOKIE, res?.token);
        this.authService.token.set(res?.token);
        this.cookieService.set(AUTH_USER_COOKIE, JSON.stringify(res?.user));
        this.authService.userData.set(res?.user);
        this.resetForm.reset();
      },
      error: (error) => {
        this.isChangingPassword.set(false);
        this.notifyService.showError('خطأ في السيرفر، حاول مرة أخرى');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------
  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  statusLabel(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'confirmed':
        return 'مؤكد';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغى';
      case 'rejected':
        return 'مرفوض';
      default:
        return status;
    }
  }

  statusBadgeClass(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 ring-1 ring-amber-300/50';
      case 'confirmed':
        return 'bg-sky-100 text-sky-700 ring-1 ring-sky-300/50';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/50';
      case 'cancelled':
      case 'rejected':
        return 'bg-rose-100 text-rose-700 ring-1 ring-rose-300/50';
      default:
        return 'bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/40';
    }
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-EG-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('ar-EG-u-nu-latn', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatAmount(value: number): string {
    if (value == null || Number.isNaN(value)) return '—';
    return value.toLocaleString('ar-EG-u-nu-latn', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 2,
    });
  }

  fieldInvalid(field: 'name' | 'phone' | 'email' | 'address'): boolean {
    const c = this.profileForm.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  private handleLoginError(error: unknown): void {
    const httpError = error as { status?: number; error?: { message?: string } };

    switch (httpError?.status) {
      case 403:
        this.notifyService.showWarn('عذراً، حسابك موقوف مؤقتاً. يرجى التواصل مع الدعم الفني.');
        break;
      case 401:
        this.notifyService.showError('رقم الهاتف أو كلمة المرور غير صحيحة.');
        break;
      case 500:
        this.notifyService.showError('حدث خطأ في الخادم، يرجى المحاولة مرة أخرى لاحقاً.');
        break;
      default:
        this.notifyService.showError(
          httpError?.error?.message || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
        );
        break;
    }
  }

  cancelResetPassword() {
    this.resetForm.reset();
    this.formMode.set('forget');
  }
}
