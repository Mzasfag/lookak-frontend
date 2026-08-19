import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Dynamic, parameterized routes cannot be prerendered without explicit
    // prerender params. Render them on the server (SSR) instead.
    path: 'client/provider/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
