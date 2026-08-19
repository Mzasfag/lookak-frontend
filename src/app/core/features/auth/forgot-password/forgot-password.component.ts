import { AUTH_USER_COOKIE, AUTH_TOKEN_COOKIE } from './../../../constants/auth.constants';
import { ErrorAlertComponent } from './../../../../shared/components/error-alert/error-alert.component';
import { NotifyService } from './../../../services/notify.service';
import { AuthService } from './../../../services/auth.service';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { isPlatformBrowser } from '@angular/common';

/**
 * Cross-field validator: the confirm-password value must match the
 * new-password value. Attached to the reset FormGroup, not a single control.
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value as string | undefined;
  const confirmPassword = group.get('confirmPassword')?.value as string | undefined;
  return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
}

/** Wizard steps of the forgot & reset password flow. */
type ResetStep = 'request' | 'reset' | 'done';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, ErrorAlertComponent, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private notifyService = inject(NotifyService);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  step = signal<ResetStep>('request');
  newPasswordVisible = signal(false);
  confirmPasswordVisible = signal(false);

  requestForm = new FormGroup({
    identifier: new FormControl('', [Validators.required]),
  });

  resetForm = new FormGroup(
    {
      token: new FormControl(''),
      newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
    },
    { validators: passwordsMatch },
  );

  get identifierController(): AbstractControl | null {
    return this.requestForm.get('identifier');
  }

  get tokenController(): AbstractControl | null {
    return this.resetForm.get('token');
  }

  get newPasswordController(): AbstractControl | null {
    return this.resetForm.get('newPassword');
  }

  get confirmPasswordController(): AbstractControl | null {
    return this.resetForm.get('confirmPassword');
  }

  toggleNewPasswordVisibility(): void {
    this.newPasswordVisible.set(!this.newPasswordVisible());
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.set(!this.confirmPasswordVisible());
  }

  onRequestReset(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      this.notifyService.showWarn('من فضلك يرجى إكمال البيانات');
      return;
    }

    const data = this.requestForm.value;

    // call api
    this.authService.forgetPassword(data).subscribe({
      next: (res) => {
        if (res?.message.toLowerCase()?.includes('exist')) {
          this.notifyService.showWarn('عذراً، لا يوجد مُعرف مطبق لهذه البيانات');
          return;
        }
        this.cookieService.set('reset-token', res?.resetToken);
        this.resetForm.get('token')?.setValue(res?.resetToken!);
        this.step.set('reset');
      },
      error: (error) => {
        this.notifyService.showError('خطأ في السيرفر، حاول مرة أخرى');
      },
    });
  }

  onSubmitNewPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      this.notifyService.showWarn('من فضلك يرجى إكمال البيانات');
      return;
    }

    const data = {
      token: this.cookieService.get('reset-token') || this.resetForm.get('token')?.value,
      password: this.resetForm.get('newPassword')?.value,
    };
    // call api
    this.authService.resetPassword(data).subscribe({
      next: (res) => {
        this.cookieService.set(AUTH_TOKEN_COOKIE, res?.token);
        this.cookieService.set(AUTH_USER_COOKIE, JSON.stringify(res?.user));
        this.authService.userData.set(res?.user);
        this.authService.token.set(res?.token);
        if (isPlatformBrowser(this.platformId)) {
          const loginValue: { identifier: string; password: string; rememberMe: boolean } = {
            password: this.resetForm.get('newPassword')?.value!,
            identifier: res?.user?.phone,
            rememberMe: true,
          };
          this.cookieService.set('loginValue', JSON.stringify(loginValue));
        }
        this.resetForm.reset();
        this.notifyService.showSuccess('تم تغيير كلمة المرور بنجاح');
        this.cookieService.delete('reset-token');
        this.router.navigateByUrl('/');
        this.step.set('done');
      },
      error: (error) => {
        this.notifyService.showError('خطأ في السيرفر، حاول مرة أخرى');
      },
    });
  }
}
