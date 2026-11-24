import { InjectionToken } from '@angular/core';
import Dexie, { EntityTable } from 'dexie';
import { ItemNode, MetaEntry, Photo } from './models';

export const DB_NAME = 'hvor-er-den';

/**
 * IndexedDB schema (via Dexie). Only fields that are queried in IndexedDB are indexed; the
 * app keeps all nodes in memory, so most lookups never touch the database.
 */
export class AppDb extends Dexie {
  declare readonly nodes: EntityTable<ItemNode, 'id'>;
  declare readonly photos: EntityTable<Photo, 'id'>;
  declare readonly meta: EntityTable<MetaEntry, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      nodes: 'id, parentId',
      photos: 'id, nodeId, [nodeId+createdAt]',
      meta: 'key',
    });
  }
}

export const APP_DB = new InjectionToken<AppDb>('APP_DB', {
  providedIn: 'root',
  factory: () => new AppDb(),
});
