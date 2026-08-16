import { AuthService } from './../../../services/auth.service';
import { NotifyService } from './../../../services/notify.service';
import { AUTH_USER_COOKIE, AUTH_TOKEN_COOKIE } from './../../../constants/auth.constants';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CookieService } from 'ngx-cookie-service';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ErrorAlertComponent, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private notifyService = inject(NotifyService);
  private cookieService = inject(CookieService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  passwordVisible = signal<boolean>(false);
  /** Prevents duplicate submissions and drives the submit-button spinner. */
  readonly isSubmitting = signal(false);
  loginForm = new FormGroup({
    identifier: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    rememberMe: new FormControl(),
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.cookieService.check('loginValue')) {
        const loginValue: { identifier: string; password: string; rememberMe: boolean } =
          JSON.parse(this.cookieService.get('loginValue'));
        console.log(loginValue);
        if (loginValue.rememberMe == true) {
          this.loginForm.patchValue(loginValue);
        }
      }
    }
  }

  togglePasswordVisibility() {
    this.passwordVisible.set(!this.passwordVisible());
  }

  // identifierController
  get identifierController() {
    return this.loginForm?.get('identifier');
  }

  // passwordController
  get passwordController() {
    return this.loginForm?.get('password');
  }

  // onLogin
  onLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.notifyService.showWarn('من فضلك يرجى إكمال البيانات');
      return;
    }
    if (this.isSubmitting()) {
      return;
    }

    const data = {
      identifier: this.loginForm.get('identifier')?.value,
      password: this.loginForm.get('password')?.value,
    };

    this.isSubmitting.set(true);
    this.authService
      .login(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.cookieService.set(AUTH_TOKEN_COOKIE, res?.token);
          this.authService.token.set(res?.token);
          this.cookieService.set(AUTH_USER_COOKIE, JSON.stringify(res?.user));
          this.authService.userData.set(res?.user);
          this.notifyService.showSuccess(
            `مرحباً بك ${res?.user?.name}، تم تسجيل الدخول بنجاح، جاري التحويل...`,
          );
          if (this.loginForm.get('rememberMe')?.value == true) {
            this.cookieService.set('loginValue', JSON.stringify(this.loginForm.value));
          } else {
            this.cookieService.delete('loginValue');
          }
          this.redirectByRole(res?.user?.role);
        },
        error: (error) => {
          this.handleLoginError(error);
        },
      });
  }

  /**
   * Maps login HTTP errors to user-friendly, localized notifications:
   * - 403 → restricted/suspended account warning.
   * - 401 → invalid credentials.
   * - 500 / fallback → graceful generic error (also covers network failures).
   */
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

  /** Routes the logged-in user to the area matching their role. */
  private redirectByRole(role: string | undefined): void {
    if (role == 'admin') {
      this.router.navigateByUrl('/admin');
    } else if (role == 'client') {
      this.router.navigateByUrl('/client');
    } else {
      this.router.navigateByUrl('/provider');
    }
  }
}
