import { Injectable, inject, signal } from '@angular/core';
import { CrossTabSync } from './cross-tab-sync';
import { APP_DB } from './db';

const LAST_BACKUP = 'lastBackupAt';
const RECENT_TARGETS = 'recentMoveTargets';
const RECENT_TARGETS_LIMIT = 6;

/** Days after which the home screen nags about making a backup. */
export const BACKUP_REMINDER_DAYS = 30;

/** Small key/value settings persisted in IndexedDB. */
@Injectable({ providedIn: 'root' })
export class MetaStore {
  private readonly db = inject(APP_DB);
  private readonly sync = inject(CrossTabSync);

  private readonly _lastBackupAt = signal<number | null>(null);
  private readonly _recentTargets = signal<readonly string[]>([]);

  /** Time of the last successful backup export, or null if never. */
  readonly lastBackupAt = this._lastBackupAt.asReadonly();
  /** Most recently used move targets (node ids), newest first. */
  readonly recentTargets = this._recentTargets.asReadonly();

  async init(): Promise<void> {
    const [last, recent] = await Promise.all([
      this.db.meta.get(LAST_BACKUP),
      this.db.meta.get(RECENT_TARGETS),
    ]);
    this._lastBackupAt.set(typeof last?.value === 'number' ? last.value : null);
    this._recentTargets.set(
      Array.isArray(recent?.value)
        ? recent.value.filter((v): v is string => typeof v === 'string')
        : [],
    );
  }

  async setLastBackupAt(time: number): Promise<void> {
    await this.db.meta.put({ key: LAST_BACKUP, value: time });
    this._lastBackupAt.set(time);
    this.sync.notify();
  }

  async addRecentTarget(nodeId: string): Promise<void> {
    const next = [nodeId, ...this._recentTargets().filter((id) => id !== nodeId)].slice(
      0,
      RECENT_TARGETS_LIMIT,
    );
    await this.db.meta.put({ key: RECENT_TARGETS, value: next });
    this._recentTargets.set(next);
  }
}

/** True if a backup reminder should be shown at `now`. */
export function backupIsDue(lastBackupAt: number | null, now: number): boolean {
  if (lastBackupAt === null) return true;
  return now - lastBackupAt > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}
