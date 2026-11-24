import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NodeStore, TagCount } from '../../core/node-store';
import { SearchQuery, isActiveQuery } from '../../core/search-engine';
import { SearchService } from '../../core/search.service';
import { naturalCompare } from '../../core/text';

export const SEARCH_DEBOUNCE_MS = 100;

/**
 * Search state for one page (provided per page component). Text and filters are mirrored into
 * the URL's query string (`?q=…&tag=…&fav=1&foto=1&alle=1`) with `replaceState`, so the back
 * button returns to the same results after opening one.
 */
@Injectable()
export class SearchController implements OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly store = inject(NodeStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** What is in the input right now. */
  readonly text = signal('');
  /** The text that is actually searched (~100 ms behind). */
  private readonly debouncedText = signal('');
  readonly tags = signal<readonly string[]>([]);
  readonly favoritesOnly = signal(false);
  readonly withPhoto = signal(false);
  readonly everywhere = signal(false);
  private readonly scopeId = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** The node the search is limited to (null = everywhere). */
  readonly scope = computed(() => (this.everywhere() ? null : this.scopeId()));
  readonly isScoped = computed(() => this.scopeId() !== null);

  readonly query = computed<SearchQuery>(() => ({
    text: this.debouncedText(),
    scopeId: this.scope(),
    tags: this.tags(),
    favoritesOnly: this.favoritesOnly(),
    withPhoto: this.withPhoto(),
  }));

  /** Whether results replace the normal page content (reacts instantly to typing). */
  readonly active = computed(() => isActiveQuery({ ...this.query(), text: this.text() }));

  readonly results = computed(() => {
    const query = this.query();
    return isActiveQuery(query) ? this.searchService.search(query).map((hit) => hit.node) : [];
  });

  /** Tags offered as filter chips: those used within the scope, selected ones first. */
  readonly tagOptions = computed<TagCount[]>(() => {
    const scope = this.scope();
    let counts: TagCount[];
    if (scope === null) {
      counts = this.store.tagCounts();
    } else {
      const map = new Map<string, number>();
      for (const id of this.store.subtreeIds([scope]).slice(1)) {
        for (const tag of this.store.get(id)?.tags ?? []) map.set(tag, (map.get(tag) ?? 0) + 1);
      }
      counts = [...map.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || naturalCompare(a.tag, b.tag));
    }
    const selected = this.tags();
    const known = new Set(counts.map((c) => c.tag));
    const missing = selected.filter((tag) => !known.has(tag)).map((tag) => ({ tag, count: 0 }));
    return [
      ...counts.filter((c) => selected.includes(c.tag)),
      ...missing,
      ...counts.filter((c) => !selected.includes(c.tag)),
    ];
  });

  /** Sets the scope and restores state from the URL. Call once when the page starts. */
  init(scopeId: string | null): void {
    this.scopeId.set(scopeId);
    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q') ?? '';
    this.text.set(q);
    this.debouncedText.set(q);
    this.tags.set(params.getAll('tag'));
    this.favoritesOnly.set(params.get('fav') === '1');
    this.withPhoto.set(params.get('foto') === '1');
    this.everywhere.set(params.get('alle') === '1');
  }

  setText(value: string): void {
    this.text.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.debouncedText.set(value);
      this.syncUrl();
    }, SEARCH_DEBOUNCE_MS);
  }

  setTag(tag: string, selected: boolean): void {
    const current = this.tags().filter((t) => t !== tag);
    this.tags.set(selected ? [...current, tag] : current);
    this.syncUrl();
  }

  setFavoritesOnly(value: boolean): void {
    this.favoritesOnly.set(value);
    this.syncUrl();
  }

  setWithPhoto(value: boolean): void {
    this.withPhoto.set(value);
    this.syncUrl();
  }

  setEverywhere(value: boolean): void {
    this.everywhere.set(value);
    this.syncUrl();
  }

  /** Clears text and filters. */
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.text.set('');
    this.debouncedText.set('');
    this.tags.set([]);
    this.favoritesOnly.set(false);
    this.withPhoto.set(false);
    this.everywhere.set(false);
    this.syncUrl();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private syncUrl(): void {
    const params = new URLSearchParams();
    const text = this.debouncedText().trim();
    if (text) params.set('q', text);
    for (const tag of this.tags()) params.append('tag', tag);
    if (this.favoritesOnly()) params.set('fav', '1');
    if (this.withPhoto()) params.set('foto', '1');
    if (this.everywhere()) params.set('alle', '1');
    const path = this.router.url.split('?')[0];
    this.location.replaceState(path, params.toString());
  }
}
