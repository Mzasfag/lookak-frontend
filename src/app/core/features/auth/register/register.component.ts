import { NotifyService } from './../../../services/notify.service';
import { ErrorAlertComponent } from './../../../../shared/components/error-alert/error-alert.component';
import { AuthService } from './../../../services/auth.service';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';

/** Account role values matching the backend register payload. */
export type RegisterRole = 'client' | 'provider';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, ErrorAlertComponent, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent implements OnInit {
  /** Eye-toggle visibility flag for the password field. */
  private authService = inject(AuthService);
  private notifyService = inject(NotifyService);
  private cookieService = inject(CookieService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  passwordVisible = signal(false);

  /**
   * Reactive form mirroring the POST /api/auth/register body:
   * { name, phone, email?, password, role?, description?, address?, acceptTerms }.
   * - `description` / `address` are required ONLY when role = 'provider'
   *   (validators are synced in ngOnInit; salonName is intentionally
   *   excluded here as per backend rules).
   * UI-only — no HTTP calls.
   */
  registerForm = new FormGroup({
    /** Full name (الاسم الكامل) — required, min 2 chars. */
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    /** Primary phone number (رقم الهاتف الأساسي) — required, min 6 chars. */
    phone: new FormControl('', [
      Validators.required,
      Validators.pattern(/^(010|011|012|015)[0-9]{8}$/),
    ]),
    email: new FormControl('', [Validators.email,Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    role: new FormControl<RegisterRole>('client'),
    description: new FormControl(''),
    address: new FormControl(''),
    acceptTerms: new FormControl(false, [Validators.requiredTrue]),
  });

  ngOnInit(): void {
    this.registerForm.get('role')?.valueChanges.subscribe(() => this.syncProviderFieldValidators());
    // Pre-select the account role when arriving from the landing page CTAs
    // (e.g. /register?role=provider for salon owners).
    const roleParam = this.route.snapshot.queryParamMap.get('role');
    if (roleParam === 'provider' || roleParam === 'client') {
      this.registerForm.get('role')?.setValue(roleParam);
    }
  }

  get nameController() {
    return this.registerForm.get('name');
  }

  get phoneController() {
    return this.registerForm.get('phone');
  }

  get emailController() {
    return this.registerForm.get('email');
  }

  get passwordController() {
    return this.registerForm.get('password');
  }

  get roleController() {
    return this.registerForm.get('role');
  }

  get descriptionController() {
    return this.registerForm.get('description');
  }


  get addressController() {
    return this.registerForm.get('address');
  }


  get acceptTermsController() {
    return this.registerForm.get('acceptTerms');
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.set(!this.passwordVisible());
  }


  private syncProviderFieldValidators(): void {
    const isProvider = this.registerForm.get('role')?.value === 'provider';
    const description = this.registerForm.get('description');
    const address = this.registerForm.get('address');

    if (isProvider) {
      description?.setValidators([Validators.required, Validators.minLength(10)]);
      address?.setValidators([Validators.required]);
    } else {
      description?.setValidators([]);
      address?.setValidators([]);
      description?.reset();
      address?.reset();
    }

    description?.updateValueAndValidity();
    address?.updateValueAndValidity();
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.notifyService.showWarn('من فضلك يرجى إكمال البيانات');
      return;
    }

    const data = {
      password: this.registerForm.get('password')?.value,
      name: this.registerForm.get('name')?.value,
      phone: this.registerForm.get('phone')?.value,
      email: this.registerForm.get('email')?.value,
      role: this.registerForm.get('role')?.value,
      description: this.registerForm.get('description')?.value || '',
      address: this.registerForm?.get('address')?.value || '',
    };
    console.log(data);
    // call api
    this.authService.register(data).subscribe({
      next: (res) => {
        this.notifyService.showSuccess('تم انشاء حساب بنجاح');
        this.cookieService.set(
          'loginValue',
          JSON.stringify({
            identifier: res?.user?.phone,
            password: this.registerForm.get('password')?.value,
            rememberMe: true,
          }),
        );
        this.router.navigateByUrl('/login');
      },
      error: (error) => {
        if (error?.error?.message.toLowerCase()?.includes('duplicate resource')) {
          this.notifyService.showError('رقم الهاتف أو البريد الإلكتروني مستخدم من قبل');
        } else {
          this.notifyService.showError('خطأ في السيرفر، حاول مرة أخرى');
        }
      },
    });
  }
}
