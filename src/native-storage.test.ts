import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./platform', async importOriginal => ({
  ...await importOriginal<typeof import('./platform')>(), isNative:true, nativeCall:vi.fn(),
}));
import { nativeCall, toBase64 } from './platform';
import { dbPromise, storeBook, listBooks, loadBookData, findEntries, getAnalysis, saveAnalysis } from './storage';
import type { BookRecord, CacheRecord } from './types';
const bridge=vi.mocked(nativeCall);
beforeEach(()=>bridge.mockReset());
describe('Playgrounds storage bridge contract',()=>{
  it('uses native files without opening IndexedDB, and preserves binary EPUB and cover bytes',async()=>{
    expect(dbPromise).toBeNull();
    const bytes=new Uint8Array([0,255,128,80,75,3,4]);
    const record:BookRecord={id:'a'.repeat(64),title:'كِتاب',author:'Author',addedAt:1,lastRead:0,progress:0,bookmarks:[],size:bytes.length,data:new Blob([bytes]),cover:new Blob([bytes],{type:'image/png'})};
    await storeBook(record);
    const call=bridge.mock.calls[0];
    expect(call[0]).toBe('storeBook');
    expect(call[1]?.data).toBe(toBase64(bytes));
    expect(call[1]?.cover).toBe(toBase64(bytes));
    expect(call[1]?.metadata).not.toHaveProperty('data');
    bridge.mockResolvedValueOnce(toBase64(bytes));
    expect(new Uint8Array(await (await loadBookData(record.id))!.arrayBuffer())).toEqual(bytes);
    const {data,cover,...metadata}=record;
    void data;void cover;
    bridge.mockResolvedValueOnce([{...metadata,coverBase64:toBase64(bytes),coverType:'image/png'}]);
    const books=await listBooks();
    expect(books[0].title).toBe('كِتاب');
    expect(books[0].cover?.type).toBe('image/png');
    expect(new Uint8Array(await books[0].cover!.arrayBuffer())).toEqual(bytes);
  });
  it('passes normalized word/root keys and prefers exact spelling over folded hamza',async()=>{
    bridge.mockResolvedValueOnce([{word:'إِبْرَة',id:'exact'},{word:'ابرة',id:'folded'}]);
    expect((await findEntries('إِبْرَة')).map(x=>x.id)).toEqual(['exact']);
    expect(bridge).toHaveBeenLastCalledWith('entries',{keys:['إبرة','ابرة'],root:null});
    bridge.mockResolvedValueOnce([]);
    await findEntries('ك ت ب',true);
    expect(bridge.mock.lastCall?.[1]?.root).toBe('كتب');
  });
  it('saves and reloads analysis through the native settings store',async()=>{
    const record={key:'engine:كَتَبَ',result:{surface:'كَتَبَ'}} as CacheRecord;
    await saveAnalysis(record);
    expect(bridge).toHaveBeenLastCalledWith('setSetting',{key:'analysis:engine:كَتَبَ',value:record});
    bridge.mockResolvedValueOnce(record);
    expect(await getAnalysis(record.key)).toEqual(record);
    bridge.mockResolvedValueOnce(null);
    expect(await getAnalysis('missing')).toBeUndefined();
  });
});
