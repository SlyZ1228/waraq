// The Playgrounds shell supplies a narrow, main-frame-only native bridge.
declare global {
  interface Window { webkit?: { messageHandlers?: { waraq?: { postMessage: (value: unknown) => Promise<unknown> } } } }
}
export const isNative = typeof window !== 'undefined' && !!window.webkit?.messageHandlers?.waraq;
export async function nativeCall<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const bridge = window.webkit?.messageHandlers?.waraq;
  if (!bridge) throw new Error('This feature is available in the iPad project.');
  return await bridge.postMessage({method,args}) as T;
}
export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i=0;i<bytes.length;i+=32768) text += String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(text);
}
export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}
export async function readBytes(path: string): Promise<ArrayBuffer> {
  if (path.startsWith('data:')) {
    const comma=path.indexOf(',');
    return path.slice(0,comma).endsWith(';base64') ? fromBase64(path.slice(comma+1)).buffer : new TextEncoder().encode(decodeURIComponent(path.slice(comma+1))).buffer;
  }
  if (isNative) {
    const url = new URL(path, location.href);
    if (url.protocol !== 'waraq:' || url.hostname !== 'app') throw new Error('Only bundled resources can be read.');
    return fromBase64(await nativeCall<string>('resource',{path:url.pathname})).buffer;
  }
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Resource unavailable (${response.status}).`);
  return response.arrayBuffer();
}
export async function readJSON<T>(path: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readBytes(path))) as T;
}
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (isNative) return nativeCall<string>('sha256',{data:toBase64(new Uint8Array(bytes))});
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
