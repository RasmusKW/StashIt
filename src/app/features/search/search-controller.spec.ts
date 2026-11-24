import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AppDb } from '../../core/db';
import { NodeStore } from '../../core/node-store';
import { PhotoStore } from '../../core/photo-store';
import { provideTestDb } from '../../../testing/test-db';
import { SEARCH_DEBOUNCE_MS, SearchController } from './search-controller';

describe('SearchController', () => {
  let db: AppDb;
  let store: NodeStore;
  let replaceState: ReturnType<typeof vi.fn>;
  let currentQuery: Record<string, string | string[]> = {};

  function setup(query: Record<string, string | string[]>): SearchController {
    currentQuery = query;
    return TestBed.inject(SearchController);
  }

  beforeEach(async () => {
    replaceState = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SearchController,
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap: convertToParamMap(currentQuery) };
            },
          },
        },
        { provide: Location, useValue: { replaceState } },
      ],
    });
    db = provideTestDb();
    store = TestBed.inject(NodeStore);
    await TestBed.inject(PhotoStore).init();
    await store.init();
    await store.create(null, [
      { name: 'Skruetrækker', tags: ['værktøj'] },
      { name: 'Spidstang', tags: ['værktøj', 'tang'] },
      { name: 'Lampe' },
    ]);
  });

  afterEach(async () => {
    vi.useRealTimers();
    db.close();
    await db.delete();
  });

  it('restores text and filters from the URL', () => {
    const ctrl = setup({ q: 'skru', tag: ['værktøj'], fav: '1', foto: '1', alle: '1' });
    ctrl.init(null);
    expect(ctrl.text()).toBe('skru');
    expect(ctrl.query()).toEqual({
      text: 'skru',
      scopeId: null,
      tags: ['værktøj'],
      favoritesOnly: true,
      withPhoto: true,
    });
  });

  it('debounces typing and mirrors the state into the URL', () => {
    vi.useFakeTimers();
    const ctrl = setup({});
    ctrl.init(null);
    ctrl.setText('spid');
    expect(ctrl.active()).toBe(true);
    expect(ctrl.results()).toEqual([]);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(ctrl.results().map((n) => n.name)).toEqual(['Spidstang']);
    expect(replaceState).toHaveBeenLastCalledWith('/', 'q=spid');

    ctrl.setTag('værktøj', true);
    expect(replaceState).toHaveBeenLastCalledWith('/', 'q=spid&tag=v%C3%A6rkt%C3%B8j');
  });

  it('filters without text and offers the tags in use, selected first', () => {
    const ctrl = setup({});
    ctrl.init(null);
    expect(ctrl.tagOptions().map((t) => t.tag)).toEqual(['værktøj', 'tang']);
    ctrl.setTag('tang', true);
    expect(ctrl.tagOptions().map((t) => t.tag)).toEqual(['tang', 'værktøj']);
    expect(ctrl.results().map((n) => n.name)).toEqual(['Spidstang']);
    ctrl.clear();
    expect(ctrl.active()).toBe(false);
  });
});
