import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, Subject, throwError } from 'rxjs';
import { IProviderProfile } from '../../../../models/provider.model';
import { NotifyService } from '../../../../services/notify.service';
import { ProviderProfileService } from '../../../../services/provider-profile.service';
import {
  MAX_PORTFOLIO_IMAGES,
  ProviderPortfolioImage,
  ProviderProfileComponent,
} from './provider-profile.component';

function makeProfile(overrides: Partial<IProviderProfile> = {}): IProviderProfile {
  return {
    _id: 'provider-1',
    name: 'سارة محمد',
    email: 'sara@lookak.app',
    phone: '+201001112233',
    role: 'provider',
    salonName: 'صالون لمسة روز',
    address: 'حي النخيل، الرياض',
    description: 'خدمات شعر وعناية احترافية تناسب جميع المناسبات.',
    averageRating: 4.8,
    reviewsCount: 18,
    subscriptionStatus: 'active',
    portfolio: [
      {
        url: 'https://images.example.com/portfolio-1.webp',
        portfolioImageId: 'portfolio-image-1',
        publicId: 'portfolio-1',
        caption: 'تصفيف عروس',
      },
    ],
    ...overrides,
  };
}

describe('ProviderProfileComponent', () => {
  const profileServiceStub = {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadPortfolioImages: vi.fn(),
    deletePortfolioImage: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    profileServiceStub.getProfile.mockReturnValue(of({ user: makeProfile() }));
    profileServiceStub.updateProfile.mockReturnValue(
      of({ message: 'updated', user: makeProfile() }),
    );
    profileServiceStub.uploadPortfolioImages.mockReturnValue(
      of({
        message: 'uploaded',
        images: [
          { url: 'https://images.example.com/uploaded-1.webp', publicId: 'uploaded-1' },
          { url: 'https://images.example.com/uploaded-2.webp', publicId: 'uploaded-2' },
        ],
      }),
    );
    profileServiceStub.deletePortfolioImage.mockReturnValue(of({ message: 'deleted' }));

    await TestBed.configureTestingModule({
      imports: [ProviderProfileComponent],
      providers: [
        MessageService,
        NotifyService,
        { provide: ProviderProfileService, useValue: profileServiceStub },
      ],
    }).compileComponents();
  });

  it('loads the provider profile and renders the summary and portfolio', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(profileServiceStub.getProfile).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.profile()?.salonName).toBe('صالون لمسة روز');
    expect(fixture.componentInstance.portfolioImages()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('صالون لمسة روز');
    expect(fixture.nativeElement.querySelector('[data-testid="portfolio-image-0"]')).toBeTruthy();
  });

  it('persists trimmed form data without clearing the current portfolio', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.profileForm.patchValue({
      name: '  سارة أحمد  ',
      salonName: '  لمسة روز  ',
      phone: ' +201001112233 ',
      address: '  حي النخيل، الرياض ',
      description: '  خدمات شعر وعناية احترافية تناسب جميع المناسبات. ',
    });
    fixture.componentInstance.onSave();

    expect(profileServiceStub.updateProfile).toHaveBeenCalledWith({
      name: 'سارة أحمد',
      salonName: 'لمسة روز',
      phone: '+201001112233',
      address: 'حي النخيل، الرياض',
      description: 'خدمات شعر وعناية احترافية تناسب جميع المناسبات.',
      bio: 'خدمات شعر وعناية احترافية تناسب جميع المناسبات.',
    });
    expect(fixture.componentInstance.portfolioImages()).toHaveLength(1);
  });

  it('blocks an invalid profile submission and exposes inline validation feedback', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.profileForm.patchValue({ phone: 'invalid-number' });
    fixture.componentInstance.onSave();
    fixture.detectChanges();

    expect(profileServiceStub.updateProfile).not.toHaveBeenCalled();
    expect(fixture.componentInstance.profileForm.touched).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('أدخل رقم هاتف صحيحاً');
  });

  it('deletes a persisted image by its portfolio id and removes it after the request succeeds', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const deletion = new Subject<{ message: string }>();
    profileServiceStub.deletePortfolioImage.mockReturnValue(deletion);
    const image = fixture.componentInstance.portfolioImages()[0];
    fixture.componentInstance.onRemoveImage(image);

    expect(profileServiceStub.deletePortfolioImage).toHaveBeenCalledWith('portfolio-image-1');
    expect(fixture.componentInstance.portfolioImages()).toHaveLength(1);
    expect(fixture.componentInstance.portfolioImages()[0].isDeleting).toBe(true);

    deletion.next({ message: 'deleted' });
    deletion.complete();

    expect(fixture.componentInstance.portfolioImages()).toHaveLength(0);
  });

  it('keeps a persisted image visible and re-enables its delete control when deletion fails', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    profileServiceStub.deletePortfolioImage.mockReturnValue(
      throwError(() => new Error('delete failed')),
    );
    const image = fixture.componentInstance.portfolioImages()[0];
    fixture.componentInstance.onRemoveImage(image);

    expect(fixture.componentInstance.portfolioImages()).toHaveLength(1);
    expect(fixture.componentInstance.portfolioImages()[0].isDeleting).toBe(false);
  });

  it('shows a recovery state after a profile request fails and retries successfully', async () => {
    profileServiceStub.getProfile
      .mockImplementationOnce(() => throwError(() => new Error('network error')))
      .mockReturnValue(of({ user: makeProfile() }));

    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.hasError()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="provider-profile-error"]'),
    ).toBeTruthy();

    fixture.componentInstance.loadProfile();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.hasError()).toBe(false);
    expect(fixture.componentInstance.profile()?.name).toBe('سارة محمد');
  });

  it('marks a failed image tile with an accessible fallback state', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const image = fixture.componentInstance.portfolioImages()[0];
    fixture.componentInstance.onImageLoadError(image);
    fixture.detectChanges();

    expect(fixture.componentInstance.portfolioImages()[0].hasLoadError).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('تعذر تحميل الصورة');
  });

  it('does not accept more images after the gallery capacity is reached', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const images: ProviderPortfolioImage[] = Array.from(
      { length: MAX_PORTFOLIO_IMAGES },
      (_, index) => ({
        id: String(index),
        url: `https://images.example.com/${index}.webp`,
        isLocal: false,
        isUploading: false,
      }),
    );
    fixture.componentInstance.portfolioImages.set(images);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '[data-testid="portfolio-file-input"]',
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('uploads selected images as one batch with the optional caption', async () => {
    const fixture = TestBed.createComponent(ProviderProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const firstFile = new File(['first image'], 'first.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['second image'], 'second.webp', { type: 'image/webp' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [firstFile, secondFile] });
    vi.spyOn(fixture.componentInstance as any, 'readFileAsDataURL')
      .mockResolvedValueOnce('data:image/jpeg;base64,first')
      .mockResolvedValueOnce('data:image/webp;base64,second');
    fixture.componentInstance.portfolioCaption.setValue('  تصفيف زفاف  ');

    fixture.componentInstance.onFilesSelected({ target: input } as unknown as Event);
    await fixture.whenStable();

    expect(profileServiceStub.uploadPortfolioImages).toHaveBeenCalledWith(
      [firstFile, secondFile],
      'تصفيف زفاف',
    );
    expect(fixture.componentInstance.portfolioImages()).toHaveLength(3);
    expect(fixture.componentInstance.portfolioCaption.value).toBe('');
  });
});
