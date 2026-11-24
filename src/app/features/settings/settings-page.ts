import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { BackupError } from '../../core/backup';
import { BackupService } from '../../core/backup.service';
import { MetaStore } from '../../core/meta-store';
import { NodeStore } from '../../core/node-store';
import { PhotoStore } from '../../core/photo-store';
import { StorageInfo, StorageService, formatBytes } from '../../core/storage.service';
import { plural } from '../../core/text';
import { UndoService } from '../../core/undo.service';
import { APP_VERSION } from '../../core/version';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';

/** Backup export/restore, storage usage and persistence status. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, DatePipe, MatButton, MatIconButton, MatIcon, MatProgressBar],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly backup = inject(BackupService);
  private readonly meta = inject(MetaStore);
  private readonly store = inject(NodeStore);
  private readonly photos = inject(PhotoStore);
  private readonly storage = inject(StorageService);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(UndoService);

  protected readonly version = APP_VERSION;
  protected readonly lastBackupAt = this.meta.lastBackupAt;
  protected readonly persisted = this.storage.persisted;
  protected readonly contents = computed(
    () =>
      `${plural(this.store.count(), 'ting', 'ting')} og ${plural(this.photos.count(), 'billede', 'billeder')}`,
  );

  protected readonly exporting = signal(false);
  protected readonly restoring = signal(false);
  protected readonly restoreError = signal<string | null>(null);
  protected readonly storageInfo = signal<StorageInfo>({ usage: null, quota: null });
  protected readonly usageText = computed(() => {
    const { usage, quota } = this.storageInfo();
    if (usage === null) return 'Browseren oplyser ikke forbruget.';
    return quota
      ? `${formatBytes(usage)} brugt af ${formatBytes(quota)} ledigt`
      : formatBytes(usage);
  });
  protected readonly usagePercent = computed(() => {
    const { usage, quota } = this.storageInfo();
    return usage !== null && quota ? Math.min(100, (usage / quota) * 100) : 0;
  });

  constructor() {
    void this.refreshStorage();
  }

  protected async export(): Promise<void> {
    this.exporting.set(true);
    try {
      const outcome = await this.backup.export();
      if (outcome === 'shared') this.feedback.info('Backup delt');
      else if (outcome === 'downloaded') this.feedback.info('Backup hentet');
    } catch (error) {
      console.error(error);
      this.feedback.error('Backuppen kunne ikke laves');
    } finally {
      this.exporting.set(false);
      void this.refreshStorage();
    }
  }

  protected async onRestoreFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.restoreError.set(null);
    this.restoring.set(true);
    try {
      // 1. Validate everything first – nothing is deleted if the file is bad.
      const backup = await this.backup.read(file);
      // 2. The one confirmation in the app: this overwrites everything.
      const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: 'Overskriv alt med backuppen?',
          message: 'Alt, der er gemt på denne enhed nu, bliver slettet og erstattet af backuppen.',
          details: [
            `Backuppen er fra ${backup.exportedAt.toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' })}`,
            `Den indeholder ${plural(backup.nodes.length, 'ting', 'ting')} og ${plural(backup.photos.length, 'billede', 'billeder')}`,
            `Nu på enheden: ${this.contents()}`,
          ],
          confirm: 'Overskriv og gendan',
        },
        width: 'min(92vw, 460px)',
      });
      if (!(await firstValueFrom(ref.afterClosed()))) return;
      await this.backup.restore(backup);
      this.feedback.info(`Backup gendannet: ${plural(backup.nodes.length, 'ting', 'ting')}`);
    } catch (error) {
      if (error instanceof BackupError) {
        this.restoreError.set(error.message);
      } else {
        console.error(error);
        this.restoreError.set('Backuppen kunne ikke gendannes.');
      }
    } finally {
      this.restoring.set(false);
      void this.refreshStorage();
    }
  }

  protected async requestPersistence(): Promise<void> {
    const granted = await this.storage.requestPersistence();
    if (!granted) {
      this.feedback.info(
        'Browseren gav ikke tilladelse. Installér appen på hjemmeskærmen og prøv igen.',
      );
    }
  }

  private async refreshStorage(): Promise<void> {
    await this.storage.refreshPersisted();
    this.storageInfo.set(await this.storage.estimate());
  }
}
