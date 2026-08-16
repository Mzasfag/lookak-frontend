import { Component, input } from '@angular/core';
import { MessageModule, Message } from 'primeng/message';

@Component({
  selector: 'app-error-alert',
  imports: [Message],
  templateUrl: './error-alert.component.html',
  styleUrl: './error-alert.component.css',
})
export class ErrorAlertComponent {
  message = input<string>('');
}
