import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { providerGuard } from './core/guards/provider.guard';
import { clientGuard } from './core/guards/client.guard';

// main routes
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'لوَكك',
    loadComponent: () =>
      import('./core/features/landing/landing.component').then((file) => file.LandingComponent),
  },
  {
    path: 'login',
    title: 'تسجيل الدخول',
    loadComponent: () =>
      import('./core/features/auth/login/login.component').then((file) => file.LoginComponent),
  },
  {
    path: 'forgot-password',
    title: 'استعادة كلمة المرور',
    loadComponent: () =>
      import('./core/features/auth/forgot-password/forgot-password.component').then(
        (file) => file.ForgotPasswordComponent,
      ),
  },
  {
    path: 'register',
    title: 'إنشاء حساب جديد',
    loadComponent: () =>
      import('./core/features/auth/register/register.component').then((file) => file.RegisterComponent),
  },
  {
    path: 'admin',
    title: 'لوحة تحكم الإدارة',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./core/layouts/admin-layout/admin-layout.component').then(
        (file) => file.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'لوحة التحكم',
        loadComponent: () =>
          import('./core/features/roles/admin/dashboard/admin-dashboard.component').then(
            (file) => file.AdminDashboardComponent,
          ),
      },
      {
        path: 'users',
        title: 'إدارة المستخدمين',
        loadComponent: () =>
          import('./core/features/roles/admin/users/admin-users.component').then(
            (file) => file.AdminUsersComponent,
          ),
      },
      {
        path: 'bookings',
        title: 'إدارة الحجوزات',
        loadComponent: () =>
          import('./core/features/roles/admin/bookings/admin-bookings.component').then(
            (file) => file.AdminBookingsComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'الإشعارات',
        loadComponent: () =>
          import('./shared/components/notifications-page/notifications-page.component').then(
            (file) => file.NotificationsPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'إعدادات النظام',
        loadComponent: () =>
          import('./core/features/roles/admin/settings/admin-settings.component').then(
            (file) => file.AdminSettingsComponent,
          ),
      },
    ],
  },
  {
    path: 'provider',
    title: 'لوحة مزود الخدمة',
    canActivate: [providerGuard],
    loadComponent: () =>
      import('./core/layouts/provider-layout/provider-layout.component').then(
        (file) => file.ProviderLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'bookings',
      },
      {
        path: 'bookings',
        title: 'مواعيد اليوم والحجوزات',
        loadComponent: () =>
          import('./core/features/roles/provider/bookings/provider-bookings.component').then(
            (file) => file.ProviderBookingsComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'الإشعارات',
        loadComponent: () =>
          import('./shared/components/notifications-page/notifications-page.component').then(
            (file) => file.NotificationsPageComponent,
          ),
      },
      {
        path: 'services',
        title: 'خدماتي وأسعارها',
        loadComponent: () =>
          import('./core/features/roles/provider/services/provider-services.component').then(
            (file) => file.ProviderServicesComponent,
          ),
      },
      {
        path: 'working-hours',
        title: 'مواعيد العمل',
        loadComponent: () =>
          import('./core/features/roles/provider/working-hours/provider-working-hours.component').then(
            (file) => file.ProviderWorkingHoursComponent,
          ),
      },
      {
        path: 'profile',
        title: 'إعدادات الصالون والمعرض',
        loadComponent: () =>
          import('./core/features/roles/provider/profile/provider-profile.component').then(
            (file) => file.ProviderProfileComponent,
          ),
      },
    ],
  },
  {
    path: 'forbidden',
    title: 'غير مصرح',
    loadComponent: () =>
      import('./core/features/forbidden/forbidden.component').then(
        (file) => file.ForbiddenComponent,
      ),
  },
  {
    path: 'client',
    canActivate: [clientGuard],
    loadComponent: () =>
      import('./core/layouts/client-layout/client-layout.component').then(
        (file) => file.ClientLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'لوحة التحكم',
        loadComponent: () =>
          import('./core/features/roles/client/dashboard/client-dashboard.component').then(
            (file) => file.ClientDashboardComponent,
          ),
      },
      {
        path: 'providers',
        title: 'تصفح مزودي الخدمة',
        loadComponent: () =>
          import('./core/features/roles/client/providers/client-providers.component').then(
            (file) => file.ClientProvidersComponent,
          ),
      },
      {
        path: 'provider/:id',
        title: 'تفاصيل مزود الخدمة',
        loadComponent: () =>
          import('./core/features/roles/client/provider-details/client-provider-details.component').then(
            (file) => file.ClientProviderDetailsComponent,
          ),
      },

      {
        path: 'bookings',
        title: 'حجوزاتي',
        loadComponent: () =>
          import('./core/features/roles/client/bookings/client-bookings.component').then(
            (file) => file.ClientBookingsComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'الإشعارات',
        loadComponent: () =>
          import('./shared/components/notifications-page/notifications-page.component').then(
            (file) => file.NotificationsPageComponent,
          ),
      },
      {
        path: 'profile',
        title: 'الملف الشخصي',
        loadComponent: () =>
          import('./core/features/roles/client/profile/client-profile.component').then(
            (file) => file.ClientProfileComponent,
          ),
      },
    ],
  },
];
