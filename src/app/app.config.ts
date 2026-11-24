import { registerLocaleData } from '@angular/common';
import localeDa from '@angular/common/locales/da';
import {
  ApplicationConfig,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { registerIcons } from './core/icons';

registerLocaleData(localeDa);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routing: works on any static host and in any sub folder without rewrite rules.
    provideRouter(
      routes,
      withHashLocation(),
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    { provide: LOCALE_ID, useValue: 'da' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register right away so the app is available offline after the very first visit.
      registrationStrategy: 'registerImmediately',
    }),
    provideAppInitializer(() => registerIcons()),
  ],
};
