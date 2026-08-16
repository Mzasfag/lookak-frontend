import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { IPublicProvider } from '../../models/provider.model';
import { ProvidersService } from '../../services/providers.service';

/** A single value proposition rendered in the "Why Lookak" cards section. */
export interface LandingFeature {
  /** PrimeIcons class used for the card icon, e.g. 'pi pi-calendar-plus'. */
  icon: string;
  /** Short bold Arabic title. */
  title: string;
  /** Supporting one-to-two-sentence description. */
  description: string;
}

/** Real, data-derived stats shown in the hero strip (never fake numbers). */
export interface LandingHeroStats {
  salonsCount: number;
  totalReviews: number;
  avgRating: number;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly providersService = inject(ProvidersService);

  /** Used in the footer copyright line. */
  readonly currentYear = new Date().getFullYear();

  /**
   * The three platform benefits rendered as cards via @for. These are static
   * marketing copy (not business/entity data) — real salons and stats are
   * fetched from the public `GET /api/providers` endpoint instead.
   */
  readonly features: LandingFeature[] = [
    {
      icon: 'pi pi-calendar-plus',
      title: 'سهولة وسرعة الحجز',
      description:
        'احجز موعدك في دقائق معدودة مع تأكيد فوري وإشعارات تذكيرية — بدون مكالمات ولا انتظار.',
    },
    {
      icon: 'pi pi-star-fill',
      title: 'نخبة صالونات التجميل والحلاقة',
      description:
        'مجموعة مختارة بعناية من أفضل الصالونات والكوافيرات والباربر شوب، مع تقييمات حقيقية من عملائهم.',
    },
    {
      icon: 'pi pi-chart-line',
      title: 'إدارة ذكية للمواعيد والخدمات',
      description:
        'لأصحاب الصالونات: جدولة ذكية، ومتابعة فورية للحجوزات، وتقارير أداء دقيقة تساعدك على النمو.',
    },
  ];

  // ---------------------------------------------------------------------------
  // Live data — real salons fetched from the public `GET /api/providers`.
  // ---------------------------------------------------------------------------

  /** All active salons/providers, sorted by the backend (highest rating first). */
  readonly providers = signal<IPublicProvider[]>([]);

  /** `true` while the public providers request is in flight. */
  readonly isLoading = signal(false);

  /** Human-readable fetch error — `null` after a successful load. */
  readonly loadError = signal<string | null>(null);

  /** Top 3 salons rendered in the hero "top rated" panel. */
  readonly topProviders = computed(() => this.providers().slice(0, 3));

  /** Up to 8 salons rendered in the featured salons grid section. */
  readonly featuredProviders = computed(() => this.providers().slice(0, 8));

  /**
   * Hero stats derived from the live feed — `null` until data arrives, so the
   * hero never renders fixed placeholder numbers (e.g. "+500 صالون").
   */
  readonly heroStats = computed<LandingHeroStats | null>(() => {
    const list = this.providers();
    if (list.length === 0) {
      return null;
    }
    return {
      salonsCount: list.length,
      totalReviews: list.reduce((sum, provider) => sum + (provider.reviewsCount ?? 0), 0),
      avgRating:
        list.reduce((sum, provider) => sum + (provider.averageRating ?? 0), 0) / list.length,
    };
  });

  /** Rating + reviews of the #1 salon — powers the hero floating chip. */
  readonly topProviderSummary = computed<{ rating: number; reviewsCount: number } | null>(() => {
    const top = this.topProviders()[0];
    if (!top) {
      return null;
    }
    return { rating: top.averageRating ?? 0, reviewsCount: top.reviewsCount ?? 0 };
  });

  /** Arabic grouping with Latin digits, e.g. `1,250` (matches admin dashboard). */
  private readonly numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn');

  ngOnInit(): void {
    // Fetch only in the browser: SSR/prerender renders the neutral loading/empty
    // state, so the static build never depends on the API being reachable.
    if (isPlatformBrowser(this.platformId)) {
      this.loadProviders();
    }
  }

  /** Formats a number with western (Latin) digits + Arabic grouping. */
  formatNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return this.numberFormatter.format(value);
  }

  /** Short rating label: `4.9` for rated salons, `جديد` for unrated ones. */
  ratingLabel(provider: IPublicProvider): string {
    if ((provider.reviewsCount ?? 0) > 0) {
      return (provider.averageRating ?? 0).toFixed(1);
    }
    return 'جديد';
  }

  /** Fetches the public active salons list into the `providers` signal. */
  loadProviders(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.providersService
      .getProviders()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => this.providers.set(response.providers ?? []),
        error: (error) =>
          this.loadError.set(error?.error?.message ?? error?.message ?? 'تعذر تحميل الصالونات'),
      });
  }

  /** Smooth-scrolls to an in-page anchor (SSR-safe: no-op on the server). */
  scrollToSection(id: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
