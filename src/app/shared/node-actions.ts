import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MetaStore } from '../core/meta-store';
import { NodeStore } from '../core/node-store';
import { UndoService } from '../core/undo.service';
import { plural } from '../core/text';
import { AddTagDialog, AddTagDialogData } from './add-tag-dialog';
import { MoveSheet, MoveSheetData, MoveSheetResult } from './move-sheet';

/** User-facing node actions: performed immediately, with "Fortryd" instead of confirmations. */
@Injectable({ providedIn: 'root' })
export class NodeActions {
  private readonly store = inject(NodeStore);
  private readonly undo = inject(UndoService);
  private readonly meta = inject(MetaStore);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);

  /**
   * Opens "Flyt til…" and moves the nodes to the chosen place.
   * Returns true if something was moved.
   */
  async move(ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return false;
    const fine = matchMedia('(pointer: fine)').matches;
    const ref = this.bottomSheet.open<MoveSheet, MoveSheetData, MoveSheetResult>(MoveSheet, {
      data: { ids },
      panelClass: 'app-move-sheet',
      ariaLabel: 'Flyt til',
      // Only jump into the search field where it does not pop up a virtual keyboard.
      autoFocus: fine ? '#move-search' : 'dialog',
    });
    const result = await firstValueFrom(ref.afterDismissed());
    if (!result) return false;
    const target = result.targetId === null ? null : this.store.get(result.targetId);
    let before;
    try {
      before = await this.store.move(ids, result.targetId);
    } catch (error) {
      this.undo.error(error instanceof Error ? error.message : 'Kunne ikke flytte');
      return false;
    }
    if (result.targetId !== null) void this.meta.addRecentTarget(result.targetId);
    if (before.length === 0) return true;
    const where = target ? `«${target.name}»` : 'øverste niveau';
    const what =
      before.length === 1 ? `«${before[0].name}»` : plural(before.length, 'ting', 'ting');
    this.undo.show(`Flyttede ${what} til ${where}`, {
      undo: () => this.store.putSnapshots(before),
    });
    return true;
  }

  /** Asks for a tag and adds it to the nodes. Returns true if a tag was added. */
  async addTag(ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return false;
    const ref = this.dialog.open<AddTagDialog, AddTagDialogData, string>(AddTagDialog, {
      data: { count: ids.length },
      width: 'min(92vw, 420px)',
    });
    const tag = await firstValueFrom(ref.afterClosed());
    if (!tag) return false;
    const before = await this.store.addTag(ids, tag);
    if (before.length > 0) {
      this.undo.show(`#${tag} tilføjet til ${plural(before.length, 'ting', 'ting')}`, {
        undo: () => this.store.putSnapshots(before),
      });
    }
    return true;
  }

  /** Deletes nodes with everything inside them; undo restores all of it. */
  async delete(ids: readonly string[], options: { onUndo?: () => void } = {}): Promise<void> {
    if (ids.length === 0) return;
    const first = this.store.get(ids[0]);
    let handle;
    try {
      handle = await this.store.softDelete(ids);
    } catch (error) {
      console.error(error);
      this.undo.error('Kunne ikke slette');
      return;
    }
    const inside = handle.ids.length - handle.rootCount;
    const what =
      handle.rootCount === 1 && first
        ? `«${first.name}»`
        : plural(handle.rootCount, 'ting', 'ting');
    const message =
      inside > 0
        ? `Slettede ${what} med ${plural(inside, 'ting', 'ting')} indeni`
        : `Slettede ${what}`;
    this.undo.show(message, {
      undo: async () => {
        await handle.undo();
        options.onUndo?.();
      },
      expire: () => handle.commit(),
    });
  }

  /** Marks nodes as favorites (or removes the mark if all already are). */
  async toggleFavorite(ids: readonly string[]): Promise<void> {
    const nodes = ids.map((id) => this.store.get(id)).filter((n) => n !== undefined);
    if (nodes.length === 0) return;
    const favorite = !nodes.every((node) => node.favorite);
    const before = await this.store.setFavorite(ids, favorite);
    if (ids.length === 1) return; // a single star toggle is its own undo
    const message = favorite
      ? `${plural(before.length, 'ting', 'ting')} markeret som favorit`
      : `${plural(before.length, 'ting', 'ting')} fjernet fra favoritter`;
    this.undo.show(message, { undo: () => this.store.putSnapshots(before) });
  }
}
