export type Source = "kaikki" | "lane";
export type Theme = "paper" | "sepia" | "sage" | "dusk";
export interface ReaderSettings {
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  lookupMode: boolean;
}
export const defaultSettings: ReaderSettings = {
  theme: "paper",
  fontSize: 26,
  lineHeight: 2,
  lookupMode: true,
};
export interface BookRecord {
  id: string;
  title: string;
  author: string;
  addedAt: number;
  lastRead: number;
  cover?: Blob;
  data: Blob;
  size: number;
  location?: string;
  progress: number;
  chapter?: string;
  bookmarks: { cfi: string; label: string }[];
  metadataEdited?: boolean;
}
export type BookSummary = Omit<BookRecord, "data">;
export interface DictionaryEntry {
  id: string;
  entryId: string;
  source: Source;
  version: string;
  word: string;
  keys: string[];
  root: string;
  pos: string;
  senses: string[];
  formOf: string[];
  tags: string[];
  url: string;
  page?: number;
  node?: string;
  laneBlocks?: {label: string; runs: {text: string; emphasis: boolean}[]}[];
}
export interface PackManifest {
  id: Source;
  title: string;
  version: string;
  count: number;
  bytes: number;
  files: { url: string; bytes: number; sha256: string }[];
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}
export interface Analysis {
  id: string;
  diac: string;
  lemma: string;
  root: string;
  pattern: string;
  gloss: string;
  features: Record<string, string>;
  source: string;
}
export interface AnalysisResult {
  surface: string;
  engineVersion: string;
  analyses: Analysis[];
  total: number;
  ranking: string;
  truncated: boolean;
}
export interface Lookup {
  word: string;
  kind: "word" | "root";
}
export interface CacheRecord {
  key: string;
  result: AnalysisResult;
  storedAt: number;
}
