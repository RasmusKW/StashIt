import { Injectable, inject, signal } from '@angular/core';
import { CrossTabSync } from './cross-tab-sync';
import { APP_DB } from './db';
import { CompressedPhoto, compressImage } from './image-compress';
import { Photo, newId } from './models';

/**
 * Keeps an in-memory index of which photos belong to which node (without reading the blobs)
 * and hands out object URLs for thumbnails and full-size images.
 */
@Injectable({ providedIn: 'root' })
export class PhotoStore {
  private readonly db = inject(APP_DB);
  private readonly sync = inject(CrossTabSync);

  /** nodeId → photo ids, oldest first. */
  private readonly byNode = new Map<string, string[]>();
  private readonly nodeOfPhoto = new Map<string, string>();
  private readonly createdAtOf = new Map<string, number>();
  private readonly thumbUrls = new Map<string, Promise<string>>();
  private readonly _revision = signal(0);

  /** Increments on every change; read it to make computeds/effects reactive. */
  readonly revision = this._revision.asReadonly();

  async init(): Promise<void> {
    // Index-only reads: no blobs are loaded here.
    const collection = this.db.photos.orderBy('[nodeId+createdAt]');
    const [keys, ids] = await Promise.all([collection.keys(), collection.primaryKeys()]);
    this.byNode.clear();
    this.nodeOfPhoto.clear();
    this.createdAtOf.clear();
    keys.forEach((key, i) => {
      const [nodeId, createdAt] = key as unknown as [string, number];
      this.indexAdd(nodeId, ids[i] as string, createdAt);
    });
    this.bump(false);
  }

  /** Photo ids of a node, oldest first (reactive). */
  photoIds(nodeId: string): readonly string[] {
    this._revision();
    return this.byNode.get(nodeId) ?? [];
  }

  /** First photo of a node, used as its thumbnail (reactive). */
  firstPhotoId(nodeId: string): string | undefined {
    return this.photoIds(nodeId)[0];
  }

  hasPhotos(nodeId: string): boolean {
    return this.photoIds(nodeId).length > 0;
  }

  /** Total number of photos (reactive). */
  count(): number {
    this._revision();
    return this.nodeOfPhoto.size;
  }

  /** Compresses and stores an image file for a node. */
  async addFile(nodeId: string, file: Blob): Promise<Photo> {
    return this.addCompressed(nodeId, await compressImage(file));
  }

  async addCompressed(nodeId: string, compressed: CompressedPhoto): Promise<Photo> {
    const photo: Photo = {
      id: newId(),
      nodeId,
      blob: compressed.blob,
      thumbnail: compressed.thumbnail,
      createdAt: Date.now(),
    };
    await this.db.photos.add(photo);
    this.indexAdd(nodeId, photo.id, photo.createdAt);
    this.bump();
    return photo;
  }

  /**
   * Deletes a photo and returns an in-memory copy (bytes included) so it can be restored
   * with {@link restore} if the user taps "Fortryd".
   */
  async remove(photoId: string): Promise<Photo | undefined> {
    const photo = await this.db.photos.get(photoId);
    if (!photo) return undefined;
    const copy: Photo = {
      ...photo,
      blob: new Blob([await photo.blob.arrayBuffer()], { type: photo.blob.type }),
      thumbnail: new Blob([await photo.thumbnail.arrayBuffer()], { type: photo.thumbnail.type }),
    };
    await this.db.photos.delete(photoId);
    this.indexRemove(photoId);
    this.bump();
    return copy;
  }

  async restore(photo: Photo): Promise<void> {
    await this.db.photos.put(photo);
    this.indexAdd(photo.nodeId, photo.id, photo.createdAt);
    this.bump();
  }

  /** Permanently deletes all photos of the given nodes. */
  async deleteForNodes(nodeIds: readonly string[]): Promise<void> {
    if (nodeIds.length === 0) return;
    await this.db.photos
      .where('nodeId')
      .anyOf([...nodeIds])
      .delete();
    for (const nodeId of nodeIds) {
      for (const photoId of [...(this.byNode.get(nodeId) ?? [])]) this.indexRemove(photoId);
    }
    this.bump();
  }

  /** Object URL of a photo's thumbnail (cached until the photo is deleted). */
  thumbnailUrl(photoId: string): Promise<string> {
    let url = this.thumbUrls.get(photoId);
    if (!url) {
      url = this.db.photos.get(photoId).then((photo) => {
        if (!photo) throw new Error(`Photo ${photoId} not found`);
        return URL.createObjectURL(photo.thumbnail);
      });
      url.catch(() => this.thumbUrls.delete(photoId));
      this.thumbUrls.set(photoId, url);
    }
    return url;
  }

  /** Object URL of the full-size photo. The caller must revoke it when done. */
  async fullUrl(photoId: string): Promise<string | undefined> {
    const photo = await this.db.photos.get(photoId);
    return photo ? URL.createObjectURL(photo.blob) : undefined;
  }

  private indexAdd(nodeId: string, photoId: string, createdAt: number): void {
    this.nodeOfPhoto.set(photoId, nodeId);
    this.createdAtOf.set(photoId, createdAt);
    const list = (this.byNode.get(nodeId) ?? []).filter((id) => id !== photoId);
    list.push(photoId);
    list.sort((a, b) => (this.createdAtOf.get(a) ?? 0) - (this.createdAtOf.get(b) ?? 0));
    this.byNode.set(nodeId, list);
  }

  private indexRemove(photoId: string): void {
    const nodeId = this.nodeOfPhoto.get(photoId);
    this.nodeOfPhoto.delete(photoId);
    this.createdAtOf.delete(photoId);
    const url = this.thumbUrls.get(photoId);
    if (url) {
      this.thumbUrls.delete(photoId);
      url.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    }
    if (nodeId === undefined) return;
    const list = (this.byNode.get(nodeId) ?? []).filter((id) => id !== photoId);
    if (list.length) this.byNode.set(nodeId, list);
    else this.byNode.delete(nodeId);
  }

  /** `local` = a change made in this tab, which other tabs should hear about. */
  private bump(local = true): void {
    this._revision.update((v) => v + 1);
    if (local) this.sync.notify();
  }
}
