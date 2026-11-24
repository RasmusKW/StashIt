import { Injectable, inject } from '@angular/core';
import { ValidatedBackup, createBackup, readBackup, restoreBackup } from './backup';
import { APP_DB } from './db';
import { MetaStore } from './meta-store';
import { NodeStore } from './node-store';

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Export (share or download) and restore of backups. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(APP_DB);
  private readonly meta = inject(MetaStore);
  private readonly store = inject(NodeStore);

  /**
   * Creates the backup zip and hands it to the Web Share API (Android: save to Drive, send by
   * mail, …). Falls back to a normal download where sharing files is not possible.
   */
  async export(): Promise<ExportOutcome> {
    const backup = await createBackup(this.db);
    const file = new File([backup.blob], backup.fileName, { type: 'application/zip' });

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Backup af «Hvor er den?»' });
        await this.meta.setLastBackupAt(Date.now());
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        // E.g. NotAllowedError when building a big zip outlived the user gesture: download.
      }
    }

    download(file);
    await this.meta.setLastBackupAt(Date.now());
    return 'downloaded';
  }

  /** Reads and validates a backup file without touching the database. */
  read(file: Blob): Promise<ValidatedBackup> {
    return readBackup(file);
  }

  /** Overwrites everything with the (already validated) backup. */
  async restore(backup: ValidatedBackup): Promise<void> {
    await restoreBackup(this.db, backup);
    await this.store.reload();
    // The data on the device now equals that backup.
    await this.meta.setLastBackupAt(backup.exportedAt.getTime());
  }
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
