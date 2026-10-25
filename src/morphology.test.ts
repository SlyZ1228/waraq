import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LocalMorphology } from './morphology';
import type { AnalysisResult } from './types';

describe('offline morphology against the canonical Python analyzer', () => {
  it('rejects multiword and non-Arabic requests', async () => {
    const engine = new LocalMorphology(async () => { throw new Error('should not load'); });
    await expect(engine.analyze('hello')).rejects.toThrow('one Arabic word');
    await expect(engine.analyze('كتاب كبير')).rejects.toThrow('one Arabic word');
  });
  it.skipIf(!existsSync('.data/morphology-parity.json'))('matches every returned field, candidate order and total across the reference corpus', async () => {
    const engine = new LocalMorphology(async path => JSON.parse(readFileSync(`public${path}`,'utf8')));
    const fixtures = JSON.parse(readFileSync('.data/morphology-parity.json','utf8')) as {word:string;expected:AnalysisResult}[];
    const mismatches: string[] = [];
    for (const {word,expected} of fixtures) {
      const actual = await engine.analyze(word);
      try { expect({...actual,engineVersion:expected.engineVersion}).toEqual(expected); }
      catch { mismatches.push(word); if (mismatches.length === 1) console.log('FIRST DIFFERENCE', JSON.stringify({word,actual:actual.analyses[0],expected:expected.analyses[0],total:[actual.total,expected.total]})); }
    }
    expect(mismatches, `${mismatches.length} words differ: ${mismatches.slice(0,20).join(', ')}`).toEqual([]);
  },60000);
});
