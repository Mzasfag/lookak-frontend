import { Service, signal } from '@angular/core';

@Service()
export class LoadingService {
  isLoading = signal<boolean>(false);

  // hide loader
  hideLoader() {
    this.isLoading.set(false);
  }

  // show loader
  showLoader() {
    this.isLoading.set(true);
  }
}
