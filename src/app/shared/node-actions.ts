import { Injectable, inject } from '@angular/core';
import { NodeStore } from '../core/node-store';
import { UndoService } from '../core/undo.service';
import { plural } from '../core/text';

/** User-facing node actions: performed immediately, with "Fortryd" instead of confirmations. */
@Injectable({ providedIn: 'root' })
export class NodeActions {
  private readonly store = inject(NodeStore);
  private readonly undo = inject(UndoService);

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
