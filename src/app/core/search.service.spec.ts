import { TestBed } from '@angular/core/testing';
import { AppDb } from './db';
import { NodeStore } from './node-store';
import { PhotoStore } from './photo-store';
import { emptyQuery } from './search-engine';
import { SearchService } from './search.service';
import { fakeImage, provideTestDb } from '../../testing/test-db';

describe('SearchService (wired to the store)', () => {
  let db: AppDb;
  let store: NodeStore;
  let search: SearchService;
  const find = (text: string, extra = {}) =>
    search.search({ ...emptyQuery(), text, ...extra }).map((hit) => hit.node.name);

  beforeEach(async () => {
    db = provideTestDb();
    store = TestBed.inject(NodeStore);
    search = TestBed.inject(SearchService);
    await TestBed.inject(PhotoStore).init();
    await store.init();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('follows creates, renames, moves and deletes', async () => {
    const [kaelder, loft] = await store.create(null, [{ name: 'Kælder' }, { name: 'Loft' }]);
    const [reol] = await store.create(kaelder.id, [{ name: 'Reol 2' }]);
    const [tang] = await store.create(reol.id, [{ name: 'Spidstang', tags: ['værktøj'] }]);
    expect(find('spids')).toEqual(['Spidstang']);
    expect(find('kaelder reol')).toEqual(['Reol 2', 'Spidstang']);

    await store.update(kaelder.id, { name: 'Garage' });
    expect(find('garage')).toEqual(['Garage', 'Reol 2', 'Spidstang']);

    const before = await store.move([tang.id], loft.id);
    expect(find('loft spids')).toEqual(['Spidstang']);
    await store.putSnapshots(before);
    expect(find('garage spids')).toEqual(['Spidstang']);

    const handle = await store.softDelete([reol.id]);
    expect(find('spids')).toEqual([]);
    await handle.undo();
    expect(find('spids')).toEqual(['Spidstang']);
  });

  it('filters on photos', async () => {
    const [a] = await store.create(null, [{ name: 'Med foto' }, { name: 'Uden foto' }]);
    await TestBed.inject(PhotoStore).addCompressed(a.id, {
      blob: fakeImage([1]),
      thumbnail: fakeImage([2]),
    });
    expect(find('', { withPhoto: true })).toEqual(['Med foto']);
  });
});
