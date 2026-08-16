import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ProvidersService } from '../../../../services/providers.service';
import { IPublicProvider, IWorkingHoursEntry } from '../../../../models/provider.model';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

export interface ProviderCategoryFilter {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-client-providers',
  imports: [CommonModule, FormsModule, RouterLink, LoaderComponent, ErrorAlertComponent],
  templateUrl: './client-providers.component.html',
  styleUrl: './client-providers.component.css',
})
export class ClientProvidersComponent implements OnInit {
  private readonly providersService = inject(ProvidersService);
  private readonly destroyRef = inject(DestroyRef);

  /** All active providers returned by the backend API. */
  readonly providers = signal<IPublicProvider[]>([]);

  /** UI State Signals */
  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly errorMessage = signal<string>('');

  /** Filter & Search Signals */
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('all');
  readonly sortBy = signal<'rating' | 'reviews' | 'name'>('rating');

  /** Available Categories for Filter Bar */
  readonly categories: ProviderCategoryFilter[] = [
    { id: 'all', label: 'الكل', icon: 'pi-grid' },
    { id: 'barber', label: 'حلاقة ورجالي', icon: 'pi-user' },
    { id: 'beauty', label: 'تجميل ونساء', icon: 'pi-heart' },
    { id: 'spa', label: 'سبا ومساج', icon: 'pi-sparkles' },
    { id: 'skincare', label: 'عناية بالبشرة', icon: 'pi-sun' },
  ];

  ngOnInit(): void {
    this.loadProviders();
  }

  /** Fetches all active salons/providers from `GET /api/providers`. */
  loadProviders(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    this.providersService
      .getProviders()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.providers.set(response?.providers ?? []);
        },
        error: (err) => {
          this.hasError.set(true);
          this.errorMessage.set(
            err?.error?.message || 'تعذر تحميل قائمة مزودي الخدمة. يرجى المحاولة لاحقاً.',
          );
        },
      });
  }
  /** Computed list of providers filtered by search query, category, and sorted accordingly. */
  readonly filteredProviders = computed<IPublicProvider[]>(() => {
    let result = [...this.providers()];
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.selectedCategory();
    const currentSort = this.sortBy();

    if (query) {
      result = result.filter((p) => {
        const salonName = (p.salonName || '').toLowerCase();
        const ownerName = (p.name || '').toLowerCase();
        const address = (p.address || '').toLowerCase();
        const bio = (p.bio || '').toLowerCase();
        return (
          salonName.includes(query) ||
          ownerName.includes(query) ||
          address.includes(query) ||
          bio.includes(query)
        );
      });
    }

    if (category !== 'all') {
      result = result.filter((p) => {
        const cat = (p?.category || '').toLowerCase();
        const bio = (p.bio || '').toLowerCase();
        const name = (p.salonName || p.name || '').toLowerCase();

        if (category === 'barber') {
          return cat.includes('barber') || bio.includes('رجالي') || bio.includes('حلاقة') || name.includes('رجالي');
        }
        if (category === 'beauty') {
          return cat.includes('beauty') || bio.includes('نسائي') || bio.includes('تجميل') || name.includes('تجميل');
        }
        if (category === 'spa') {
          return cat.includes('spa') || bio.includes('سبا') || bio.includes('مساج');
        }
        if (category === 'skincare') {
          return cat.includes('skin') || bio.includes('بشرة') || bio.includes('عناية');
        }
        return true;
      });
    }

    result.sort((a, b) => {
      if (currentSort === 'rating') {
        return (b.averageRating ?? 0) - (a.averageRating ?? 0);
      }
      if (currentSort === 'reviews') {
        return (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0);
      }
      if (currentSort === 'name') {
        const nameA = (a.salonName || a.name || '').trim();
        const nameB = (b.salonName || b.name || '').trim();
        return nameA.localeCompare(nameB, 'ar');
      }
      return 0;
    });

    return result;
  });

  readonly hasActiveFilters = computed<boolean>(() => {
    return (
      this.searchQuery().trim() !== '' ||
      this.selectedCategory() !== 'all' ||
      this.sortBy() !== 'rating'
    );
  });

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
  }

  setSortBy(sort: 'rating' | 'reviews' | 'name'): void {
    this.sortBy.set(sort);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
    this.sortBy.set('rating');
  }

  getProviderInitial(p: IPublicProvider): string {
    const displayName = (p.salonName || p.name || 'صالون').trim();
    return displayName.charAt(0).toUpperCase();
  }

  getWorkingStatus(workingHours?: IWorkingHoursEntry[]): { isOpen: boolean; text: string } {
    if (!workingHours || workingHours.length === 0) {
      return { isOpen: true, text: 'مفتوح اليوم' };
    }

    const todayIndex = new Date().getDay();
    const todaySchedule = workingHours.find((w) => w.dayOfWeek === todayIndex);

    if (todaySchedule && todaySchedule.isOpen) {
      const timeText =
        todaySchedule.startTime && todaySchedule.endTime
          ? `${todaySchedule.startTime} - ${todaySchedule.endTime}`
          : 'مفتوح اليوم';
      return { isOpen: true, text: timeText };
    }

    return { isOpen: false, text: 'مغلق اليوم' };
  }

  getCoverGradient(id: string): string {
    const gradients = [
      'from-amber-600/90 via-primary to-primary-dark',
      'from-emerald-600/90 via-teal-700 to-slate-900',
      'from-indigo-600/90 via-purple-700 to-slate-900',
      'from-rose-600/90 via-pink-700 to-amber-900',
      'from-brand-gold/80 via-amber-700 to-slate-900',
    ];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }
}
