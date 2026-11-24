import { TestBed } from '@angular/core/testing';
import { AppDb } from './db';
import { PhotoStore } from './photo-store';
import { blobBytes, fakeImage, provideTestDb } from '../../testing/test-db';

describe('PhotoStore', () => {
  let db: AppDb;
  let photos: PhotoStore;

  beforeEach(async () => {
    db = provideTestDb();
    photos = TestBed.inject(PhotoStore);
    await photos.init();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('indexes photos per node in creation order without loading blobs', async () => {
    const a = await photos.addCompressed('n1', { blob: fakeImage([1]), thumbnail: fakeImage([2]) });
    await new Promise((r) => setTimeout(r, 2));
    const b = await photos.addCompressed('n1', { blob: fakeImage([3]), thumbnail: fakeImage([4]) });
    await photos.addCompressed('n2', { blob: fakeImage([5]), thumbnail: fakeImage([6]) });

    const fresh = TestBed.runInInjectionContext(() => new PhotoStore());
    await fresh.init();
    expect(fresh.photoIds('n1')).toEqual([a.id, b.id]);
    expect(fresh.firstPhotoId('n1')).toBe(a.id);
    expect(fresh.hasPhotos('n2')).toBe(true);
    expect(fresh.hasPhotos('n3')).toBe(false);
    expect(fresh.count()).toBe(3);
  });

  it('removes a photo and restores it (bytes intact) in the original position', async () => {
    const a = await photos.addCompressed('n1', { blob: fakeImage([1, 2]), thumbnail: fakeImage([3]) });
    await new Promise((r) => setTimeout(r, 2));
    const b = await photos.addCompressed('n1', { blob: fakeImage([4]), thumbnail: fakeImage([5]) });

    const removed = await photos.remove(a.id);
    expect(photos.photoIds('n1')).toEqual([b.id]);
    expect(await db.photos.get(a.id)).toBeUndefined();

    await photos.restore(removed!);
    expect(photos.photoIds('n1')).toEqual([a.id, b.id]);
    const stored = await db.photos.get(a.id);
    expect(await blobBytes(stored!.blob)).toEqual([1, 2]);
    expect(stored!.blob.type).toBe('image/webp');
  });
});
