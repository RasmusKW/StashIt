import { TestBed } from '@angular/core/testing';
import { APP_DB, AppDb } from '../app/core/db';

let dbCounter = 0;

/** Configures TestBed with a fresh, isolated IndexedDB and returns it. */
export function provideTestDb(): AppDb {
  const db = new AppDb(`test-db-${Date.now()}-${++dbCounter}`);
  TestBed.configureTestingModule({ providers: [{ provide: APP_DB, useValue: db }] });
  return db;
}

/** A tiny fake "image" blob with recognizable bytes. */
export function fakeImage(bytes: number[], type = 'image/webp'): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

export async function blobBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
