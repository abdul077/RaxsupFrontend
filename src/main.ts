import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

declare global {
  interface Window {
    __chunkLoadErrorPromptShown?: boolean;
  }
}

function maybePromptReloadForChunkError(context: unknown): void {
  // Never hard-reload automatically: it wipes unsaved form/filter state.
  // If a chunk fails to load (often after a deployment), let the user choose.
  if (window.__chunkLoadErrorPromptShown) return;
  window.__chunkLoadErrorPromptShown = true;

  // Keep this dependency-free (no Angular injection available here).
  // eslint-disable-next-line no-alert
  const shouldReload = window.confirm(
    'A new version of this portal may be available (a module failed to load).\n\nReload the page now?'
  );
  if (shouldReload) {
    window.location.reload();
  } else {
    // Allow the app to keep running; user can manually reload later.
    // Reset after some time so we can prompt again if it keeps happening.
    window.setTimeout(() => {
      window.__chunkLoadErrorPromptShown = false;
    }, 5 * 60 * 1000);
    console.warn('Chunk load error detected (reload skipped by user).', context);
  }
}

// Handle chunk load errors - common issue with lazy-loaded modules after deployment
window.addEventListener('error', (event: ErrorEvent) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    maybePromptReloadForChunkError(event);
  }
});

// Also handle unhandled promise rejections for chunk load errors
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const msg =
    reason && typeof reason === 'object' && 'message' in reason ? String((reason as any).message) : '';
  if (msg.includes('Failed to fetch dynamically imported module')) {
    event.preventDefault();
    maybePromptReloadForChunkError(reason);
  }
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
