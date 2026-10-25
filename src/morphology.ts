// Adapted from CAMeL Tools 1.6.0 analyzer.py/utils.py (MIT, NYU Abu Dhabi).
// See licenses/CAMeL-Tools-MIT.txt. Only Arabic word analysis is supported here,
// matching server/app.py; no backoff, tokenization, or contextual disambiguation.
import type { Analysis, AnalysisResult } from './types';
export const ENGINE = 'camel-tools-1.6.0-camel-morph-msa-1.0-local-v1';
type Row = [number, ...(string | null)[]];
type Features = Record<string, string>;
export interface MorphMeta {
  fields: string[]; shards: number; maxPrefix: number; maxSuffix: number;
  prefixes: Record<string, Row[]>; suffixes: Record<string, Row[]>;
  ab: Record<string, number[]>; bc: Record<string, number[]>; ac: Record<string, number[]>;
  computePattern: boolean; version: string;
}
const GRAMMAR = ['pos','asp','vox','per','gen','num','cas','mod','stt','prc0','prc1','prc2','prc3','enc0'];
const dediac = (s: string) => s.replace(/[\u064b-\u0652\u0670]/g, '');
const normalize = (s: string) => dediac(s).replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'');
export function morphShard(word: string, count = 128) {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619) >>> 0;
  return h % count;
}
function vowelGroups(s: string): [string, Set<string>][] {
  const groups: [string, Set<string>][] = [];
  for (const c of s.normalize('NFC')) {
    if (/\p{M}/u.test(c)) groups.at(-1)?.[1].add(c);
    else if (c !== 'ـ') groups.push([c, new Set()]);
  }
  return groups;
}
function compatible(surface: string, reading: string) {
  const a = vowelGroups(surface), b = vowelGroups(reading);
  if (!a.some(x => x[1].size)) return true;
  const fold = (s: string) => s.replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي');
  return a.length === b.length && a.every(([c,m],i) => fold(c) === fold(b[i][0]) && [...m].every(v => b[i][1].has(v)));
}
function rewriteDiac(s: string) {
  return s.replace(/#\+*([تثدذرزسشصضطظلن])/g,'$1ّ').replace(/#\+*/g,'')
    .replace(/ا\+?َ([ةت])/g,'ا$1').replace(/ٱ/g,'ا').replace(/\+/g,'').replace(/ّ+/g,'ّ');
}
function merge(p: Features, s: Features, z: Features, computePattern: boolean) {
  const out = { ...s };
  for (const k of Object.keys(s)) {
    if (z[k] && z[k] !== '-') out[k] = z[k];
    if (p[k] && p[k] !== '-') out[k] = p[k];
  }
  out.gloss = [p.gloss,s.gloss,z.gloss].filter(Boolean).join('+');
  out.diac = rewriteDiac([p.diac,s.diac,z.diac].filter(Boolean).join('+'));
  out.pattern = [p.pattern,s.pattern,z.pattern].filter(Boolean).join('+');
  if (out.gen === '-' && out.form_gen) out.gen = out.form_gen;
  if (out.num === '-' && out.form_num) out.num = out.form_num;
  if (computePattern) out.pattern = ((p.diac || '') + (s.pattern ?? s.diac ?? '') + (z.diac || '')).replace(/#\+*/g,'');
  return out;
}
export class LocalMorphology {
  private meta?: MorphMeta;
  private chunks = new Map<number, Record<string, Row[]>>();
  constructor(private load: (path: string) => Promise<unknown>) {}
  private decode(row: Row): Features {
    const out: Features = {};
    this.meta!.fields.forEach((k,i) => { if (row[i+1] != null) out[k] = String(row[i+1]); });
    return out;
  }
  async analyze(surface: string): Promise<AnalysisResult> {
    surface = surface.trim();
    if (!surface || surface.length > 80 || !/^[\u0621-\u063a\u0641-\u064a\u0671\u064b-\u065f\u0670\u0640]+$/.test(surface))
      throw new Error('Choose one Arabic word, without punctuation.');
    this.meta ??= await this.load(`/morphology/${ENGINE}/meta.json`) as MorphMeta;
    const m = this.meta;
    if (m.version !== ENGINE) throw new Error('The offline morphology pack needs updating.');
    const word = normalize(surface);
    const segments: [string, Row[], Row[]][] = [];
    for (let p = 0; p <= Math.min(m.maxPrefix,word.length-1); p++) {
      const prefixes = m.prefixes[word.slice(0,p)];
      if (!prefixes) continue;
      for (let s = Math.max(1,word.length-p-m.maxSuffix); s <= word.length-p; s++) {
        const suffixes = m.suffixes[word.slice(p+s)];
        if (suffixes) segments.push([word.slice(p,p+s),prefixes,suffixes]);
      }
    }
    const grouped = new Map<string, Analysis & {score: number}>();
    // Process shards sequentially and retain at most 12: database size never
    // becomes a requirement to hold the whole lexicon in JavaScript memory.
    for (const [stem, prefixes, suffixes] of segments) {
      const shard = morphShard(stem,m.shards);
      let chunk = this.chunks.get(shard);
      if (!chunk) chunk = await this.load(`/morphology/${ENGINE}/${String(shard).padStart(3,'0')}.json`) as Record<string, Row[]>;
      this.chunks.delete(shard); this.chunks.set(shard,chunk);
      if (this.chunks.size > 12) this.chunks.delete(this.chunks.keys().next().value!);
      for (const p of prefixes) for (const s of chunk[stem] || []) {
        if (!m.ab[p[0]]?.includes(s[0])) continue;
        for (const z of suffixes) {
          if (!m.bc[s[0]]?.includes(z[0]) || !m.ac[p[0]]?.includes(z[0])) continue;
          const a = merge(this.decode(p),this.decode(s),this.decode(z),m.computePattern);
          if (!compatible(surface,a.diac)) continue;
          const lemma = (a.lex || '').replace(/_[0-9]+$/,'');
          const key = JSON.stringify([a.diac,lemma,...GRAMMAR.map(k => a[k] || '')]);
          if (grouped.has(key)) continue;
          const features = Object.fromEntries(GRAMMAR.filter(k => a[k] != null && !['na','0','-'].includes(a[k])).map(k => [k,a[k]]));
          grouped.set(key,{id:'',diac:a.diac || surface,lemma,
            root: ['NOAN','na','None'].includes(a.root) ? '' : (a.root || '').replace(/\./g,' '),
            pattern:a.pattern_abstract || a.pattern || '',gloss:(a.gloss || '').replace(/_/g,' '),features,
            source:dediac(surface).replace(/ـ/g,'') !== dediac(a.diac) ? 'spvar' : a.source || 'lex',
            score:Number(a.pos_lex_logprob || -99)});
        }
      }
    }
    const cmp = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
    const mood = (a: Analysis) => ({i:0,u:1,s:2,j:3}[a.features.mod] || 0);
    const sorted = [...grouped.values()].sort((a,b) => b.score-a.score || Number(a.features.vox==='p')-Number(b.features.vox==='p') || mood(a)-mood(b) || cmp(a.lemma,b.lemma) || cmp(a.diac,b.diac));
    const analyses = sorted.slice(0,80).map(({score: _score,...a},i) => ({...a,id:String(i)}));
    return {surface,engineVersion:ENGINE,analyses,total:sorted.length,ranking:'lexical; not contextual',truncated:sorted.length>80};
  }
}
