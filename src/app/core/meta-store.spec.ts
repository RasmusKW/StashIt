import { TestBed } from '@angular/core/testing';
import { AppDb } from './db';
import { MetaStore, backupIsDue } from './meta-store';
import { provideTestDb } from '../../testing/test-db';

describe('MetaStore', () => {
  let db: AppDb;

  beforeEach(() => {
    db = provideTestDb();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('persists the last backup time and recent move targets', async () => {
    const meta = TestBed.inject(MetaStore);
    await meta.init();
    expect(meta.lastBackupAt()).toBeNull();
    await meta.setLastBackupAt(123);
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g']) await meta.addRecentTarget(id);

    const fresh = TestBed.runInInjectionContext(() => new MetaStore());
    await fresh.init();
    expect(fresh.lastBackupAt()).toBe(123);
    expect(fresh.recentTargets()).toEqual(['g', 'f', 'e', 'd', 'c', 'a']);
  });

  it('knows when a backup is due', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    expect(backupIsDue(null, now)).toBe(true);
    expect(backupIsDue(now - 29 * day, now)).toBe(false);
    expect(backupIsDue(now - 31 * day, now)).toBe(true);
  });
});
