import { inject, Service } from '@angular/core';
import { MessageService } from 'primeng/api';

@Service()
export class NotifyService {
  private messageService = inject(MessageService);
  showInfo(message: string) {
    this.messageService.add({
      severity: 'info',
      summary: 'معلومة',
      detail: message,
    });
  }

  showSuccess(message: string) {
    this.messageService.add({
      severity: 'success',
      summary: 'تم بنجاح',
      detail: message,
      life:5000
    });
  }

  showWarn(message: string) {
    this.messageService.add({
      severity: 'warn',
      summary: 'تنبيه',
      detail: message,
    });
  }

  showError(message: string) {
    this.messageService.add({
      severity: 'error',
      summary: 'حدث خطأ',
      detail: message,
    });
  }

  showSecondary(message: string) {
    this.messageService.add({
      severity: 'secondary',
      summary: 'للعلم',
      detail: message,
    });
  }

  showContrast(message: string) {
    this.messageService.add({
      severity: 'contrast',
      summary: 'إشعار',
      detail: message,
    });
  }
}
