import { LoaderComponent } from './../../../../../shared/components/loader/loader.component';
import { UserRole, ProviderStatus, IUpdateUserRestrictionPayload, IAdminUser, IAdminListUsersParams } from './../../../../models/admin.model';
import { NotifyService } from './../../../../services/notify.service';
import { AdminService } from './../../../../services/admin.service';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { formatTimeTo12Hour } from '../../../../utils/time-format.util';

/** A single quick-overview statistic shown above the users list. */
export interface UsersStatChip {
  label: string;
  value: number;
  icon: string;
  iconClasses: string;
}

/** Columns the desktop table can be sorted by. */
export type UsersSortField = 'name' | 'phone' | 'role' | 'providerStatus' | 'isRestricted';

export type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-admin-users',
  imports: [LoaderComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notifyService = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  readonly users = signal<IAdminUser[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  // Filters
  readonly searchQuery = signal('');
  readonly roleFilter = signal<UserRole | ''>('');
  readonly providerStatusFilter = signal<ProviderStatus | ''>('');
  readonly restrictedOnly = signal(false);

  // Row / modal state
  readonly busyUserId = signal<string | null>(null);
  readonly userToDelete = signal<IAdminUser | null>(null);
  readonly isDeleting = signal(false);

  // Pagination (client-side — the API returns the full matching list)
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  // Sorting (client-side, desktop table)
  readonly sortField = signal<UsersSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  // User details modal
  readonly detailUser = signal<IAdminUser | null>(null);

  // Booking-restriction modal
  readonly bookingRestrictionUser = signal<IAdminUser | null>(null);
  readonly bookingRestrictionEnabled = signal(false);
  readonly bookingRestrictionReason = signal('');
  readonly bookingRestrictionUntil = signal('');
  readonly isSavingBookingRestriction = signal(false);

  // Derived state
  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim() !== '' ||
      this.roleFilter() !== '' ||
      this.providerStatusFilter() !== '' ||
      this.restrictedOnly(),
  );

  /** Quick-overview chips computed from the currently loaded list. */
  readonly statChips = computed<UsersStatChip[]>(() => {
    const list = this.users();
    return [
      {
        label: 'إجمالي المعروض',
        value: list.length,
        icon: 'pi-users',
        iconClasses: 'bg-primary/10 text-primary',
      },
      {
        label: 'عملاء',
        value: list.filter((u) => u.role === 'client').length,
        icon: 'pi-heart',
        iconClasses: 'bg-brand-gold/15 text-brand-gold',
      },
      {
        label: 'مزودو خدمات',
        value: list.filter((u) => u.role === 'provider').length,
        icon: 'pi-briefcase',
        iconClasses: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'مقيدون',
        value: list.filter((u) => u.isRestricted).length,
        icon: 'pi-ban',
        iconClasses: 'bg-red-500/10 text-red-500',
      },
    ];
  });

  /** Users ordered by the active sort column. */
  readonly sortedUsers = computed<IAdminUser[]>(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    const sorted = [...this.users()];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case 'name':
          cmp = (a.name ?? '').localeCompare(b.name ?? '', 'ar');
          break;
        case 'phone':
          cmp = (a.phone ?? '').localeCompare(b.phone ?? '', 'ar');
          break;
        case 'role':
          cmp = (a.role ?? '').localeCompare(b.role ?? '', 'ar');
          break;
        case 'providerStatus':
          cmp = (a.providerStatus ?? '').localeCompare(b.providerStatus ?? '', 'ar');
          break;
        case 'isRestricted':
          cmp = Number(Boolean(a.isRestricted)) - Number(Boolean(b.isRestricted));
          break;
      }
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedUsers().length / this.pageSize())),
  );

  /** Users visible on the current page. */
  readonly pagedUsers = computed<IAdminUser[]>(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedUsers().slice(start, start + this.pageSize());
  });

  /** e.g. `1-10` / `11-20` for the pagination range label. */
  readonly pageRangeLabel = computed(() => {
    const total = this.sortedUsers().length;
    if (total === 0) {
      return '0';
    }
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), total);
    return `${start}-${end}`;
  });

  /** Debounced search stream — avoids one request per keystroke. */
  private readonly search$ = new Subject<string>();

  /** Guards against out-of-order responses when filters change rapidly. */
  private requestSeq = 0;

  constructor() {
    this.search$
      .pipe(distinctUntilChanged(), debounceTime(400), takeUntilDestroyed())
      .subscribe(() => this.loadUsers());
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  loadUsers(): void {
    const params: IAdminListUsersParams = {};
    const query = this.searchQuery().trim();
    if (query) {
      params.q = query;
    }
    if (this.roleFilter()) {
      params.role = this.roleFilter() as UserRole;
    }
    if (this.providerStatusFilter()) {
      params.providerStatus = this.providerStatusFilter() as ProviderStatus;
    }
    if (this.restrictedOnly()) {
      params.restricted = true;
    }

    const seq = ++this.requestSeq;
    this.isLoading.set(true);
    this.hasError.set(false);

    this.adminService
      .getUsers(params)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          if (seq !== this.requestSeq) {
            return;
          }
          this.users.set(res.users);
          this.totalCount.set(res.count);
          this.page.set(1);
        },
        error: (error) => {
          if (seq !== this.requestSeq) {
            return;
          }
          this.users.set([]);
          this.totalCount.set(0);
          this.hasError.set(true);
          this.notifyService.showError(error?.error?.message || 'تعذر تحميل المستخدمين');
        },
      });
  }

  // -------------------------------------------------------------------------
  // Filter handlers
  // -------------------------------------------------------------------------

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  onRoleChange(value: UserRole | ''): void {
    this.roleFilter.set(value);
    this.loadUsers();
  }

  onProviderStatusChange(value: ProviderStatus | ''): void {
    this.providerStatusFilter.set(value);
    this.loadUsers();
  }

  onRestrictedChange(value: boolean): void {
    this.restrictedOnly.set(value);
    this.loadUsers();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set('');
    this.providerStatusFilter.set('');
    this.restrictedOnly.set(false);
    this.loadUsers();
  }

  // -------------------------------------------------------------------------
  // Row actions
  // -------------------------------------------------------------------------

  toggleRestriction(user: IAdminUser): void {
    const userId = this.userKey(user);
    const next = !user.isRestricted;
    this.busyUserId.set(userId);
    this.adminService
      .updateUserRestriction(userId, { isRestricted: next })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyUserId.set(null)),
      )
      .subscribe({
        next: (res) => {
          this.replaceUser(res.user);
          const details = this.detailUser();
          if (details && this.userKey(details) === userId) {
            this.detailUser.set(res.user);
          }
          this.notifyService.showSuccess(next ? 'تم تقييد المستخدم' : 'تم إلغاء تقييد المستخدم');
        },
        error: (error) => this.notifyService.showError(error?.error?.message),
      });
  }

  approveProvider(user: IAdminUser): void {
    const userId = this.userKey(user);
    this.busyUserId.set(userId);
    this.adminService
      .updateProviderStatus(userId, 'approved')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyUserId.set(null)),
      )
      .subscribe({
        next: (res) => {
          this.replaceUser(res.user);
          const details = this.detailUser();
          if (details && this.userKey(details) === userId) {
            this.detailUser.set(res.user);
          }
          this.notifyService.showSuccess('تمت الموافقة على مزود الخدمة');
        },
        error: (error) => this.notifyService.showError(error?.error?.message),
      });
  }

  // Delete confirmation modal ------------------------------------------------

  requestDelete(user: IAdminUser): void {
    this.userToDelete.set(user);
  }

  cancelDelete(): void {
    this.userToDelete.set(null);
  }

  confirmDelete(): void {
    const user = this.userToDelete();
    if (!user) {
      return;
    }
    const userId = this.userKey(user);
    this.isDeleting.set(true);
    this.adminService
      .deleteUser(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDeleting.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.users.update((list) => list.filter((u) => this.userKey(u) !== userId));
          this.totalCount.update((count) => Math.max(0, count - 1));
          this.userToDelete.set(null);
          this.clampPage();
          this.notifyService.showSuccess('تم حذف المستخدم');
        },
        error: (error) => this.notifyService.showError(error?.error?.message),
      });
  }

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  onPageSizeChange(value: string): void {
    const size = Number(value);
    if (Number.isFinite(size) && size > 0) {
      this.pageSize.set(size);
      this.page.set(1);
    }
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  /** Keeps the current page valid after the list shrinks (e.g. delete). */
  private clampPage(): void {
    this.page.update((p) => Math.min(Math.max(1, p), this.totalPages()));
  }

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  sortBy(field: UsersSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.page.set(1);
  }

  sortIcon(field: UsersSortField): string {
    if (this.sortField() !== field) {
      return 'pi pi-sort-alt';
    }
    return this.sortDirection() === 'asc' ? 'pi pi-sort-amount-down-alt' : 'pi pi-sort-amount-up';
  }

  // -------------------------------------------------------------------------
  // User details modal
  // -------------------------------------------------------------------------

  openDetails(user: IAdminUser): void {
    this.detailUser.set(user);
  }

  closeDetails(): void {
    this.detailUser.set(null);
  }

  // -------------------------------------------------------------------------
  // Booking-restriction modal
  // -------------------------------------------------------------------------

  openBookingRestriction(user: IAdminUser): void {
    this.bookingRestrictionUser.set(user);
    this.bookingRestrictionEnabled.set(Boolean(user.isBookingRestricted));
    this.bookingRestrictionReason.set(user.bookingRestrictionReason ?? '');
    this.bookingRestrictionUntil.set(user.bookingBlockedUntil?.slice(0, 10) ?? '');
  }

  closeBookingRestriction(): void {
    this.bookingRestrictionUser.set(null);
    this.isSavingBookingRestriction.set(false);
  }

  saveBookingRestriction(): void {
    const user = this.bookingRestrictionUser();
    if (!user) {
      return;
    }
    const enabled = this.bookingRestrictionEnabled();
    const reason = this.bookingRestrictionReason().trim();
    const until = this.bookingRestrictionUntil();
    const userId = this.userKey(user);

    const payload: IUpdateUserRestrictionPayload = {
      isBookingRestricted: enabled,
      bookingRestrictionReason: enabled && reason ? reason : undefined,
      bookingBlockedUntil: enabled && until ? until : null,
    };

    this.isSavingBookingRestriction.set(true);
    this.adminService
      .updateUserRestriction(userId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingBookingRestriction.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.replaceUser(res.user);
          const details = this.detailUser();
          if (details && this.userKey(details) === userId) {
            this.detailUser.set(res.user);
          }
          this.bookingRestrictionUser.set(null);
          this.notifyService.showSuccess(res.message || 'تم تحديث قيود الحجز');
        },
        error: (error) => this.notifyService.showError(error?.error?.message),
      });
  }

  // -------------------------------------------------------------------------
  // Provider rejection
  // -------------------------------------------------------------------------

  rejectProvider(user: IAdminUser): void {
    const userId = this.userKey(user);
    this.busyUserId.set(userId);
    this.adminService
      .updateProviderStatus(userId, 'rejected')
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busyUserId.set(null)))
      .subscribe({
        next: (res) => {
          this.replaceUser(res.user);
          const details = this.detailUser();
          if (details && this.userKey(details) === userId) {
            this.detailUser.set(res.user);
          }
          this.notifyService.showSuccess(res.message || 'تم رفض طلب مزود الخدمة');
        },
        error: (error) => this.notifyService.showError(error?.error?.message),
      });
  }

  // -------------------------------------------------------------------------
  // CSV export
  // -------------------------------------------------------------------------

  exportCsv(): void {
    const rows = this.sortedUsers();
    if (rows.length === 0) {
      this.notifyService.showInfo('لا توجد بيانات لتصديرها');
      return;
    }
    const headers = [
      'الاسم',
      'البريد الإلكتروني',
      'الهاتف',
      'الدور',
      'حالة المزود',
      'مقيد',
      'اسم الصالون',
      'العنوان',
      'التقييم',
      'مرات عدم الحضور',
      'تاريخ الانضمام',
    ];
    const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((user) =>
      [
        user.name,
        user.email,
        user.phone,
        this.roleLabel(user.role),
        user.role === 'provider' ? this.providerStatusLabel(user.providerStatus) : '',
        user.isRestricted ? 'نعم' : 'لا',
        user.salonName ?? '',
        user.address ?? '',
        user.averageRating ?? '',
        user.noShowCount ?? '',
        user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : '',
      ]
        .map(escape)
        .join(','),
    );

    // BOM keeps Arabic text readable in Excel.
    const csv = `\ufeff${[headers, ...lines].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lookak-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.notifyService.showSuccess(`تم تصدير ${rows.length} مستخدم`);
  }

  // -------------------------------------------------------------------------
  // Presentation helpers
  // -------------------------------------------------------------------------

  isRowBusy(user: IAdminUser): boolean {
    return this.busyUserId() === this.userKey(user);
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'client':
        return 'عميل';
      case 'provider':
        return 'مزود خدمة';
      case 'admin':
        return 'مدير';
      default:
        return role;
    }
  }

  roleBadgeClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-surface-container-high text-primary ring-primary/25';
      case 'provider':
        return 'bg-sky-500/10 text-sky-700 ring-sky-500/25';
      case 'client':
        return 'bg-brand-gold/10 text-brand-gold ring-brand-gold/25';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
    }
  }

  providerStatusLabel(status: ProviderStatus | string | undefined): string {
    switch (status) {
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'pending':
        return 'قيد المراجعة';
      default:
        return '—';
    }
  }

  providerStatusBadgeClass(status: ProviderStatus | string | undefined): string {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 ring-red-500/30';
      case 'pending':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/30';
      default:
        return 'bg-surface-container text-on-surface-variant ring-outline-variant/30';
    }
  }

  restrictionLabel(user: IAdminUser): string {
    return user.isRestricted ? 'مقيد' : 'نشط';
  }

  restrictionBadgeClass(user: IAdminUser): string {
    return user.isRestricted
      ? 'bg-red-500/10 text-red-600 ring-red-500/30'
      : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30';
  }

  restrictionDotClass(user: IAdminUser): string {
    return user.isRestricted ? 'bg-red-500' : 'bg-emerald-500';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleDateString('ar-EG-u-nu-latn');
  }

    formatRating(value?: number | null): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return value.toFixed(1);
  }

  formatTime(value?: string | null): string {
    return formatTimeTo12Hour(value);
  }

  dayLabel(day: number | undefined): string {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return day != null && days[day] ? days[day] : '—';
  }

  userKey(user: IAdminUser): string {
    return user._id ?? user.id;
  }

  private replaceUser(updated: IAdminUser): void {
    this.users.update((list) =>
      list.map((user) =>
        this.userKey(user) === this.userKey(updated) ? { ...user, ...updated } : user,
      ),
    );
  }
}
