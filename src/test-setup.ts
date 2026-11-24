/**
 * Global unit-test setup.
 *
 * - jsdom's Blob/File cannot be structured-cloned, so IndexedDB (fake-indexeddb)
 *   would silently turn stored photos into plain objects. Node's native Blob/File
 *   can be cloned, so we swap them in.
 * - fake-indexeddb provides a spec-compliant in-memory IndexedDB.
 */
import 'fake-indexeddb/auto';

interface NodeProcess {
  getBuiltinModule(id: string): { Blob: typeof Blob; File: typeof File };
}
const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
const buffer = nodeProcess.getBuiltinModule('node:buffer');
globalThis.Blob = buffer.Blob;
globalThis.File = buffer.File;
