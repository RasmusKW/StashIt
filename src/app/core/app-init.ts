import { Injectable, inject, signal } from '@angular/core';
import { CrossTabSync } from './cross-tab-sync';
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
  const sync = inject(CrossTabSync);

  // Fire and forget: the browser may show a prompt or decide silently.
  void storage.requestPersistence();

  return (async () => {
    try {
      await Promise.all([photos.init(), meta.init()]);
      await nodes.init();
      listenToOtherTabs(sync, async () => {
        await Promise.all([photos.init(), meta.init()]);
        await nodes.init({ repair: false });
      });
    } catch (error) {
      console.error('Kunne ikke åbne databasen', error);
      status.initError.set(
        'Databasen kunne ikke åbnes. Browseren tillader måske ikke lokal lagring (f.eks. i privat tilstand).',
      );
    }
  })();
}

/** Reloads (debounced) when another tab of the app changed the data. */
function listenToOtherTabs(sync: CrossTabSync, reload: () => Promise<void>): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  sync.listen(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      reload().catch((error: unknown) => console.error('Kunne ikke genindlæse data', error));
    }, 150);
  });
}
