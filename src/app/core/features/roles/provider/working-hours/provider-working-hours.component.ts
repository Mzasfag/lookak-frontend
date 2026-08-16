import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { IWorkingHoursEntry } from './../../../../models/provider.model';
import { NotifyService } from './../../../../services/notify.service';
import { ProviderWorkingHoursService } from './../../../../services/provider-working-hours.service';
import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Toast } from 'primeng/toast';
import { finalize } from 'rxjs';

/** `HH:mm` pattern enforced by the backend `workingHoursSchema` (User.js). */
export const WORKING_HOURS_TIME_PATTERN = '^([01]\\d|2[0-3]):([0-5]\\d)$';

/** Error key emitted by the cross-field `timeRangeValidator`. */
export const TIME_RANGE_ERROR = 'timeRange';

/**
 * Cross-field check — an open day must open before it closes. Closed days are
 * exempt: their pickers are disabled and only keep sentinel (persisted) times.
 */
export function timeRangeValidator(control: AbstractControl): ValidationErrors | null {
  const isOpen = Boolean(control.get('isOpen')?.value);
  if (!isOpen) {
    return null;
  }
  const start = String(control.get('startTime')?.value ?? '');
  const end = String(control.get('endTime')?.value ?? '');
  if (start && end && start >= end) {
    return { [TIME_RANGE_ERROR]: true };
  }
  return null;
}

/** Arabic day names indexed by the backend `dayOfWeek` (0 = Sunday … 6 = Saturday). */
const DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** A single editable weekday row. */
export interface WorkingHoursDayConfig {
  /** Backend `dayOfWeek` (0 = Sunday … 6 = Saturday). */
  dayOfWeek: number;
  /** `daysForm` group key (stringified `dayOfWeek`). */
  formKey: string;
  /** Arabic day name shown in the row. */
  label: string;
}

@Component({
  selector: 'app-provider-working-hours',
  imports: [ReactiveFormsModule, LoaderComponent, Toast],
  templateUrl: './provider-working-hours.component.html',
  styleUrl: './provider-working-hours.component.css',
})
export class ProviderWorkingHoursComponent implements OnInit {
  private readonly workingHoursService = inject(ProviderWorkingHoursService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  /** Row order — Saturday first, then Sunday…Friday (the UI brief). */
  readonly daysConfig: ReadonlyArray<WorkingHoursDayConfig> = [6, 0, 1, 2, 3, 4, 5].map(
    (dayOfWeek) => ({ dayOfWeek, formKey: String(dayOfWeek), label: DAY_LABELS[dayOfWeek] ?? '' }),
  );

  /** One nested group per weekday: `{ isOpen, startTime, endTime }`. */
  readonly daysForm = new FormGroup(
    this.daysConfig.reduce<Record<string, FormGroup>>((groups, day) => {
      groups[day.formKey] = new FormGroup(
        {
          isOpen: new FormControl<boolean>(true),
          startTime: new FormControl<string>('09:00', [
            Validators.pattern(WORKING_HOURS_TIME_PATTERN),
          ]),
          endTime: new FormControl<string>('18:00', [
            Validators.pattern(WORKING_HOURS_TIME_PATTERN),
          ]),
        },
        { validators: timeRangeValidator },
      );
      return groups;
    }, {}),
  );

  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    // SSR-safe: the page is also prerendered, so fetch only inside a browser.
    if (isPlatformBrowser(this.platformId)) {
      this.loadWorkingHours();
    }
  }

  /** Fetch the persisted plan and populate the form (Saturday…Thursday open 09:00–18:00). */
  loadWorkingHours(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.workingHoursService
      .getWorkingHours()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => this.applyWorkingHours(response.user?.workingHours),
        error: (error) => {
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message || 'تعذر تحميل مواعيد العمل');
        },
      });
  }

  /** Per-day switch: enable/disable that day's time pickers. */
  onToggleDay(day: WorkingHoursDayConfig): void {
    const group = this.dayGroup(day.dayOfWeek);
    if (!group) {
      return;
    }
    const isOpen = Boolean(group.get('isOpen')?.value);
    this.syncDayControls(group, isOpen);
    group.markAsDirty();
  }

  /** Send the full plan as a flat `workingHours` array (ordered by `dayOfWeek`). */
  onSave(): void {
    if (this.daysForm.invalid) {
      this.daysForm.markAllAsTouched();
      this.notifyService.showWarn('يرجى تصحيح مواعيد العمل قبل الحفظ');
      return;
    }
    const payload = this.buildPayload();
    this.isSaving.set(true);
    this.workingHoursService
      .updateWorkingHours(payload)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.applyWorkingHours(response.user?.workingHours ?? payload);
          this.notifyService.showSuccess('تم تحديث مواعيد العمل بنجاح');
        },
        error: (error) => {
          this.notifyService.showError(error?.error?.message || 'تعذر حفظ مواعيد العمل');
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Template helpers
  // ---------------------------------------------------------------------------

  dayLabel(dayOfWeek: number): string {
    return DAY_LABELS[dayOfWeek] ?? '';
  }

  dayIsOpen(day: WorkingHoursDayConfig): boolean {
    return Boolean(this.dayGroup(day.dayOfWeek)?.get('isOpen')?.value);
  }

  dayStartTimeControl(day: WorkingHoursDayConfig): AbstractControl | null {
    return this.dayGroup(day.dayOfWeek)?.get('startTime') ?? null;
  }

  dayEndTimeControl(day: WorkingHoursDayConfig): AbstractControl | null {
    return this.dayGroup(day.dayOfWeek)?.get('endTime') ?? null;
  }

  dayTimeRangeInvalid(day: WorkingHoursDayConfig): boolean {
    const group = this.dayGroup(day.dayOfWeek);
    return Boolean(group && group.hasError(TIME_RANGE_ERROR) && (group.touched || group.dirty));
  }

  fieldInvalid(control: AbstractControl | null): boolean {
    return Boolean(control && control.invalid && (control.touched || control.dirty));
  }

  dayRowClass(day: WorkingHoursDayConfig): string {
    return this.dayIsOpen(day)
      ? 'flex flex-col gap-4 border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6'
      : 'flex flex-col gap-4 border-b border-outline-variant/30 bg-surface-container/60 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6';
  }

  dayIconClass(day: WorkingHoursDayConfig): string {
    return this.dayIsOpen(day)
      ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold'
      : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant';
  }

  dayStatusClass(day: WorkingHoursDayConfig): string {
    return this.dayIsOpen(day)
      ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-500/30'
      : 'inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-extrabold text-on-surface-variant ring-1 ring-outline-variant/30';
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Nested `FormGroup` bound to a given backend `dayOfWeek`. */
  private dayGroup(dayOfWeek: number): FormGroup | null {
    const control = this.daysForm.get(String(dayOfWeek));
    return control instanceof FormGroup ? control : null;
  }

  private applyWorkingHours(entries?: IWorkingHoursEntry[]): void {
    const byDay = new Map<number, IWorkingHoursEntry>(
      (entries ?? []).map((entry) => [entry.dayOfWeek, entry]),
    );
    for (const day of this.daysConfig) {
      const group = this.dayGroup(day.dayOfWeek);
      const entry = byDay.get(day.dayOfWeek);
      if (!group) {
        continue;
      }
      // Mirror the backend schema defaults: Saturday…Thursday open, Friday closed.
      const isOpen = entry ? Boolean(entry.isOpen) : day.dayOfWeek !== 5;
      group.patchValue({
        isOpen,
        startTime: this.normalizeTime(entry?.startTime) ?? '09:00',
        endTime: this.normalizeTime(entry?.endTime) ?? '18:00',
      });
      this.syncDayControls(group, isOpen);
    }
    this.daysForm.markAsPristine();
    this.daysForm.markAsUntouched();
  }

  private buildPayload(): IWorkingHoursEntry[] {
    return this.daysConfig.map((day) => {
      const raw = (this.dayGroup(day.dayOfWeek)?.getRawValue() ?? {}) as {
        isOpen?: boolean;
        startTime?: string;
        endTime?: string;
      };
      const isOpen = Boolean(raw.isOpen ?? true);
      return {
        dayOfWeek: day.dayOfWeek,
        isOpen,
        // Closed days keep their persisted times (pickers are disabled); open
        // days always get a backend-safe `HH:mm` value.
        startTime: isOpen
          ? (this.normalizeTime(raw.startTime) ?? '09:00')
          : (raw.startTime ?? '09:00'),
        endTime: isOpen
          ? (this.normalizeTime(raw.endTime) ?? '18:00')
          : (raw.endTime ?? '18:00'),
      };
    });
  }

  private syncDayControls(group: FormGroup, isOpen: boolean): void {
    const start = group.get('startTime');
    const end = group.get('endTime');
    if (isOpen) {
      start?.enable();
      end?.enable();
    } else {
      start?.disable();
      end?.disable();
    }
    group.updateValueAndValidity();
  }

  private normalizeTime(value?: string): string | null {
    if (!value) {
      return null;
    }
    return new RegExp(`^${WORKING_HOURS_TIME_PATTERN}$`).test(value) ? value : null;
  }
}
