import { openDB, type DBSchema } from "idb";
import type {
  BookRecord,
  BookSummary,
  ReaderSettings,
  DictionaryEntry,
  PackManifest,
  CacheRecord,
  Source,
} from "./types";
import { defaultSettings } from "./types";
import { lookupKeys, rootKey, normalize } from "./arabic";
import { isNative, nativeCall, fromBase64, toBase64, readJSON } from './platform';

interface ReaderDB extends DBSchema {
  books: { key: string; value: BookSummary };
  files: { key: string; value: Blob };
  settings: { key: string; value: ReaderSettings };
  entries: {
    key: string;
    value: DictionaryEntry;
    indexes: { keys: string; root: string };
  };
  packs: { key: string; value: PackManifest };
  analyses: { key: string; value: CacheRecord };
}
export const dbPromise = isNative ? null! : openDB<ReaderDB>("waraq-reader", 1, {
  upgrade(db) {
    db.createObjectStore("books", { keyPath: "id" });
    db.createObjectStore("files");
    db.createObjectStore("settings");
    const entries = db.createObjectStore("entries", { keyPath: "id" });
    entries.createIndex("keys", "keys", { multiEntry: true });
    entries.createIndex("root", "root");
    db.createObjectStore("packs", { keyPath: "id" });
    db.createObjectStore("analyses", { keyPath: "key" });
  },
});
export async function listBooks() {
  if (isNative) {
    const rows=await nativeCall<(Omit<BookSummary,'cover'> & {coverBase64?:string;coverType?:string})[]>('books');
    return rows.map(({coverBase64,coverType,...book})=>({...book,cover:coverBase64?new Blob([fromBase64(coverBase64)],{type:coverType}):undefined})).sort((a,b)=>(b.lastRead||b.addedAt)-(a.lastRead||a.addedAt));
  }
  return (await (await dbPromise).getAll("books")).sort(
    (a, b) => (b.lastRead || b.addedAt) - (a.lastRead || a.addedAt),
  );
}
export async function storeBook(book: BookRecord) {
  if (isNative) {
    const {data,cover,...metadata}=book;
    await nativeCall('storeBook',{metadata,data:toBase64(new Uint8Array(await data.arrayBuffer())),cover:cover?toBase64(new Uint8Array(await cover.arrayBuffer())):null,coverType:cover?.type || ''});
    return;
  }
  const { data, ...metadata } = book;
  const db = await dbPromise;
  const tx = db.transaction(["books", "files"], "readwrite");
  const existing = await tx.objectStore("books").get(book.id);
  await Promise.all([
    tx
      .objectStore("books")
      .put(
        existing
          ? {
              ...metadata,
              addedAt: existing.addedAt,
              lastRead: existing.lastRead,
              location: existing.location,
              progress: existing.progress,
              chapter: existing.chapter,
              bookmarks: existing.bookmarks,
              ...(existing.metadataEdited ? {title:existing.title,author:existing.author,metadataEdited:true} : {}),
            }
          : metadata,
      ),
    tx.objectStore("files").put(data, book.id),
    tx.done,
  ]);
}
export async function updateBook(id: string, updates: Partial<BookSummary>) {
  if (isNative) { await nativeCall('updateBook',{id,updates}); return; }
  const db = await dbPromise;
  const tx = db.transaction("books", "readwrite");
  const book = await tx.store.get(id);
  if (book) await tx.store.put({ ...book, ...updates });
  await tx.done;
}
export async function removeBook(id: string) {
  if (isNative) { await nativeCall('removeBook',{id}); return; }
  const tx = (await dbPromise).transaction(["books", "files"], "readwrite");
  await Promise.all([
    tx.objectStore("books").delete(id),
    tx.objectStore("files").delete(id),
    tx.done,
  ]);
}
export async function loadSettings() {
  if (isNative) return await nativeCall<ReaderSettings|null>('getSetting',{key:'reader'}) || defaultSettings;
  return (await (await dbPromise).get("settings", "reader")) || defaultSettings;
}
export async function saveSettings(settings: ReaderSettings) {
  if (isNative) {await nativeCall('setSetting',{key:'reader',value:settings});return;}
  await (await dbPromise).put("settings", settings, "reader");
}
export async function installedPacks() {
  if (isNative) return nativeCall<PackManifest[]>('packs');
  return (await dbPromise).getAll("packs");
}
export async function findEntries(
  word: string,
  root = false,
): Promise<DictionaryEntry[]> {
  if (isNative) {
    const records=await nativeCall<DictionaryEntry[]>('entries',{keys:lookupKeys(word),root:root?rootKey(word):null});
    const exact=records.filter(r=>normalize(r.word)===normalize(word));
    return !root && exact.length?exact:records;
  }
  const db = await dbPromise;
  const packs = await db.getAll("packs");
  const records = root
    ? await db.getAllFromIndex("entries", "root", rootKey(word))
    : (
        await Promise.all(
          lookupKeys(word).map((k) => db.getAllFromIndex("entries", "keys", k)),
        )
      ).flat();
  const available = records.filter(
    (r) =>
      (r.senses.length || r.formOf.length) &&
      packs.some((p) => p.id === r.source && p.version === r.version),
  );
  // Prefer the actual spelling. Hamza-folded search is a fallback, not an equality claim.
  const exact = available.filter((r) => normalize(r.word) === normalize(word));
  return [
    ...new Map(
      (!root && exact.length ? exact : available).map((r) => [r.id, r]),
    ).values(),
  ];
}
export async function fetchManifest(source: Source) {
  if (isNative) return readJSON<PackManifest>(`/dictionaries/${source}.json`);
  const response = await fetch(`/dictionaries/${source}.json`, {
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error("Dictionary pack is not available on this server yet.");
  return (await response.json()) as PackManifest;
}
export async function downloadPack(
  manifest: PackManifest,
  onProgress: (n: number) => void,
  signal: AbortSignal,
) {
  const db = await dbPromise;
  const current = await db.get("packs", manifest.id);
  if (current?.version === manifest.version) {
    onProgress(100);
    return;
  }
  let done = 0;
  for (const file of manifest.files) {
    signal.throwIfAborted();
    const response = await fetch(file.url, { signal });
    if (!response.ok)
      throw new Error(
        "Download interrupted. Your previous dictionary is still available.",
      );
    const bytes = await response.arrayBuffer();
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== file.sha256)
      throw new Error(
        "The dictionary download failed its integrity check. Please retry.",
      );
    const rows = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as DictionaryEntry[];
    const tx = db.transaction("entries", "readwrite");
    for (const row of rows) {
      row.version = manifest.version;
      row.source = manifest.id;
      row.id = `${manifest.id}:${manifest.version}:${row.entryId}`;
      row.keys = [...new Set(row.keys.flatMap(lookupKeys))];
      row.root = rootKey(row.root);
      void tx.store.put(row);
    }
    await tx.done;
    done += file.bytes;
    onProgress(Math.round((done / manifest.bytes) * 100));
  }
  signal.throwIfAborted();
  // Only activate after every chunk is verified and committed. Incomplete packs remain invisible.
  await db.put("packs", manifest);
  if (current && current.version !== manifest.version) {
    // Reclaim only the previously active version; keep another download's partial rows intact.
    const prefix = `${manifest.id}:${current.version}:`;
    const tx = db.transaction("entries", "readwrite");
    await tx.store.delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    await tx.done;
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("waraq-dictionaries"));
}
export async function deletePack(source: Source) {
  if (isNative) throw new Error('Dictionaries are included in this iPad project.');
  const db = await dbPromise;
  const tx = db.transaction(["entries", "packs"], "readwrite");
  await tx.objectStore("packs").delete(source);
  await tx.objectStore("entries").delete(IDBKeyRange.bound(`${source}:`, `${source}:\uffff`));
  await tx.done;
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("waraq-dictionaries"));
}
export async function exportProgress() {
  const books = await listBooks();
  const settings = await loadSettings();
  return {
    format: "waraq-progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    books: books.map(
      ({ id, title, author, metadataEdited, location, progress, bookmarks, chapter }) => ({
        id,
        title,
        author,
        metadataEdited,
        location,
        progress,
        bookmarks,
        chapter,
      }),
    ),
  };
}
export async function importProgress(value: unknown) {
  const data = value as {
    format?: string;
    version?: number;
    books?: BookSummary[];
  };
  if (
    data?.format !== "waraq-progress" ||
    data.version !== 1 ||
    !Array.isArray(data.books)
  )
    throw new Error("This is not a Waraq progress backup.");
  const existing = await listBooks();
  let count = 0;
  for (const item of data.books) {
    if (
      existing.some((b) => b.id === item.id) &&
      typeof item.location === "string" &&
      Array.isArray(item.bookmarks)
    ) {
      const bookmarks = item.bookmarks
        .filter(
          (b) => b && typeof b.cfi === "string" && typeof b.label === "string",
        )
        .slice(0, 1000);
      await updateBook(item.id, {
        location: item.location,
        progress: Math.max(0, Math.min(1, Number(item.progress) || 0)),
        bookmarks,
      });
      if (item.metadataEdited && typeof item.title==='string' && item.title.trim() && typeof item.author==='string')
        await updateBook(item.id,{title:item.title.slice(0,250),author:item.author.slice(0,250),metadataEdited:true});
      count++;
    }
  }
  return count;
}

export async function loadBookData(id: string): Promise<Blob|undefined> {
  if (isNative) return new Blob([fromBase64(await nativeCall<string>('bookData',{id}))],{type:'application/epub+zip'});
  return (await dbPromise).get('files',id);
}
export async function getAnalysis(key: string): Promise<CacheRecord|undefined> {
  if (isNative) return (await nativeCall<CacheRecord|null>('getSetting',{key:'analysis:'+key})) || undefined;
  return (await dbPromise).get('analyses',key);
}
export async function saveAnalysis(record: CacheRecord) {
  if (isNative) {await nativeCall('setSetting',{key:'analysis:'+record.key,value:record});return;}
  await (await dbPromise).put('analyses',record);
}
