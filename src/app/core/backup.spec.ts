import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { AppDb } from './db';
import {
  BACKUP_SCHEMA_VERSION,
  BackupData,
  BackupError,
  backupFileName,
  createBackup,
  readBackup,
  restoreBackup,
} from './backup';
import { ItemNode, Photo } from './models';
import { blobBytes, fakeImage } from '../../testing/test-db';

let dbCounter = 0;
function freshDb(): AppDb {
  return new AppDb(`backup-test-${Date.now()}-${++dbCounter}`);
}

const nodes: ItemNode[] = [
  {
    id: 'kaelder',
    parentId: null,
    name: 'Kælder',
    tags: [],
    favorite: true,
    createdAt: 1,
    updatedAt: 2,
    lastViewedAt: 5,
  },
  {
    id: 'reol',
    parentId: 'kaelder',
    name: 'Reol 2',
    tags: ['træ'],
    favorite: false,
    createdAt: 3,
    updatedAt: 3,
    notes: 'Ved vinduet',
  },
  {
    id: 'skruer',
    parentId: 'reol',
    name: 'Skruer 4x40',
    tags: ['jern', 'værktøj'],
    favorite: false,
    createdAt: 4,
    updatedAt: 9,
    quantity: 200,
  },
  {
    id: 'tom',
    parentId: 'reol',
    name: 'Tom kasse',
    tags: [],
    favorite: false,
    createdAt: 6,
    updatedAt: 6,
    quantity: 0,
  },
];

const photos: Photo[] = [
  {
    id: 'p1',
    nodeId: 'skruer',
    createdAt: 10,
    blob: fakeImage([1, 2, 3, 255], 'image/webp'),
    thumbnail: fakeImage([9, 8], 'image/webp'),
  },
  {
    id: 'p2',
    nodeId: 'skruer',
    createdAt: 11,
    blob: fakeImage([4, 5, 6], 'image/jpeg'),
    thumbnail: fakeImage([7], 'image/jpeg'),
  },
  {
    id: 'p3',
    nodeId: 'kaelder',
    createdAt: 12,
    blob: fakeImage([0, 0, 0, 1]),
    thumbnail: fakeImage([2]),
  },
];

async function photoSnapshot(db: AppDb) {
  const all = await db.photos.orderBy('id').toArray();
  return Promise.all(
    all.map(async (p) => ({
      id: p.id,
      nodeId: p.nodeId,
      createdAt: p.createdAt,
      type: p.blob.type,
      bytes: await blobBytes(p.blob),
      thumbType: p.thumbnail.type,
      thumbBytes: await blobBytes(p.thumbnail),
    })),
  );
}

/** Builds a zip by hand to test validation. */
function zipWith(data: unknown, extra: Record<string, Uint8Array> = {}): Blob {
  const zipped = zipSync({ 'data.json': strToU8(JSON.stringify(data)), ...extra });
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

function validData(): BackupData {
  return {
    schemaVersion: 1,
    app: 'hvor-er-den',
    exportedAt: '2026-01-02T03:04:05.000Z',
    nodes: structuredClone(nodes),
    photos: [],
  };
}

describe('backup', () => {
  let source: AppDb;
  let target: AppDb;

  beforeEach(async () => {
    source = freshDb();
    target = freshDb();
    await source.nodes.bulkAdd(structuredClone(nodes));
    await source.photos.bulkAdd(photos);
  });

  afterEach(async () => {
    for (const db of [source, target]) {
      db.close();
      await db.delete();
    }
  });

  it('round trip: export followed by restore yields identical data and photos', async () => {
    // Something already on the target device that must be replaced.
    await target.nodes.add({
      id: 'old',
      parentId: null,
      name: 'Gammel',
      tags: [],
      favorite: false,
      createdAt: 0,
      updatedAt: 0,
    });
    await target.photos.add({
      id: 'old-photo',
      nodeId: 'old',
      createdAt: 0,
      blob: fakeImage([1]),
      thumbnail: fakeImage([1]),
    });

    const backup = await createBackup(source, new Date('2026-03-04T10:00:00Z'));
    expect(backup.nodeCount).toBe(4);
    expect(backup.photoCount).toBe(3);
    expect(backup.blob.type).toBe('application/zip');

    const validated = await readBackup(backup.blob);
    expect(validated.exportedAt.toISOString()).toBe('2026-03-04T10:00:00.000Z');
    await restoreBackup(target, validated);

    expect(await target.nodes.orderBy('id').toArray()).toEqual(
      await source.nodes.orderBy('id').toArray(),
    );
    expect(await photoSnapshot(target)).toEqual(await photoSnapshot(source));
    expect(await target.nodes.get('old')).toBeUndefined();
  });

  it('writes data.json with schemaVersion and a photos/ folder', async () => {
    const backup = await createBackup(source, new Date('2026-03-04T10:00:00Z'));
    const files = unzipSync(new Uint8Array(await backup.blob.arrayBuffer()));
    const data = JSON.parse(strFromU8(files['data.json'])) as BackupData;
    expect(data.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(data.app).toBe('hvor-er-den');
    expect(data.nodes).toHaveLength(4);
    expect(data.photos.map((p) => p.file).sort()).toEqual([
      'photos/p1.webp',
      'photos/p2.jpg',
      'photos/p3.webp',
    ]);
    expect(Array.from(files['photos/p2.jpg'])).toEqual([4, 5, 6]);
    expect(Array.from(files['photos/p1-thumb.webp'])).toEqual([9, 8]);
    expect(backup.fileName).toBe(backupFileName(new Date('2026-03-04T10:00:00Z')));
  });

  it('leaves out deleted (tombstoned) nodes and their photos', async () => {
    await source.nodes.update('skruer', { deletedAt: 123 });
    const backup = await createBackup(source);
    const validated = await readBackup(backup.blob);
    expect(validated.nodes.map((n) => n.id).sort()).toEqual(['kaelder', 'reol', 'tom']);
    expect(validated.photos.map((p) => p.id)).toEqual(['p3']);
    expect(validated.nodes.every((n) => !('deletedAt' in n))).toBe(true);
  });

  it('exports an empty database', async () => {
    const empty = freshDb();
    const validated = await readBackup((await createBackup(empty)).blob);
    expect(validated.nodes).toEqual([]);
    expect(validated.photos).toEqual([]);
    empty.close();
    await empty.delete();
  });

  describe('validation (nothing is deleted before the file is known to be good)', () => {
    async function expectInvalid(file: Blob, message: RegExp) {
      await expect(readBackup(file)).rejects.toThrow(message);
      await expect(readBackup(file)).rejects.toBeInstanceOf(BackupError);
    }

    it('rejects files that are not zips or lack data.json', async () => {
      await expectInvalid(new Blob(['hello']), /ikke en gyldig zip/);
      const noData = new Blob([zipSync({ 'other.txt': strToU8('x') }) as Uint8Array<ArrayBuffer>]);
      await expectInvalid(noData, /mangler data.json/);
      const badJson = new Blob([
        zipSync({ 'data.json': strToU8('{oops') }) as Uint8Array<ArrayBuffer>,
      ]);
      await expectInvalid(badJson, /kan ikke læses/);
    });

    it('rejects unknown or newer schema versions', async () => {
      await expectInvalid(zipWith({ ...validData(), schemaVersion: 99 }), /nyere version/);
      await expectInvalid(zipWith({ ...validData(), schemaVersion: undefined }), /schemaVersion/);
      await expectInvalid(zipWith({ ...validData(), app: 'noget-andet' }), /ikke en backup/);
    });

    it('rejects broken nodes, dangling parents and cycles', async () => {
      const missingName = validData();
      missingName.nodes[1].name = ' ';
      await expectInvalid(zipWith(missingName), /mangler et navn/);

      const dangling = validData();
      dangling.nodes[2].parentId = 'nowhere';
      await expectInvalid(zipWith(dangling), /ikke findes/);

      const cycle = validData();
      cycle.nodes[0].parentId = 'skruer';
      await expectInvalid(zipWith(cycle), /inde i sig selv/);

      const duplicate = validData();
      duplicate.nodes.push({ ...duplicate.nodes[0] });
      await expectInvalid(zipWith(duplicate), /to gange/);

      const badQuantity = validData();
      (badQuantity.nodes[2] as unknown as Record<string, unknown>)['quantity'] = 'mange';
      await expectInvalid(zipWith(badQuantity), /antal/);
    });

    it('rejects photos that are missing from the zip or point to unknown nodes', async () => {
      const data = validData();
      data.photos = [
        {
          id: 'p1',
          nodeId: 'skruer',
          createdAt: 1,
          file: 'photos/p1.webp',
          type: 'image/webp',
          thumbnailFile: 'photos/p1-thumb.webp',
          thumbnailType: 'image/webp',
        },
      ];
      await expectInvalid(zipWith(data), /mangler i zip-filen/);
      await expectInvalid(
        zipWith(data, { 'photos/p1.webp': new Uint8Array([1]) }),
        /miniaturebillede/,
      );
      data.photos[0].nodeId = 'ghost';
      await expectInvalid(
        zipWith(data, {
          'photos/p1.webp': new Uint8Array([1]),
          'photos/p1-thumb.webp': new Uint8Array([2]),
        }),
        /ikke findes/,
      );
    });

    it('keeps existing data when the backup is invalid', async () => {
      const bad = validData();
      bad.nodes[1].parentId = 'nowhere';
      await expect(readBackup(zipWith(bad))).rejects.toThrow();
      expect(await source.nodes.count()).toBe(4);
      expect(await source.photos.count()).toBe(3);
    });
  });
});
