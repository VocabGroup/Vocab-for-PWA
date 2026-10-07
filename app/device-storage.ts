import { emptyState, parseStoredState, STORAGE_KEY } from "./storage";
import type { VocabState } from "./types";

type StorageBackend = "indexeddb" | "localstorage";
const DB_NAME = "vocab-device-data";
const STORE = "snapshots";
let database: Promise<IDBDatabase> | undefined;
let pendingWrite: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => { database = undefined; reject(request.error ?? new Error("無法開啟本機資料庫")); };
    request.onblocked = () => { database = undefined; reject(new Error("請關閉其他 Vocab 分頁，再重新開啟")); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  });
  return database;
}

async function readSnapshot(): Promise<string | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get("state");
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? new Error("讀取本機資料失敗"));
    tx.onerror = () => reject(tx.error ?? new Error("讀取本機資料失敗"));
  });
}

async function writeSnapshot(snapshot: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snapshot, "state");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("儲存本機資料失敗"));
    tx.onerror = () => reject(tx.error ?? new Error("儲存本機資料失敗"));
  });
}

export async function loadDeviceState(): Promise<{ state: VocabState; backend: StorageBackend }> {
  if (typeof indexedDB === "undefined") {
    const legacy = localStorage.getItem(STORAGE_KEY);
    return { state: legacy ? parseStoredState(JSON.parse(legacy)) : emptyState, backend: "localstorage" };
  }
  const snapshot = await readSnapshot();
  if (snapshot !== undefined) return { state: parseStoredState(JSON.parse(snapshot)), backend: "indexeddb" };
  const legacy = localStorage.getItem(STORAGE_KEY);
  const state = legacy ? parseStoredState(JSON.parse(legacy)) : emptyState;
  if (legacy) {
    // Never delete old data before the migration transaction commits.
    await writeSnapshot(JSON.stringify(state));
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Migration is already durable. */ }
  }
  return { state, backend: "indexeddb" };
}

export function saveDeviceState(state: VocabState, backend: StorageBackend): Promise<void> {
  const snapshot = JSON.stringify(state);
  pendingWrite = pendingWrite.catch(() => undefined).then(() => {
    if (backend === "indexeddb") return writeSnapshot(snapshot);
    localStorage.setItem(STORAGE_KEY, snapshot);
  });
  return pendingWrite;
}

export function flushStateWrites(): Promise<void> { return pendingWrite; }

export function clearLearningSessions() {
  // Keep unrelated browser data and PWA installation preferences intact.
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  keys.filter((key): key is string => Boolean(key?.startsWith("vocab-study-session-") || key?.startsWith("vocab-reminder-")))
    .forEach(key => localStorage.removeItem(key));
}
