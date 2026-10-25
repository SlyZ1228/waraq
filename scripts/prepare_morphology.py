"""Compile CAMeL Morph into bounded, lazily loaded tables. No surface-form enumeration."""
from pathlib import Path
import hashlib
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ['CAMELTOOLS_DATA'] = str(ROOT / '.data/camel-tools')
from camel_tools.morphology.database import MorphologyDB

FIELDS = ['diac','lex','root','pattern','pattern_abstract','gloss','pos','asp','vox','per','gen','num','cas','mod','stt','prc0','prc1','prc2','prc3','enc0','form_gen','form_num','pos_lex_logprob','source']
SHARDS = 128
VERSION = 'camel-tools-1.6.0-camel-morph-msa-1.0-local-v1'

def shard(word):
    value = 2166136261
    for ch in word:
        value = ((value ^ ord(ch)) * 16777619) & 0xffffffff
    return value % SHARDS

def main():
    db = MorphologyDB(str(ROOT / '.data/camel_morph_msa_v1.0.db'))
    out = ROOT / 'public/morphology' / VERSION
    out.mkdir(parents=True, exist_ok=True)
    cats = {}
    def cat(value):
        if value not in cats: cats[value] = len(cats)
        return cats[value]
    def rows(values):
        return [[cat(category), *[features.get(field) for field in FIELDS]] for category, features in values]
    def table(values):
        return {str(cat(key)): [cat(v) for v in sorted(items)] for key, items in values.items()}
    meta = {'fields': FIELDS, 'shards': SHARDS, 'version': VERSION,
            'maxPrefix': db.max_prefix_size, 'maxSuffix': db.max_suffix_size,
            'prefixes': {word: rows(items) for word, items in db.prefix_hash.items()},
            'suffixes': {word: rows(items) for word, items in db.suffix_hash.items()},
            'ab': table(db.prefix_stem_compat), 'bc': table(db.stem_suffix_compat), 'ac': table(db.prefix_suffix_compat),
            'computePattern': 'pattern' in db.compute_feats}
    chunks = [{} for _ in range(SHARDS)]
    for word, items in db.stem_hash.items():
        if word != 'NOAN': chunks[shard(word)][word] = rows(items)
    files = []
    for name, data in [('meta.json', meta), *[(f'{i:03}.json', chunk) for i, chunk in enumerate(chunks)]]:
        raw = json.dumps(data, ensure_ascii=False, separators=(',',':')).encode()
        (out / name).write_bytes(raw)
        files.append({'url': f'/morphology/{VERSION}/{name}', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    manifest = {'version': VERSION, 'title': 'CAMeL Morph MSA', 'bytes': sum(f['bytes'] for f in files), 'files': files,
                'source': 'https://github.com/CAMeL-Lab/camel_morph', 'license': 'CC BY 4.0',
                'sourceSha256': hashlib.sha256((ROOT / '.data/camel_morph_msa_v1.0.db').read_bytes()).hexdigest()}
    (out.parent / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Compiled {len(db.stem_hash):,} stem keys into {SHARDS} shards; {manifest["bytes"] / 1e6:.1f} MB total.')

if __name__ == '__main__': main()
