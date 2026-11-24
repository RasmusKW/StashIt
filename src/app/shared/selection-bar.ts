import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { NodeStore } from '../core/node-store';
import { SelectionService } from '../core/selection.service';
import { NodeActions } from './node-actions';

/** Replaces the top bar while nodes are selected: count + Move, Favorite, Tag, Delete. */
@Component({
  selector: 'app-selection-bar',
  imports: [MatIconButton, MatIcon, MatTooltip],
  template: `
    <header class="app-topbar selecting">
      <div class="app-topbar-inner">
        <button matIconButton type="button" aria-label="Afslut valg" (click)="selection.clear()">
          <mat-icon svgIcon="close" />
        </button>
        <span class="app-topbar-title" aria-live="polite">{{ selection.count() }} valgt</span>
        @if (canSelectMore()) {
          <button
            matIconButton
            type="button"
            aria-label="Vælg alle"
            matTooltip="Vælg alle"
            (click)="selectAll()"
          >
            <mat-icon svgIcon="select-all" />
          </button>
        }
        <button matIconButton type="button" aria-label="Flyt" matTooltip="Flyt" (click)="move()">
          <mat-icon svgIcon="move" />
        </button>
        <button
          matIconButton
          type="button"
          [attr.aria-label]="allFavorites() ? 'Fjern fra favoritter' : 'Gør til favorit'"
          [matTooltip]="allFavorites() ? 'Fjern fra favoritter' : 'Gør til favorit'"
          (click)="favorite()"
        >
          <mat-icon [svgIcon]="allFavorites() ? 'star' : 'star-outline'" />
        </button>
        <button
          matIconButton
          type="button"
          aria-label="Tilføj tag"
          matTooltip="Tilføj tag"
          (click)="tag()"
        >
          <mat-icon svgIcon="tag" />
        </button>
        <button matIconButton type="button" aria-label="Slet" matTooltip="Slet" (click)="remove()">
          <mat-icon svgIcon="delete" />
        </button>
      </div>
    </header>
  `,
  host: { '(document:keydown.escape)': 'selection.clear()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionBar {
  /** All ids that "Vælg alle" selects (the visible list). */
  readonly allIds = input<readonly string[]>([]);

  protected readonly selection = inject(SelectionService);
  private readonly actions = inject(NodeActions);
  private readonly store = inject(NodeStore);

  protected readonly canSelectMore = computed(() =>
    this.allIds().some((id) => !this.selection.isSelected(id)),
  );
  protected readonly allFavorites = computed(() =>
    this.selection.list().every((id) => this.store.get(id)?.favorite),
  );

  protected selectAll(): void {
    this.selection.setAll(this.allIds());
  }

  protected async move(): Promise<void> {
    const moved = await this.actions.move(this.selection.list());
    if (moved) this.selection.clear();
  }

  protected async favorite(): Promise<void> {
    await this.actions.toggleFavorite(this.selection.list());
    this.selection.clear();
  }

  protected async tag(): Promise<void> {
    const tagged = await this.actions.addTag(this.selection.list());
    if (tagged) this.selection.clear();
  }

  protected async remove(): Promise<void> {
    const ids = this.selection.list();
    this.selection.clear();
    await this.actions.delete(ids);
  }
}
