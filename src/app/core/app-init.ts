import { Injectable, inject, signal } from '@angular/core';
import { MetaStore } from './meta-store';
import { NodeStore } from './node-store';
import { PhotoStore } from './photo-store';
import { StorageService } from './storage.service';

/** Global app status (currently only whether the database could be opened). */
@Injectable({ providedIn: 'root' })
export class AppStatus {
  readonly initError = signal<string | null>(null);
}

/** App initializer: opens IndexedDB, loads everything into memory, asks for persistence. */
export function initializeData(): Promise<void> {
  const photos = inject(PhotoStore);
  const nodes = inject(NodeStore);
  const meta = inject(MetaStore);
  const storage = inject(StorageService);
  const status = inject(AppStatus);

  // Fire and forget: the browser may show a prompt or decide silently.
  void storage.requestPersistence();

  return (async () => {
    try {
      await Promise.all([photos.init(), meta.init()]);
      await nodes.init();
    } catch (error) {
      console.error('Kunne ikke åbne databasen', error);
      status.initError.set(
        'Databasen kunne ikke åbnes. Browseren tillader måske ikke lokal lagring (f.eks. i privat tilstand).',
      );
    }
  })();
}
