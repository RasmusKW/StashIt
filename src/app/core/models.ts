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

/** A random v4 UUID. Falls back to getRandomValues where randomUUID is unavailable (http://). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
