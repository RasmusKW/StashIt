import { Zippable, strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { AppDb } from './db';
import { extensionFor } from './image-compress';
import { ItemNode, Photo } from './models';

/**
 * Backup format (zip):
 *
 *   data.json          { schemaVersion, app, exportedAt, nodes: ItemNode[], photos: [...] }
 *   photos/<id>.webp   full-size photo (or .jpg)
 *   photos/<id>-thumb.webp
 *
 * Restoring validates the whole file before anything in the database is touched.
 */

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_ID = 'hvor-er-den';

export interface BackupPhotoEntry {
  id: string;
  nodeId: string;
  createdAt: number;
  file: string;
  type: string;
  thumbnailFile: string;
  thumbnailType: string;
}

export interface BackupData {
  schemaVersion: number;
  app: string;
  exportedAt: string;
  nodes: ItemNode[];
  photos: BackupPhotoEntry[];
}

export interface CreatedBackup {
  blob: Blob;
  fileName: string;
  nodeCount: number;
  photoCount: number;
}

/** A backup that passed validation and is ready to be written to the database. */
export interface ValidatedBackup {
  schemaVersion: number;
  exportedAt: Date;
  nodes: ItemNode[];
  photos: Photo[];
}

/** Validation/reading error with a user-facing Danish message. */
export class BackupError extends Error {
  override readonly name = 'BackupError';
}

/** Only the documented fields – internal ones (tombstones) never leave the app. */
function exportNode(node: ItemNode): ItemNode {
  const out: ItemNode = {
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    tags: [...node.tags],
    favorite: node.favorite,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
  if (node.notes !== undefined) out.notes = node.notes;
  if (node.quantity !== undefined) out.quantity = node.quantity;
  if (node.lastViewedAt !== undefined) out.lastViewedAt = node.lastViewedAt;
  return out;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function backupFileName(date: Date): string {
  return `hvor-er-den-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

/** Builds the backup zip from the database (deleted-but-undoable nodes are left out). */
export async function createBackup(db: AppDb, now: Date = new Date()): Promise<CreatedBackup> {
  const [allNodes, allPhotos] = await db.transaction('r', db.nodes, db.photos, () =>
    Promise.all([db.nodes.toArray(), db.photos.toArray()]),
  );
  const nodes = allNodes.filter((node) => node.deletedAt === undefined).map(exportNode);
  const liveIds = new Set(nodes.map((node) => node.id));
  const photos = allPhotos.filter((photo) => liveIds.has(photo.nodeId));

  const photoFiles: Zippable = {};
  const entries: BackupPhotoEntry[] = [];
  for (const photo of photos) {
    const file = `${photo.id}.${extensionFor(photo.blob.type)}`;
    const thumbnailFile = `${photo.id}-thumb.${extensionFor(photo.thumbnail.type)}`;
    // Photos are already compressed: store them without zip compression (fast, same size).
    photoFiles[file] = [new Uint8Array(await photo.blob.arrayBuffer()), { level: 0 }];
    photoFiles[thumbnailFile] = [new Uint8Array(await photo.thumbnail.arrayBuffer()), { level: 0 }];
    entries.push({
      id: photo.id,
      nodeId: photo.nodeId,
      createdAt: photo.createdAt,
      file: `photos/${file}`,
      type: photo.blob.type || 'image/jpeg',
      thumbnailFile: `photos/${thumbnailFile}`,
      thumbnailType: photo.thumbnail.type || 'image/jpeg',
    });
  }

  const data: BackupData = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_ID,
    exportedAt: now.toISOString(),
    nodes,
    photos: entries,
  };

  const zipped = zipSync(
    { 'data.json': [strToU8(JSON.stringify(data, null, 2)), { level: 6 }], photos: photoFiles },
    { mtime: now },
  );
  return {
    blob: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
    fileName: backupFileName(now),
    nodeCount: nodes.length,
    photoCount: photos.length,
  };
}

// ------------------------------------------------------------------------------------ reading

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateNode(raw: unknown, index: number): ItemNode {
  const where = `Ting nr. ${index + 1}`;
  if (!isRecord(raw)) throw new BackupError(`${where} er ugyldig.`);
  const {
    id,
    parentId,
    name,
    tags,
    favorite,
    createdAt,
    updatedAt,
    notes,
    quantity,
    lastViewedAt,
  } = raw;
  if (typeof id !== 'string' || !id) throw new BackupError(`${where} mangler et id.`);
  if (parentId !== null && typeof parentId !== 'string') {
    throw new BackupError(`${where} har en ugyldig placering.`);
  }
  if (typeof name !== 'string' || !name.trim()) throw new BackupError(`${where} mangler et navn.`);
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
    throw new BackupError(`${where} («${name}») har ugyldige tags.`);
  }
  if (typeof favorite !== 'boolean') throw new BackupError(`${where} («${name}») er ugyldig.`);
  if (!isFiniteNumber(createdAt) || !isFiniteNumber(updatedAt)) {
    throw new BackupError(`${where} («${name}») har ugyldige datoer.`);
  }
  const node: ItemNode = { id, parentId, name, tags, favorite, createdAt, updatedAt };
  if (notes !== undefined) {
    if (typeof notes !== 'string')
      throw new BackupError(`${where} («${name}») har ugyldige noter.`);
    node.notes = notes;
  }
  if (quantity !== undefined) {
    if (!isFiniteNumber(quantity) || quantity < 0) {
      throw new BackupError(`${where} («${name}») har et ugyldigt antal.`);
    }
    node.quantity = quantity;
  }
  if (lastViewedAt !== undefined) {
    if (!isFiniteNumber(lastViewedAt)) throw new BackupError(`${where} («${name}») er ugyldig.`);
    node.lastViewedAt = lastViewedAt;
  }
  return node;
}

function validateTree(nodes: ItemNode[]): void {
  const byId = new Map<string, ItemNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) throw new BackupError(`Id'et ${node.id} findes to gange.`);
    byId.set(node.id, node);
  }
  for (const node of nodes) {
    if (node.parentId !== null && !byId.has(node.parentId)) {
      throw new BackupError(`«${node.name}» ligger i noget, der ikke findes i backuppen.`);
    }
  }
  // Every chain of parents must end at the top level (no cycles).
  const settled = new Set<string>();
  for (const node of nodes) {
    const chain = new Set<string>();
    let current: ItemNode | undefined = node;
    while (current && !settled.has(current.id)) {
      if (chain.has(current.id)) {
        throw new BackupError(`«${current.name}» ligger inde i sig selv.`);
      }
      chain.add(current.id);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    for (const id of chain) settled.add(id);
  }
}

function validatePhotos(
  raw: unknown,
  nodeIds: ReadonlySet<string>,
  files: Readonly<Record<string, Uint8Array>>,
): Photo[] {
  if (!Array.isArray(raw)) throw new BackupError('Listen over billeder mangler.');
  const seen = new Set<string>();
  return raw.map((entry: unknown, index) => {
    const where = `Billede nr. ${index + 1}`;
    if (!isRecord(entry)) throw new BackupError(`${where} er ugyldigt.`);
    const { id, nodeId, createdAt, file, type, thumbnailFile, thumbnailType } = entry;
    if (typeof id !== 'string' || !id || seen.has(id)) {
      throw new BackupError(`${where} har et ugyldigt id.`);
    }
    seen.add(id);
    if (typeof nodeId !== 'string' || !nodeIds.has(nodeId)) {
      throw new BackupError(`${where} hører til en ting, der ikke findes.`);
    }
    if (!isFiniteNumber(createdAt)) throw new BackupError(`${where} har en ugyldig dato.`);
    if (typeof file !== 'string' || !files[file]) {
      throw new BackupError(`${where} mangler i zip-filen (${String(file)}).`);
    }
    if (typeof thumbnailFile !== 'string' || !files[thumbnailFile]) {
      throw new BackupError(`${where} mangler sit miniaturebillede.`);
    }
    const blobType = typeof type === 'string' && type.startsWith('image/') ? type : 'image/jpeg';
    const thumbType =
      typeof thumbnailType === 'string' && thumbnailType.startsWith('image/')
        ? thumbnailType
        : 'image/jpeg';
    return {
      id,
      nodeId,
      createdAt,
      blob: new Blob([files[file] as Uint8Array<ArrayBuffer>], { type: blobType }),
      thumbnail: new Blob([files[thumbnailFile] as Uint8Array<ArrayBuffer>], { type: thumbType }),
    };
  });
}

/** Reads and fully validates a backup zip. Throws {@link BackupError} with a Danish message. */
export async function readBackup(file: Blob): Promise<ValidatedBackup> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new BackupError('Filen er ikke en gyldig zip-fil.');
  }
  const json = files['data.json'];
  if (!json) {
    throw new BackupError('Filen mangler data.json – er det en backup fra «Hvor er den?»?');
  }
  let data: unknown;
  try {
    data = JSON.parse(strFromU8(json));
  } catch {
    throw new BackupError('data.json i backuppen kan ikke læses.');
  }
  if (!isRecord(data)) throw new BackupError('data.json i backuppen er ugyldig.');
  if (data['app'] !== undefined && data['app'] !== BACKUP_APP_ID) {
    throw new BackupError('Filen er ikke en backup fra «Hvor er den?».');
  }
  const schemaVersion = data['schemaVersion'];
  if (!Number.isInteger(schemaVersion) || (schemaVersion as number) < 1) {
    throw new BackupError('Backuppen mangler et gyldigt schemaVersion.');
  }
  if ((schemaVersion as number) > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('Backuppen er lavet med en nyere version af appen. Opdatér appen først.');
  }
  if (!Array.isArray(data['nodes'])) throw new BackupError('Listen over ting mangler.');

  const nodes = data['nodes'].map(validateNode);
  validateTree(nodes);
  const photos = validatePhotos(data['photos'], new Set(nodes.map((n) => n.id)), files);
  const exportedAt = new Date(typeof data['exportedAt'] === 'string' ? data['exportedAt'] : NaN);

  return {
    schemaVersion: schemaVersion as number,
    exportedAt: Number.isNaN(exportedAt.getTime()) ? new Date() : exportedAt,
    nodes,
    photos,
  };
}

/** Replaces everything in the database with the backup, in one transaction. */
export async function restoreBackup(db: AppDb, backup: ValidatedBackup): Promise<void> {
  await db.transaction('rw', db.nodes, db.photos, async () => {
    await db.nodes.clear();
    await db.photos.clear();
    await db.nodes.bulkAdd(backup.nodes);
    await db.photos.bulkAdd(backup.photos);
  });
}
