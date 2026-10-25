import { getAnalysis, saveAnalysis } from './storage';
import { analyzeLocal } from './morphology-client';
import { ENGINE } from './morphology';
import type { AnalysisResult } from './types';
export async function analyze(word: string, signal: AbortSignal): Promise<{result:AnalysisResult;cached:boolean}> {
  signal.throwIfAborted();
  const key=`${ENGINE}:${word.normalize('NFC')}`;
  const cached=await getAnalysis(key);
  signal.throwIfAborted();
  if (cached) return {result:cached.result,cached:true};
  const result=await analyzeLocal(word,signal);
  signal.throwIfAborted();
  await saveAnalysis({key,result,storedAt:Date.now()}).catch(()=>{});
  return {result,cached:false};
}
