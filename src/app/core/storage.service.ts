import { Injectable, signal } from '@angular/core';

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
}

/** Wraps the StorageManager API (persistence + quota). All methods degrade gracefully. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly _persisted = signal<boolean | null>(null);

  /** Whether the browser granted persistent storage (null = unknown/unsupported). */
  readonly persisted = this._persisted.asReadonly();

  /** Asks the browser not to evict our data. Called on every start. */
  async requestPersistence(): Promise<boolean | null> {
    const storage = navigator.storage;
    if (!storage?.persist) return null;
    try {
      const already = storage.persisted ? await storage.persisted() : false;
      const granted = already || (await storage.persist());
      this._persisted.set(granted);
      return granted;
    } catch {
      return null;
    }
  }

  async refreshPersisted(): Promise<void> {
    try {
      if (navigator.storage?.persisted) this._persisted.set(await navigator.storage.persisted());
    } catch {
      this._persisted.set(null);
    }
  }

  async estimate(): Promise<StorageInfo> {
    try {
      if (!navigator.storage?.estimate) return { usage: null, quota: null };
      const { usage, quota } = await navigator.storage.estimate();
      return { usage: usage ?? null, quota: quota ?? null };
    } catch {
      return { usage: null, quota: null };
    }
  }
}

/** "12,3 MB" */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'ukendt';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString('da-DK', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}
