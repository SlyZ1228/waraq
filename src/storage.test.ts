import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  dbPromise,
  storeBook,
  updateBook,
  listBooks,
  downloadPack,
  findEntries,
  importProgress,
  exportProgress,
} from "./storage";
import { analyze } from "./lookup";
import { analyzeLocal } from './morphology-client';
vi.mock('./morphology-client',()=>({analyzeLocal:vi.fn()}));
import { normalize, rootKey, verbForm } from "./arabic";
import type { BookRecord, PackManifest, AnalysisResult } from "./types";
const sample: BookRecord = {
  id: "book1",
  title: "كتاب",
  author: "Author",
  addedAt: 1,
  lastRead: 0,
  data: new Blob(["test"]),
  size: 4,
  progress: 0,
  bookmarks: [],
};
beforeEach(async () => {
  const db = await dbPromise;
  for (const name of db.objectStoreNames) await db.clear(name);
});
afterEach(() => {vi.unstubAllGlobals();vi.mocked(analyzeLocal).mockReset();});
describe("library persistence", () => {
  it("preserves reading position and bookmarks when the same EPUB is imported again", async () => {
    await storeBook(sample);
    await updateBook(sample.id, {
      location: "epubcfi(/6/2!/4/2:1)",
      progress: 0.42,
      lastRead: 50,
      bookmarks: [{ cfi: "epubcfi(/6/2)", label: "Chapter" }],
      title: 'My displayed title',author:'My author',metadataEdited:true,
    });
    await storeBook({ ...sample, addedAt: 100 });
    const [book] = await listBooks();
    expect(book.progress).toBe(0.42);
    expect(book.lastRead).toBe(50);
    expect(book.addedAt).toBe(1);
    expect(book.bookmarks).toHaveLength(1);
    expect(book.title).toBe('My displayed title');
    expect(book.author).toBe('My author');
  });
  it("restores backups only to matching original EPUB hashes", async () => {
    await storeBook(sample);
    await updateBook(sample.id, { location: "epubcfi(/6/4)", progress: 0.6 });
    const backup = await exportProgress();
    await updateBook(sample.id, { progress: 0 });
    backup.books.push({ ...backup.books[0], id: "unimported" });
    expect(await importProgress(backup)).toBe(1);
    expect((await listBooks())[0].progress).toBe(0.6);
    await expect(importProgress({ format: "random" })).rejects.toThrow(
      "backup",
    );
  });
});
describe("offline dictionary activation", () => {
  const entry = {
    entryId: "1",
    word: "كِتَاب",
    keys: ["كتاب"],
    root: "ك ت ب",
    pos: "noun",
    senses: ["book"],
    formOf: [],
    tags: [],
    url: "https://en.wiktionary.org/wiki/كتاب",
  };
  async function pack() {
    const raw = JSON.stringify([entry]);
    const bytes = new TextEncoder().encode(raw);
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const manifest: PackManifest = {
      id: "kaikki",
      title: "Test",
      version: "v1",
      count: 1,
      bytes: bytes.length,
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: "https://kaikki.org",
      files: [{ url: "/chunk", bytes: bytes.length, sha256: hash }],
    };
    return { raw, manifest };
  }
  it("indexes vowels and roots and only exposes a fully installed pack", async () => {
    const { raw, manifest } = await pack();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(raw)));
    await downloadPack(manifest, () => {}, new AbortController().signal);
    expect((await findEntries("كِتابٌ"))[0].senses).toEqual(["book"]);
    expect(await findEntries("ك.ت.ب", true)).toHaveLength(1);
  });
  it("rejects corrupt data and never activates a partially downloaded pack", async () => {
    const { raw, manifest } = await pack();
    manifest.files.push({ url: "/bad", sha256: "bad", bytes: 3 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(raw))
        .mockResolvedValueOnce(new Response("bad")),
    );
    await expect(
      downloadPack(manifest, () => {}, new AbortController().signal),
    ).rejects.toThrow("integrity");
    expect(await findEntries("كتاب")).toEqual([]);
    expect(await (await dbPromise).get("packs", "kaikki")).toBeUndefined();
  });
});
describe("analysis caching and Arabic normalization", () => {
  const result: AnalysisResult = {
    surface: "كتب",
    engineVersion: "test",
    analyses: [],
    total: 0,
    ranking: "lexical",
    truncated: false,
  };
  it("serves a previously viewed word offline without another network call", async () => {
    const local = vi.mocked(analyzeLocal).mockResolvedValueOnce(result);
    expect((await analyze("كتب", new AbortController().signal)).cached).toBe(
      false,
    );
    local.mockRejectedValue(new TypeError("offline"));
    expect((await analyze("كتب", new AbortController().signal)).cached).toBe(
      true,
    );
    expect(local).toHaveBeenCalledTimes(1);
    await expect(
      analyze("مدرسة", new AbortController().signal),
    ).rejects.toThrow("offline");
  });
  it("keeps differently supplied harakat as different analysis requests", async () => {
    const local = vi.mocked(analyzeLocal).mockResolvedValue(result);
    await analyze("كتب", new AbortController().signal);
    await analyze("كَتَبَ", new AbortController().signal);
    expect(local).toHaveBeenCalledTimes(2);
  });
  it("normalizes lookup keys without inventing roots or verb patterns", () => {
    expect(normalize("ٱِسْتَكْشَف")).toBe("استكشف");
    expect(rootKey("ك ش ف")).toBe("كشف");
    expect(verbForm("ٱِسْتَ1ْ2َ3")).toBe("Form X");
    expect(verbForm("unknown")).toBeUndefined();
  });
});
