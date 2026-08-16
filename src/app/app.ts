import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { NotifyService } from './core/services/notify.service';
import { LoadingService } from './core/services/loading.service';
import { LoaderComponent } from "./shared/components/loader/loader.component";
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('لوكك');
  loadingService = inject(LoadingService);
  notifyService = inject(NotifyService);
}
