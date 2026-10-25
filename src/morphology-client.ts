import MorphWorker from './morphology.worker?worker&inline';
import { loadMorphologyJSON } from './morphology-pack';
import { LocalMorphology } from './morphology';
import type { AnalysisResult } from './types';
let worker: Worker | undefined;
let sequence=0;
const requests = new Map<number,{resolve:(result:AnalysisResult)=>void;reject:(error:Error)=>void}>();
const fallback = new LocalMorphology(loadMorphologyJSON);
let failedWorker=false;
function getWorker() {
  if (worker) return worker;
  worker = new MorphWorker();
  worker.onmessage = async event => {
    const msg=event.data;
    if (msg.type === 'resource') {
      try { worker?.postMessage({...msg,value:await loadMorphologyJSON(msg.path)}); }
      catch(e) { worker?.postMessage({...msg,error:e instanceof Error?e.message:String(e)}); }
    } else if (msg.type === 'result') {
      const request=requests.get(msg.id); requests.delete(msg.id);
      if (msg.error) request?.reject(new Error(msg.error)); else request?.resolve(msg.result);
    }
  };
  worker.onerror = () => {
    failedWorker=true; worker?.terminate(); worker=undefined;
    requests.forEach(r=>r.reject(new Error('Local worker unavailable; please retry this word.'))); requests.clear();
  };
  return worker;
}
export async function analyzeLocal(word: string, signal: AbortSignal): Promise<AnalysisResult> {
  signal.throwIfAborted();
  if (failedWorker) { const result=await fallback.analyze(word); signal.throwIfAborted(); return result; }
  let target: Worker;
  try { target=getWorker(); } catch { failedWorker=true; return analyzeLocal(word,signal); }
  try { return await new Promise<AnalysisResult>((resolve,reject) => {
    const id=++sequence;
    const abort=()=>{ requests.delete(id); reject(signal.reason || new DOMException('Cancelled','AbortError')); };
    signal.addEventListener('abort',abort,{once:true});
    requests.set(id,{resolve:r=>{signal.removeEventListener('abort',abort);resolve(r);},reject:e=>{signal.removeEventListener('abort',abort);reject(e);}});
    target.postMessage({type:'analyze',id,word});
  }); } catch (error) {
    // Some WKWebView configurations cannot launch blob workers on a custom scheme.
    // Keep the same local analyzer available without asking the reader to retry.
    if (!failedWorker || signal.aborted) throw error;
    const result=await fallback.analyze(word); signal.throwIfAborted(); return result;
  }
}
