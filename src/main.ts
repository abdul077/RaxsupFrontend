import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Handle chunk load errors - common issue with lazy-loaded modules after deployment
window.addEventListener('error', (event: ErrorEvent) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    console.warn('Chunk load error detected, reloading page...', event);
    // Reload the page to retry loading the chunk
    window.location.reload();
  }
});

// Also handle unhandled promise rejections for chunk load errors
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
    const errorMessage = (event.reason as Error).message;
    if (errorMessage && errorMessage.includes('Failed to fetch dynamically imported module')) {
      console.warn('Chunk load error in promise rejection, reloading page...', event.reason);
      event.preventDefault();
      window.location.reload();
    }
  }
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
