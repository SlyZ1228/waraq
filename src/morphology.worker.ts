import { LocalMorphology } from './morphology';
const pending = new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
let sequence=0;
const engine = new LocalMorphology(path => new Promise((resolve,reject) => {
  const id=++sequence; pending.set(id,{resolve,reject}); self.postMessage({type:'resource',id,path});
}));
let queue = Promise.resolve();
self.onmessage = event => {
  const msg = event.data;
  if (msg.type === 'resource') {
    const item = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) item?.reject(new Error(msg.error)); else item?.resolve(msg.value);
  } else if (msg.type === 'analyze') {
    queue = queue.then(async () => {
      try { self.postMessage({type:'result',id:msg.id,result:await engine.analyze(msg.word)}); }
      catch(e) { self.postMessage({type:'result',id:msg.id,error:e instanceof Error ? e.message : String(e)}); }
    });
  }
};
