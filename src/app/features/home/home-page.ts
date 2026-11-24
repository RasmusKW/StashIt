import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MetaStore, backupIsDue } from '../../core/meta-store';
import { NodeStore } from '../../core/node-store';
import { containersFirst } from '../../core/ordering';
import { SelectionService } from '../../core/selection.service';
import { NodeList } from '../../shared/node-list';
import { QuickAdd } from '../../shared/quick-add';

/** Search, favorites, recently viewed and the rooms (top-level nodes). */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButton, MatIconButton, MatIcon, NodeList, QuickAdd],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly store = inject(NodeStore);
  private readonly meta = inject(MetaStore);
  protected readonly selection = inject(SelectionService);

  protected readonly rooms = computed(() =>
    containersFirst(this.store.children(null), (id) => this.store.childCount(id)),
  );
  protected readonly favorites = this.store.favorites;
  protected readonly recent = this.store.recentlyViewed;

  private readonly bannerHidden = signal(false);
  protected readonly lastBackupAt = this.meta.lastBackupAt;
  protected readonly showBackupBanner = computed(
    () =>
      !this.bannerHidden() &&
      this.store.count() > 0 &&
      backupIsDue(this.meta.lastBackupAt(), Date.now()),
  );

  protected hideBanner(): void {
    this.bannerHidden.set(true);
  }
}
