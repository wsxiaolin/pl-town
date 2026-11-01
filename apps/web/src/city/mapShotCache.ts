// Cross-session atlas cache for the paper map — space for time.
//
// Each atlas page costs one throwaway WebGL context + a full-scene render + a
// 1024² PNG encode, and every reload paid that again because shotData only
// lived in memory. This module persists the encoded dataURLs in IndexedDB so
// the next visit can paint the paper instantly, even before the boot preload's
// idle capture lands. Correctness is keyed on the caller's fingerprint (build
// identity + theme + scene census): a mismatched record is ignored, and any
// runtime invalidation clears the store, so a stale paper can never resurface.
//
// Every operation degrades silently — private-mode storage failures must cost
// the map nothing beyond the pre-cache behavior it already had.

export type AtlasRegionId = 'main' | 'north' | 'archipelago';

export type AtlasShotRecord = {
  fingerprint: string;
  shots: Partial<Record<AtlasRegionId, string>>;
};

export type AtlasShotStorage = {
  get(): Promise<AtlasShotRecord | null>;
  set(record: AtlasShotRecord): Promise<void>;
  delete(): Promise<void>;
};

export const ATLAS_REGION_IDS: readonly AtlasRegionId[] = ['main', 'north', 'archipelago'] as const;

const DB_NAME = 'minicity';
const DB_VERSION = 1;
const STORE_NAME = 'mapAtlasShots';
const RECORD_KEY = 'atlas';

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function defaultStorage(): AtlasShotStorage {
  return {
    async get(): Promise<AtlasShotRecord | null> {
      const db = await openDb();
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const record = await requestAsPromise(tx.objectStore(STORE_NAME).get(RECORD_KEY));
        return record ?? null;
      } finally {
        db.close();
      }
    },
    async set(record: AtlasShotRecord): Promise<void> {
      const db = await openDb();
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await requestAsPromise(tx.objectStore(STORE_NAME).put(record, RECORD_KEY));
      } finally {
        db.close();
      }
    },
    async delete(): Promise<void> {
      const db = await openDb();
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await requestAsPromise(tx.objectStore(STORE_NAME).delete(RECORD_KEY));
      } finally {
        db.close();
      }
    },
  };
}

export function createAtlasShotStore(storage: AtlasShotStorage = defaultStorage()) {
  return {
    /** Cached pages from the previous session, keyed by the CURRENT
     *  fingerprint. Empty when storage is unavailable, empty, or stale. */
    async load(fingerprint: string): Promise<Partial<Record<AtlasRegionId, string>>> {
      try {
        const record = await storage.get();
        if (!record || record.fingerprint !== fingerprint) return {};
        return record.shots ?? {};
      } catch {
        return {};
      }
    },
    /** Fire-and-forget persistence — callers never await this. */
    save(fingerprint: string, shots: Partial<Record<AtlasRegionId, string>>): void {
      void storage.set({ fingerprint, shots }).catch(() => { /* cache is best-effort */ });
    },
    /** Fire-and-forget invalidation — any scene/theme drift clears the store
     *  so the next session re-captures instead of hydrating a stale paper. */
    clear(): void {
      void storage.delete().catch(() => { /* cache is best-effort */ });
    },
  };
}
