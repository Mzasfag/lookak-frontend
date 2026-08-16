import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { NotifyService } from './../../../../services/notify.service';
import { AdminService } from './../../../../services/admin.service';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import {
  BookingStatus,
  IAdminReports,
  IAdminSummary,
  IBookingStatusBucket,
  IProvidersByStatusBucket,
  IRevenueByProvider,
  ProviderStatus,
} from '../../../../models/admin.model';

export interface AdminKpiCard {
  label: string;
  value: number;
  icon: string;
  iconClasses: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [LoaderComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private notifyService = inject(NotifyService);

  readonly summary = signal<IAdminSummary | null>(null);
  readonly reports = signal<IAdminReports | null>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  private readonly numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn');
  private readonly currencyFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  });

  readonly userKpis = computed<AdminKpiCard[]>(() => {
    const s = this.summary();
    return [
      {
        label: 'إجمالي المستخدمين',
        value: s?.totalUsersCount ?? 0,
        icon: 'pi-users',
        iconClasses: 'bg-primary/10 text-primary',
      },
      {
        label: 'العملاء',
        value: s?.clientsCount ?? 0,
        icon: 'pi-heart',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
      },
      {
        label: 'مزودو الخدمات',
        value: s?.providersCount ?? 0,
        icon: 'pi-briefcase',
        iconClasses: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'المدراء',
        value: s?.adminsCount ?? 0,
        icon: 'pi-shield',
        iconClasses: 'bg-emerald-500/10 text-emerald-600',
      },
    ];
  });

  readonly bookingKpis = computed<AdminKpiCard[]>(() => {
    const s = this.summary();
    return [
      {
        label: 'إجمالي الحجوزات',
        value: s?.bookingsCount ?? 0,
        icon: 'pi-calendar',
        iconClasses: 'bg-primary/10 text-primary',
      },
      {
        label: 'قيد الانتظار',
        value: s?.pendingBookingsCount ?? 0,
        icon: 'pi-clock',
        iconClasses: 'bg-amber-500/10 text-amber-600',
      },
      {
        label: 'مؤكدة',
        value: s?.confirmedBookingsCount ?? 0,
        icon: 'pi-check-circle',
        iconClasses: 'bg-emerald-500/10 text-emerald-600',
      },
      {
        label: 'مكتملة',
        value: s?.completedBookingsCount ?? 0,
        icon: 'pi-check-square',
        iconClasses: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'ملغية',
        value: s?.cancelledBookingsCount ?? 0,
        icon: 'pi-times-circle',
        iconClasses: 'bg-red-500/10 text-red-500',
      },
      {
        label: 'لم يحضر',
        value: s?.noShowBookingsCount ?? 0,
        icon: 'pi-exclamation-circle',
        iconClasses: 'bg-on-surface-variant/10 text-on-surface-variant',
      },
    ];
  });

  readonly totalRevenue = computed(() => this.summary()?.revenue ?? 0);
  readonly restrictedClients = computed(() => this.summary()?.restrictedClientsCount ?? 0);

  readonly topProviders = computed<IRevenueByProvider[]>(
    () => this.reports()?.revenueByProvider ?? [],
  );
  readonly bookingStatusBuckets = computed<IBookingStatusBucket[]>(
    () => this.reports()?.bookingsByStatus ?? [],
  );
  readonly providersStatusBuckets = computed<IProvidersByStatusBucket[]>(
    () => this.reports()?.providersByStatus ?? [],
  );
  readonly bookingStatusTotal = computed(() =>
    this.bookingStatusBuckets().reduce((acc, bucket) => acc + (bucket.count ?? 0), 0),
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.getSummary();
    this.getReports();
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.numberFormatter.format(value);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.currencyFormatter.format(value);
  }

  // ---------------------------------------------------------------------------
  // Status label / color helpers
  // ---------------------------------------------------------------------------
  statusLabel(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'confirmed':
        return 'مؤكد';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغي';
      case 'no-show':
        return 'لم يحضر';
      default:
        return status;
    }
  }

  bookingBarClass(status: BookingStatus | string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-500';
      case 'confirmed':
        return 'bg-primary';
      case 'completed':
        return 'bg-emerald-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'no-show':
        return 'bg-on-surface-variant/50';
      default:
        return 'bg-primary';
    }
  }

  providerStatusLabel(status: ProviderStatus | string): string {
    switch (status) {
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'pending':
        return 'قيد المراجعة';
      default:
        return status;
    }
  }

  providerStatusDotClass(status: ProviderStatus | string): string {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500';
      case 'rejected':
        return 'bg-red-500';
      case 'pending':
        return 'bg-amber-500';
      default:
        return 'bg-on-surface-variant';
    }
  }

  rankBadgeClass(index: number): string {
    if (index === 0) {
      return 'bg-gradient-to-br from-brand-gold to-primary text-white';
    }
    if (index === 1) {
      return 'bg-surface-container-high text-on-surface-variant';
    }
    if (index === 2) {
      return 'bg-amber-500/15 text-amber-700';
    }
    return 'bg-surface-container text-on-surface-variant';
  }

  /** Percentage of a single bucket relative to the total booking count. */
  bookingPercent(count: number): number {
    const total = this.bookingStatusTotal();
    if (total <= 0) {
      return 0;
    }
    return Math.round(((count ?? 0) / total) * 100);
  }

  getSummary() {
    this.adminService
      .getSummary()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.summary.set(res);
        },
        error: (error) => {
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message);
        },
      });
  }

  getReports() {
    this.adminService
      .getReports()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.reports.set(res);
        },
        error: (error) => {
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message);
        },
      });
  }
}
