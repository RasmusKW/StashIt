import { Injectable, inject } from '@angular/core';
import { NodeStore } from './node-store';
import { PhotoStore } from './photo-store';
import { SearchEngine, SearchHit, SearchQuery } from './search-engine';

/** Angular wrapper around {@link SearchEngine}, kept in sync with the {@link NodeStore}. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly store = inject(NodeStore);
  private readonly photos = inject(PhotoStore);

  private readonly engine = new SearchEngine({
    get: (id) => this.store.lookup.get(id),
    all: () => this.store.values(),
    hasPhoto: (id) => this.photos.hasPhotos(id),
  });

  constructor() {
    this.store.onChange((change) => {
      if (change.kind === 'reset') this.engine.reset();
      else this.engine.markDirty(change.ids);
    });
  }

  /** Runs a search. Reactive: re-runs inside computeds when nodes or photos change. */
  search(query: SearchQuery): SearchHit[] {
    this.store.revision();
    this.photos.revision();
    return this.engine.search(query);
  }
}
