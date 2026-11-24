import { TestBed } from '@angular/core/testing';
import { AppDb } from './db';
import { NodeChange, NodeStore } from './node-store';
import { PhotoStore } from './photo-store';
import { fakeImage, provideTestDb } from '../../testing/test-db';

describe('NodeStore', () => {
  let db: AppDb;
  let store: NodeStore;
  let photos: PhotoStore;

  beforeEach(async () => {
    db = provideTestDb();
    store = TestBed.inject(NodeStore);
    photos = TestBed.inject(PhotoStore);
    await photos.init();
    await store.init();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  async function tree() {
    const [kaelder] = await store.create(null, [{ name: 'Kælder' }]);
    const [reol] = await store.create(kaelder.id, [{ name: 'Reol 2' }]);
    const [kasse10, kasse2, skruer] = await store.create(reol.id, [
      { name: 'Kasse 10' },
      { name: 'Kasse 2' },
      { name: 'Skruer', tags: ['#Jern', 'jern'], quantity: 200 },
    ]);
    const [tang] = await store.create(kasse2.id, [{ name: 'Spidstang' }]);
    return { kaelder, reol, kasse10, kasse2, skruer, tang };
  }

  it('creates nodes and persists them', async () => {
    const { reol, skruer } = await tree();
    expect(skruer.tags).toEqual(['jern']);
    expect(skruer.quantity).toBe(200);
    expect(skruer.parentId).toBe(reol.id);
    expect(await db.nodes.count()).toBe(6);
    expect(store.count()).toBe(6);
  });

  it('refuses to create inside a missing parent', async () => {
    await expect(store.create('missing', [{ name: 'X' }])).rejects.toThrow();
  });

  it('lists children with natural sorting and counts them', async () => {
    const { reol, kasse2 } = await tree();
    expect(store.children(reol.id).map((n) => n.name)).toEqual(['Kasse 2', 'Kasse 10', 'Skruer']);
    expect(store.childCount(reol.id)).toBe(3);
    expect(store.childCount(kasse2.id)).toBe(1);
    expect(store.children(null).map((n) => n.name)).toEqual(['Kælder']);
  });

  it('computes ancestors and location text', async () => {
    const { tang } = await tree();
    expect(store.locationText(tang.id)).toBe('Kælder › Reol 2 › Kasse 2');
  });

  it('updates fields inline and removes cleared optional fields', async () => {
    const { skruer } = await tree();
    await store.update(skruer.id, { name: ' Skruer 4x40 ', notes: 'Rustfri', quantity: undefined });
    const updated = store.get(skruer.id);
    expect(updated?.name).toBe('Skruer 4x40');
    expect(updated?.notes).toBe('Rustfri');
    expect(updated && 'quantity' in updated).toBe(false);
    expect((await db.nodes.get(skruer.id))?.notes).toBe('Rustfri');
  });

  it('ignores empty names', async () => {
    const { skruer } = await tree();
    await store.update(skruer.id, { name: '   ' });
    expect(store.get(skruer.id)?.name).toBe('Skruer');
  });

  it('notifies the subtree when a node is renamed (paths change)', async () => {
    const { reol, kasse2, tang } = await tree();
    const changes: NodeChange[] = [];
    store.onChange((change) => changes.push(change));
    await store.update(reol.id, { name: 'Reol B' });
    expect(changes).toHaveLength(1);
    const ids = changes[0].kind === 'upsert' ? changes[0].ids : [];
    expect(ids).toContain(kasse2.id);
    expect(ids).toContain(tang.id);
  });

  describe('move', () => {
    it('moves nodes and can be undone with the returned snapshot', async () => {
      const { kaelder, kasse10, skruer } = await tree();
      const before = await store.move([skruer.id], kasse10.id);
      expect(store.get(skruer.id)?.parentId).toBe(kasse10.id);
      expect((await db.nodes.get(skruer.id))?.parentId).toBe(kasse10.id);

      await store.putSnapshots(before);
      expect(store.get(skruer.id)?.parentId).toBe(skruer.parentId);
      expect(store.childCount(kasse10.id)).toBe(0);

      await store.move([kasse10.id], null);
      expect(store.children(null).map((n) => n.name)).toEqual(['Kasse 10', 'Kælder']);
      expect(store.get(kaelder.id)?.parentId).toBeNull();
    });

    it('refuses to move a node into itself or a descendant', async () => {
      const { kaelder, reol, tang } = await tree();
      await expect(store.move([reol.id], reol.id)).rejects.toThrow();
      await expect(store.move([kaelder.id], tang.id)).rejects.toThrow();
      expect(store.get(reol.id)?.parentId).toBe(kaelder.id);
      expect(store.canMoveTo([kaelder.id], tang.id)).toBe(false);
    });

    it('moves only the topmost of nested selections', async () => {
      const { kaelder, reol, kasse2, tang } = await tree();
      const [loft] = await store.create(null, [{ name: 'Loft' }]);
      await store.move([kasse2.id, tang.id], loft.id);
      expect(store.get(kasse2.id)?.parentId).toBe(loft.id);
      expect(store.get(tang.id)?.parentId).toBe(kasse2.id);
      expect(store.get(reol.id)?.parentId).toBe(kaelder.id);
    });
  });

  describe('delete with undo', () => {
    it('hides the whole subtree immediately and restores it on undo', async () => {
      const { reol, kasse2, tang } = await tree();
      const handle = await store.softDelete([kasse2.id]);
      expect(handle.ids).toEqual([kasse2.id, tang.id]);
      expect(store.get(kasse2.id)).toBeUndefined();
      expect(store.get(tang.id)).toBeUndefined();
      expect(store.childCount(reol.id)).toBe(2);

      await handle.undo();
      expect(store.get(tang.id)?.parentId).toBe(kasse2.id);
      expect((await db.nodes.get(tang.id))?.deletedAt).toBeUndefined();
      await handle.commit(); // no effect after undo
      expect(await db.nodes.get(tang.id)).toBeDefined();
    });

    it('purges nodes and their photos on commit', async () => {
      const { kasse2, tang, skruer } = await tree();
      await photos.addCompressed(tang.id, { blob: fakeImage([1]), thumbnail: fakeImage([2]) });
      await photos.addCompressed(skruer.id, { blob: fakeImage([3]), thumbnail: fakeImage([4]) });
      const handle = await store.softDelete([kasse2.id]);
      await handle.commit();
      expect(await db.nodes.get(tang.id)).toBeUndefined();
      expect(await db.photos.where('nodeId').equals(tang.id).count()).toBe(0);
      expect(await db.photos.count()).toBe(1);
      expect(photos.hasPhotos(tang.id)).toBe(false);
      expect(photos.hasPhotos(skruer.id)).toBe(true);
    });

    it('finishes interrupted deletes on the next start', async () => {
      const { kasse2, tang } = await tree();
      await photos.addCompressed(tang.id, { blob: fakeImage([1]), thumbnail: fakeImage([2]) });
      await store.softDelete([kasse2.id]); // app closed before the undo window ended
      expect((await db.nodes.get(tang.id))?.deletedAt).toBeDefined();

      await store.init();
      expect(await db.nodes.get(tang.id)).toBeUndefined();
      expect(await db.photos.count()).toBe(0);
      expect(store.count()).toBe(4);
    });
  });

  it('re-parents orphans to the top level on start', async () => {
    await db.nodes.add({
      id: 'orphan',
      parentId: 'gone',
      name: 'Forældreløs',
      tags: [],
      favorite: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await store.init();
    expect(store.get('orphan')?.parentId).toBeNull();
  });

  it('tracks favorites, recently viewed and tag counts', async () => {
    const { skruer, tang, reol } = await tree();
    const before = await store.setFavorite([tang.id, skruer.id], true);
    expect(before).toHaveLength(2);
    expect(store.favorites().map((n) => n.name)).toEqual(['Skruer', 'Spidstang']);
    await store.putSnapshots(before);
    expect(store.favorites()).toEqual([]);

    await store.markViewed(reol.id);
    await new Promise((r) => setTimeout(r, 2));
    await store.markViewed(tang.id);
    expect(store.recentlyViewed().map((n) => n.name)).toEqual(['Spidstang', 'Reol 2']);

    await store.addTag([tang.id, skruer.id], '#Værktøj');
    expect(store.tagCounts()).toEqual([
      { tag: 'værktøj', count: 2 },
      { tag: 'jern', count: 1 },
    ]);
  });

  it('keeps an index of numbered names', async () => {
    await tree();
    expect(store.numberIndex().get('kasse')?.max).toBe(10);
  });
});
