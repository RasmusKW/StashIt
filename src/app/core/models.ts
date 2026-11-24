/**
 * The only kind of element in the app. Any node can contain other nodes; whether a node is a
 * "container" is decided solely by whether it has children.
 *
 * Timestamps are epoch milliseconds.
 */
export interface ItemNode {
  id: string;
  /** `null` = top level (a room such as "Kælder"). */
  parentId: string | null;
  name: string;
  notes?: string;
  /** Lower-case tags without the leading `#`. */
  tags: string[];
  quantity?: number;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastViewedAt?: number;
  /**
   * Internal tombstone for undoable deletes. A node with `deletedAt` is hidden everywhere and
   * permanently purged (with its photos) once the undo window closes or on the next start.
   */
  deletedAt?: number;
}

/** A compressed photo attached to a node. Stored in its own table. */
export interface Photo {
  id: string;
  nodeId: string;
  blob: Blob;
  thumbnail: Blob;
  createdAt: number;
}

/** Key/value settings such as the time of the last backup. */
export interface MetaEntry {
  key: string;
  value: unknown;
}

/** Fields that can be edited inline on a node. */
export type NodePatch = Partial<
  Pick<ItemNode, 'name' | 'notes' | 'tags' | 'quantity' | 'favorite' | 'lastViewedAt'>
>;

/** What is needed to create a node (the quick-add parser produces this). */
export interface NewNode {
  name: string;
  tags?: string[];
  quantity?: number;
  notes?: string;
}

export function newId(): string {
  return crypto.randomUUID();
}
