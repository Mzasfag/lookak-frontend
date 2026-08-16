import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  imports: [],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css',
})
export class LoaderComponent {
  /**
   * When `true`, renders the loader as a fixed, full-screen overlay
   * (surface backdrop + blur) — ideal for page-loading states.
   * When `false` (default), renders an inline, container-centered loader
   * for component-level loading states.
   */
  readonly fullScreen = input(true);

  /**
   * Optional short helper text shown below the animation.
   * Defaults to a beauty-themed phrase ('جارٍ تنسيق إطلالتك…') when the
   * consumer does not provide a custom label.
   */
  readonly label = input('جارٍ تنسيق إطلالتك…');
}
