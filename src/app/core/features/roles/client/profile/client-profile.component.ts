import { Component } from '@angular/core';

@Component({
  selector: 'app-client-profile',
  imports: [],
  template: `
    <div class="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 text-center shadow-sm">
      <i class="pi pi-user text-3xl text-primary"></i>
      <h1 class="mt-3 text-xl font-extrabold text-on-surface">الملف الشخصي</h1>
      <p class="mt-2 text-sm font-bold text-on-surface-variant">
        هذه الصفحة قيد الإنشاء — سيتم عرض بياناتك الشخصية وتعديلها هنا.
      </p>
    </div>
  `,
  styleUrl: './client-profile.component.css',
})
export class ClientProfileComponent {}
