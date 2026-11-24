import { Injectable, computed, inject, signal } from '@angular/core';
import { CrossTabSync } from './cross-tab-sync';
import { APP_DB } from './db';
import { ItemNode, NewNode, NodePatch, newId } from './models';
import { buildNumberIndex } from './numbering';
import { PhotoStore } from './photo-store';
import { mergeTags, naturalCompare, normalizeTag } from './text';
import { NodeLookup, ancestorsOf, canMoveTo, collectSubtree, topmostOnly } from './tree';

/** Change notifications for derived indexes (search). */
export type NodeChange =
  | { kind: 'upsert'; ids: readonly string[] }
  | { kind: 'remove'; ids: readonly string[] }
  | { kind: 'reset' };

/** A pending, undoable delete. Exactly one of `undo`/`commit` takes effect. */
export interface DeleteHandle {
  /** Ids of all deleted nodes (the selected nodes and their descendants). */
  readonly ids: readonly string[];
  /** Number of nodes the user selected (descendants not counted). */
  readonly rootCount: number;
  undo(): Promise<void>;
  /** Permanently removes the nodes and their photos. */
  commit(): Promise<void>;
}

export interface TagCount {
  tag: string;
  count: number;
}

const RECENT_LIMIT = 10;

/**
 * Single source of truth for nodes while the app runs. All nodes are kept in memory
 * (5 000 nodes is tiny) so lists, paths and counts never wait for IndexedDB. Every write goes
 * to IndexedDB first and is then applied in memory; `revision` makes everything reactive.
 */
@Injectable({ providedIn: 'root' })
export class NodeStore {
  private readonly db = inject(APP_DB);
  private readonly photos = inject(PhotoStore);
  private readonly sync = inject(CrossTabSync);

  private readonly byId = new Map<string, ItemNode>();
  /** parentId → children (unsorted); rebuilt lazily after changes. */
  private groups: Map<string | null, ItemNode[]> | null = null;
  /** parentId → naturally sorted children; filled on demand. */
  private readonly sortedGroups = new Map<string | null, ItemNode[]>();
  private readonly listeners = new Set<(change: NodeChange) => void>();
  private readonly _revision = signal(0);

  /** Increments on every change; read it to make computeds/effects reactive. */
  readonly revision = this._revision.asReadonly();

  /** Non-reactive lookup for the pure tree helpers. */
  readonly lookup: NodeLookup = { get: (id: string) => this.byId.get(id) };

  /** Non-reactive iteration over all nodes (for derived indexes). */
  values(): IterableIterator<ItemNode> {
    return this.byId.values();
  }

  readonly count = computed(() => {
    this._revision();
    return this.byId.size;
  });

  readonly favorites = computed(() => {
    this._revision();
    return [...this.byId.values()]
      .filter((node) => node.favorite)
      .sort((a, b) => naturalCompare(a.name, b.name));
  });

  readonly recentlyViewed = computed(() => {
    this._revision();
    return [...this.byId.values()]
      .filter((node) => node.lastViewedAt !== undefined)
      .sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0))
      .slice(0, RECENT_LIMIT);
  });

  /** All tags in use with their counts, most used first. */
  readonly tagCounts = computed<TagCount[]>(() => {
    this._revision();
    const counts = new Map<string, number>();
    for (const node of this.byId.values()) {
      for (const tag of node.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || naturalCompare(a.tag, b.tag));
  });

  readonly numberIndex = computed(() => {
    this._revision();
    return buildNumberIndex([...this.byId.values()].map((node) => node.name));
  });

  /**
   * Loads everything from IndexedDB. On app start (`repair`) it also finishes deletes that were
   * interrupted by closing the app and repairs orphans. Reloads triggered by another tab skip
   * that: the other tab may still be inside its undo window.
   */
  async init(options: { repair?: boolean } = {}): Promise<void> {
    const repair = options.repair ?? true;
    const all = await this.db.nodes.toArray();
    const tombstoned = all.filter((node) => node.deletedAt !== undefined).map((node) => node.id);
    if (repair && tombstoned.length) await this.purge(tombstoned);

    this.byId.clear();
    for (const node of all) if (node.deletedAt === undefined) this.byId.set(node.id, node);

    // Safety net: never let a node become invisible because its parent is missing.
    const orphans = [...this.byId.values()].filter(
      (node) => node.parentId !== null && !this.byId.has(node.parentId),
    );
    if (repair && orphans.length) {
      const fixed = orphans.map((node) => ({ ...node, parentId: null }));
      await this.db.nodes.bulkPut(fixed);
      for (const node of fixed) this.byId.set(node.id, node);
    }

    this.changed({ kind: 'reset' });
  }

  /** Subscribes to changes; returns an unsubscribe function. */
  onChange(listener: (change: NodeChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------- reads (all reactive)

  get(id: string | null | undefined): ItemNode | undefined {
    this._revision();
    return id ? this.byId.get(id) : undefined;
  }

  all(): ItemNode[] {
    this._revision();
    return [...this.byId.values()];
  }

  /** Children of a node (or top level for `null`), naturally sorted by name. */
  children(parentId: string | null): readonly ItemNode[] {
    this._revision();
    let sorted = this.sortedGroups.get(parentId);
    if (!sorted) {
      sorted = [...(this.groupMap().get(parentId) ?? [])].sort(
        (a, b) => naturalCompare(a.name, b.name) || a.createdAt - b.createdAt,
      );
      this.sortedGroups.set(parentId, sorted);
    }
    return sorted;
  }

  childCount(id: string): number {
    this._revision();
    return this.groupMap().get(id)?.length ?? 0;
  }

  /** Ancestors from the top level down to the parent (the node itself excluded). */
  ancestors(id: string): ItemNode[] {
    this._revision();
    return ancestorsOf(this.lookup, id);
  }

  /** "Kælder › Reol 2" – the location of a node (its ancestors' names). */
  locationText(id: string): string {
    return this.ancestors(id)
      .map((node) => node.name)
      .join(' › ');
  }

  /** All ids in the subtrees of `ids` (included). */
  subtreeIds(ids: readonly string[]): string[] {
    this._revision();
    return collectSubtree((id) => this.groupMap().get(id) ?? [], ids);
  }

  canMoveTo(ids: readonly string[], targetId: string | null): boolean {
    this._revision();
    return canMoveTo(this.lookup, ids, targetId);
  }

  // ---------------------------------------------------------------- writes

  /** Creates nodes inside `parentId` (in the given order). */
  async create(parentId: string | null, items: readonly NewNode[]): Promise<ItemNode[]> {
    if (parentId !== null && !this.byId.has(parentId)) throw new Error('Placeringen findes ikke');
    const now = Date.now();
    const nodes = items
      .filter((item) => item.name.trim().length > 0)
      .map((item, i): ItemNode => {
        const node: ItemNode = {
          id: newId(),
          parentId,
          name: item.name.trim(),
          tags: mergeTags([], item.tags ?? []),
          favorite: false,
          // Distinct timestamps keep creation order stable for identical names.
          createdAt: now + i,
          updatedAt: now + i,
        };
        if (item.quantity !== undefined) node.quantity = item.quantity;
        if (item.notes?.trim()) node.notes = item.notes.trim();
        return node;
      });
    if (nodes.length === 0) return [];
    await this.db.nodes.bulkAdd(nodes);
    for (const node of nodes) this.byId.set(node.id, node);
    this.changed({ kind: 'upsert', ids: nodes.map((n) => n.id) });
    return nodes;
  }

  /** Edits a node. Empty/undefined notes and quantity are removed. */
  async update(id: string, patch: NodePatch): Promise<ItemNode | undefined> {
    const current = this.byId.get(id);
    if (!current) return undefined;
    const next = applyPatch(current, patch, Date.now());
    if (!next) return current;
    await this.db.nodes.put(next);
    this.byId.set(id, next);
    // Renaming changes the searchable path of every descendant.
    this.changed({ kind: 'upsert', ids: [id] }, patch.name !== undefined);
    return next;
  }

  /**
   * Applies a patch to several nodes at once and returns their previous versions so the
   * change can be undone with {@link putSnapshots}.
   */
  async updateMany(
    ids: readonly string[],
    patchFor: (node: ItemNode) => NodePatch,
  ): Promise<ItemNode[]> {
    const now = Date.now();
    const before: ItemNode[] = [];
    const after: ItemNode[] = [];
    for (const id of ids) {
      const current = this.byId.get(id);
      if (!current) continue;
      const next = applyPatch(current, patchFor(current), now);
      if (!next) continue;
      before.push(current);
      after.push(next);
    }
    if (after.length === 0) return [];
    await this.db.nodes.bulkPut(after);
    for (const node of after) this.byId.set(node.id, node);
    this.changed({ kind: 'upsert', ids: after.map((n) => n.id) });
    return before;
  }

  /** Adds a tag to several nodes; returns previous versions for undo. */
  addTag(ids: readonly string[], tag: string): Promise<ItemNode[]> {
    const clean = normalizeTag(tag);
    if (!clean) return Promise.resolve([]);
    return this.updateMany(ids, (node) =>
      node.tags.includes(clean) ? {} : { tags: mergeTags(node.tags, [clean]) },
    );
  }

  /** Sets favorite on several nodes; returns previous versions for undo. */
  setFavorite(ids: readonly string[], favorite: boolean): Promise<ItemNode[]> {
    return this.updateMany(ids, (node) => (node.favorite === favorite ? {} : { favorite }));
  }

  /** Records that a node was opened (does not change `updatedAt`). */
  async markViewed(id: string): Promise<void> {
    const current = this.byId.get(id);
    if (!current) return;
    const next = { ...current, lastViewedAt: Date.now() };
    await this.db.nodes.put(next);
    this.byId.set(id, next);
    this.invalidate();
    this.bump();
  }

  /**
   * Moves nodes into `targetId` (`null` = top level). Throws if any node would end up inside
   * itself. Returns the previous versions for undo.
   */
  async move(ids: readonly string[], targetId: string | null): Promise<ItemNode[]> {
    if (!canMoveTo(this.lookup, ids, targetId)) {
      throw new Error('En ting kan ikke flyttes ind i sig selv');
    }
    const roots = topmostOnly(this.lookup, ids).filter(
      (id) => this.byId.get(id)?.parentId !== targetId,
    );
    const now = Date.now();
    const before = roots.map((id) => this.byId.get(id) as ItemNode);
    const after = before.map((node) => ({ ...node, parentId: targetId, updatedAt: now }));
    if (after.length === 0) return [];
    await this.db.nodes.bulkPut(after);
    for (const node of after) this.byId.set(node.id, node);
    this.changed({ kind: 'upsert', ids: roots }, true);
    return before;
  }

  /** Writes previous versions back (undo for move, tag and favorite changes). */
  async putSnapshots(nodes: readonly ItemNode[]): Promise<void> {
    if (nodes.length === 0) return;
    await this.db.nodes.bulkPut([...nodes]);
    for (const node of nodes) this.byId.set(node.id, node);
    this.changed({ kind: 'upsert', ids: nodes.map((n) => n.id) }, true);
  }

  /**
   * Deletes nodes with their whole subtrees. The nodes disappear immediately but are only
   * tombstoned in IndexedDB until `commit()` (or the next app start) purges them and their
   * photos, so `undo()` can bring everything back.
   */
  async softDelete(ids: readonly string[]): Promise<DeleteHandle> {
    const roots = topmostOnly(this.lookup, ids).filter((id) => this.byId.has(id));
    const all = this.subtreeIds(roots);
    const deletedAt = Date.now();
    const originals = all.map((id) => this.byId.get(id) as ItemNode);
    await this.db.nodes.bulkPut(originals.map((node) => ({ ...node, deletedAt })));
    for (const id of all) this.byId.delete(id);
    this.changed({ kind: 'remove', ids: all });

    let settled = false;
    return {
      ids: all,
      rootCount: roots.length,
      undo: async () => {
        if (settled) return;
        settled = true;
        await this.db.nodes.bulkPut(originals);
        for (const node of originals) this.byId.set(node.id, node);
        this.changed({ kind: 'upsert', ids: all });
      },
      commit: async () => {
        if (settled) return;
        settled = true;
        await this.purge(all);
      },
    };
  }

  /** Reloads everything from IndexedDB (after restoring a backup). */
  async reload(): Promise<void> {
    await this.photos.init();
    await this.init();
    this.sync.notify();
  }

  // ---------------------------------------------------------------- internals

  private async purge(ids: readonly string[]): Promise<void> {
    await this.db.nodes.bulkDelete([...ids]);
    await this.photos.deleteForNodes(ids);
  }

  private groupMap(): Map<string | null, ItemNode[]> {
    if (!this.groups) {
      const groups = new Map<string | null, ItemNode[]>();
      for (const node of this.byId.values()) {
        const list = groups.get(node.parentId);
        if (list) list.push(node);
        else groups.set(node.parentId, [node]);
      }
      this.groups = groups;
    }
    return this.groups;
  }

  /**
   * Notifies listeners and bumps the revision. With `withSubtrees`, the ids of an upsert are
   * expanded to their whole subtrees (their paths changed).
   */
  private changed(change: NodeChange, withSubtrees = false): void {
    this.invalidate();
    const final: NodeChange =
      withSubtrees && change.kind === 'upsert'
        ? { kind: 'upsert', ids: collectSubtree((id) => this.groupMap().get(id) ?? [], change.ids) }
        : change;
    for (const listener of this.listeners) listener(final);
    if (change.kind !== 'reset') this.sync.notify();
    this.bump();
  }

  private invalidate(): void {
    this.groups = null;
    this.sortedGroups.clear();
  }

  private bump(): void {
    this._revision.update((v) => v + 1);
  }
}

/** Returns the patched node, or null if nothing changes. */
function applyPatch(node: ItemNode, patch: NodePatch, now: number): ItemNode | null {
  const next: ItemNode = { ...node };
  let changed = false;

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name && name !== node.name) {
      next.name = name;
      changed = true;
    }
  }
  if ('notes' in patch) {
    const notes = patch.notes?.trim();
    if ((notes || undefined) !== node.notes) {
      if (notes) next.notes = notes;
      else delete next.notes;
      changed = true;
    }
  }
  if ('quantity' in patch) {
    const quantity =
      patch.quantity === undefined || patch.quantity === null || Number.isNaN(patch.quantity)
        ? undefined
        : Math.max(0, Math.round(patch.quantity));
    if (quantity !== node.quantity) {
      if (quantity === undefined) delete next.quantity;
      else next.quantity = quantity;
      changed = true;
    }
  }
  if (patch.tags !== undefined) {
    const tags = mergeTags([], patch.tags);
    if (tags.join('\u0000') !== node.tags.join('\u0000')) {
      next.tags = tags;
      changed = true;
    }
  }
  if (patch.favorite !== undefined && patch.favorite !== node.favorite) {
    next.favorite = patch.favorite;
    changed = true;
  }
  if (!changed) return null;
  next.updatedAt = now;
  return next;
}
