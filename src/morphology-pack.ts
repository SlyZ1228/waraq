import { isNative, readBytes, readJSON, sha256 } from './platform';
import { ENGINE } from './morphology';
export interface MorphManifest { version: string; bytes: number; files: {url:string;bytes:number;sha256:string}[] }
const CACHE = 'waraq-morphology-v1';
const MARKER = '/morphology/installed.json';
export async function morphologyInstalled(): Promise<boolean> {
  if (isNative) return true;
  const response = await (await caches.open(CACHE)).match(MARKER);
  return !!response && (await response.json()).version === ENGINE;
}
export async function morphologyManifest(): Promise<MorphManifest> {
  if (!isNative) {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(MARKER);
    if (saved && (await saved.clone().json()).version === ENGINE) return saved.json();
  }
  return readJSON<MorphManifest>('/morphology/manifest.json');
}
export async function installMorphology(onProgress: (n:number)=>void, signal: AbortSignal) {
  const manifest = await readJSON<MorphManifest>('/morphology/manifest.json');
  if (manifest.version !== ENGINE) throw new Error('Reload Waraq before installing this morphology pack.');
  const cache = await caches.open(CACHE);
  let done=0;
  for (const file of manifest.files) {
    signal.throwIfAborted();
    let response = await cache.match(file.url);
    if (!response) {
      response = await fetch(file.url,{signal});
      if (!response.ok) throw new Error('The offline pack could not be downloaded. Try again to resume.');
      const bytes = await response.arrayBuffer();
      if (await sha256(bytes) !== file.sha256) throw new Error('Morphology download failed its integrity check.');
      await cache.put(file.url,new Response(bytes,{headers:{'Content-Type':'application/json'}}));
    }
    done += file.bytes; onProgress(Math.round(done/manifest.bytes*100));
  }
  signal.throwIfAborted();
  await cache.put(MARKER, new Response(JSON.stringify(manifest)));
}
let manifest: Promise<MorphManifest> | undefined;
export async function loadMorphologyJSON(path: string): Promise<unknown> {
  if (isNative) return readJSON(path);
  const cache = await caches.open(CACHE);
  const saved = await cache.match(path);
  if (saved) return saved.json();
  manifest ??= morphologyManifest().catch(e => {manifest=undefined;throw e;});
  const entry = (await manifest).files.find(x=>x.url === path);
  if (!entry) throw new Error('The morphology data does not match this reader version.');
  let bytes: ArrayBuffer;
  try { bytes = await readBytes(path); }
  catch { throw new Error('Install the offline morphology pack in Settings to analyze new words without a connection.'); }
  if (await sha256(bytes) !== entry.sha256) throw new Error('Morphology data failed its integrity check.');
  await cache.put(path,new Response(bytes,{headers:{'Content-Type':'application/json'}}));
  return JSON.parse(new TextDecoder().decode(bytes));
}
