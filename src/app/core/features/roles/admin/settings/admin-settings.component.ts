import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { IAdminSettings } from './../../../../models/admin.model';
import { AdminService } from './../../../../services/admin.service';
import { NotifyService } from './../../../../services/notify.service';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

/** A single read-only setting tile rendered inside the settings grid. */
export interface SettingsField {
  key: string;
  label: string;
  description: string;
  icon: string;
  iconClasses: string;
  value: string;
  /** Small unit suffix displayed next to a numeric value (e.g. "مرات"). */
  unit?: string;
  /** When set, the value is rendered as a clickable external link. */
  href?: string;
  /** When `true`, the value is rendered as a colored environment badge. */
  isEnvBadge?: boolean;
}

@Component({
  selector: 'app-admin-settings',
  imports: [LoaderComponent],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
})
export class AdminSettingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly settings = signal<IAdminSettings | null>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  private readonly numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn');

  ngOnInit(): void {
    this.loadSettings();
  }

  /** Fetch the system settings via `GET /api/admin/settings`. */
  loadSettings(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.adminService
      .getSettings()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => this.settings.set(res),
        error: (error) => {
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message);
        },
      });
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.numberFormatter.format(value);
  }

  nodeEnvLabel(env: string | undefined | null): string {
    switch (env) {
      case 'development':
        return 'بيئة تطوير';
      case 'production':
        return 'بيئة إنتاج';
      case 'test':
        return 'بيئة اختبار';
      default:
        return env?.trim() || 'غير محددة';
    }
  }

  nodeEnvBadgeClass(env: string | undefined | null): string {
    switch (env) {
      case 'production':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'development':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
      case 'test':
        return 'bg-sky-500/10 text-sky-700 ring-sky-500/30';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
    }
  }

  /** Derived, ready-to-render list of setting tiles. */
  readonly fields = computed<SettingsField[]>(() => {
    const s = this.settings();
    const clientUrl = s?.clientUrl?.trim() || '';

    return [
      {
        key: 'noShowThreshold',
        label: 'حد غياب العملاء المسموح',
        description: 'عدد مرات عدم الحضور المسموح بها قبل تقييد حجز العميل تلقائيًا',
        icon: 'pi-calendar-times',
        iconClasses: 'bg-red-500/10 text-red-600',
        value: s?.noShowThreshold != null ? this.formatNumber(s.noShowThreshold) : '—',
        unit: s?.noShowThreshold != null ? 'مرات' : undefined,
      },
      {
        key: 'clientUrl',
        label: 'رابط تطبيق العملاء',
        description: 'الرابط الرسمي لتطبيق عملاء لوَكك المتاح للجمهور',
        icon: 'pi-globe',
        iconClasses: 'bg-primary/10 text-primary',
        value: clientUrl || '—',
        href: /^https?:\/\//i.test(clientUrl) ? clientUrl : undefined,
      },
      {
        key: 'nodeEnv',
        label: 'بيئة النظام',
        description: 'البيئة التي يعمل بها الخادم حاليًا',
        icon: 'pi-server',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
        value: s?.nodeEnv?.trim() || '—',
        isEnvBadge: true,
      },
    ];
  });
}
