"""Build versioned browser dictionary packs from public, attributed sources.

Uses a currently available Arabic-only Kaikki snapshot by default. --kaikki also
accepts the recommended full raw Wiktextract JSONL/JSONL.gz feed and filters ar.
Never imports quotations, audio, or images from Wiktionary.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import re
import shutil
import sqlite3
import sys
import unicodedata
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.data'
OUT = ROOT / 'public' / 'dictionaries'
CAMEL_URL = 'https://raw.githubusercontent.com/CAMeL-Lab/camel_morph/main/official_releases/lrec-coling2024_release/databases/camel-morph-msa/camel_morph_msa_v1.0.db'
LANE_URL = 'https://raw.githubusercontent.com/laneslexicon/LexiconDatabase/master/lexicon.sqlite.zip'
KAIKKI_URL = 'https://kaikki.org/dictionary/Arabic/kaikki.org-dictionary-Arabic.jsonl'
MARKS = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')

def normalize(value: str) -> str:
    return MARKS.sub('', unicodedata.normalize('NFKC', value)).strip()

def download(url: str, path: Path):
    if path.exists():
        return
    print(f'Downloading {path.name}', flush=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'WaraqReader/0.1 (personal dictionary build)'})
    partial = path.with_suffix(path.suffix + '.partial')
    with urllib.request.urlopen(req, timeout=120) as source, partial.open('wb') as dest:
        shutil.copyfileobj(source, dest, length=1024 * 1024)
    partial.replace(path)

def lane_text(xml: str) -> str:
    try:
        tree = ET.fromstring(xml)
        for item in tree.iter('ref'):
            if not item.text:
                item.text = item.get('target', '')
        text = ''.join(tree.itertext())
    except ET.ParseError:
        text = re.sub('<[^>]+>', ' ', xml)
    return re.sub(r'\s+', ' ', text).strip()

def lane_entries(path: Path):
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    for row in connection.execute('select id,word,root,xml,page,nodeid from entry order by id'):
        entry_id, word, root, xml, page, node = row
        if not word or not xml:
            continue
        yield {'entryId': str(entry_id), 'word': word, 'keys': [normalize(word)],
               'root': normalize(root or ''), 'pos': '', 'senses': [lane_text(xml)],
               'laneBlocks': lane_blocks(xml),
               'formOf': [], 'tags': ['classical'], 'page': page, 'node': node,
               'url': 'https://laneslexicon.github.io/'}
    connection.close()

def lane_blocks(xml: str):
    """Keep Lane's own sense boundaries and italic gloss emphasis, without paraphrasing."""
    try:
        tree = ET.fromstring(xml)
    except ET.ParseError:
        return []
    blocks = [{'label': '', 'runs': []}]
    def text(value, emphasis=False):
        if not value: return
        value = re.sub(r'\s+', ' ', value)
        runs = blocks[-1]['runs']
        if runs and runs[-1]['emphasis'] == emphasis:
            runs[-1]['text'] += value
        else:
            runs.append({'text': value, 'emphasis': emphasis})
    def walk(node, emphasis=False):
        if node.tag == 'sense':
            blocks.append({'label': (node.get('type','') + node.get('n','')), 'runs': []})
            return
        emphasis = emphasis or (node.tag == 'hi' and node.get('rend') == 'ital')
        text(node.text or (node.get('target','') if node.tag == 'ref' else ''), emphasis)
        for child in node:
            walk(child, emphasis)
            text(child.tail, emphasis)
    walk(tree)
    return [b for b in blocks if any(r['text'].strip() for r in b['runs'])]

def kaikki_entries(path: Path):
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf-8') as stream:
        for number, line in enumerate(stream):
            if not line.strip():
                continue
            item = json.loads(line)
            if item.get('lang_code') != 'ar':
                continue
            word = item.get('word', '')
            if not word:
                continue
            senses, form_of, tags = [], [], set(item.get('tags', []))
            for sense in item.get('senses', []):
                # Keep register and usage labels attached to their own sense. An
                # obsolete sense must not silently look like an everyday meaning.
                labels = [tag.replace('-', ' ') for tag in sense.get('tags', [])
                          if tag not in ('form-of', 'no-gloss')]
                prefix = f'({", ".join(labels)}) ' if labels else ''
                senses.extend(prefix + gloss for gloss in sense.get('glosses', []))
                form_of.extend(x['word'] for x in sense.get('form_of', []) if x.get('word'))
                tags.update(sense.get('tags', []))
            root = ''
            for template in item.get('etymology_templates', []):
                if template.get('name') in ('ar-root', 'ar-root2'):
                    args = template.get('args', {})
                    root = ''.join(str(args.get(str(i), '')) for i in range(1, 5))
            # Keep citation-form vowels when the head template supplies them.
            vocalized = next((f['form'] for f in item.get('forms', [])
                              if 'canonical' in f.get('tags', []) and f.get('form')), word)
            yield {'entryId': str(number), 'word': vocalized,
                   'keys': list(dict.fromkeys([normalize(word), normalize(vocalized)])),
                   'root': normalize(root), 'pos': item.get('pos', ''),
                   'senses': list(dict.fromkeys(senses)), 'formOf': list(dict.fromkeys(form_of)),
                   'tags': sorted(tags),
                   'url': 'https://en.wiktionary.org/wiki/' + urllib.parse.quote(word) + '#Arabic'}

def write_pack(source: str, entries, title: str, license_name: str, license_url: str, source_url: str):
    # Never overwrite a pack already installed by a browser, even on same-day rebuilds.
    version = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory = OUT / source / version
    directory.mkdir(parents=True, exist_ok=True)
    files, batch, count = [], [], 0
    def flush():
        if not batch:
            return
        raw = json.dumps(batch, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        name = f'{len(files):04d}.json'
        (directory / name).write_bytes(raw)
        files.append({'url': f'/dictionaries/{source}/{version}/{name}', 'bytes': len(raw),
                      'sha256': hashlib.sha256(raw).hexdigest()})
        batch.clear()
    for entry in entries:
        entry['source'] = source
        batch.append(entry)
        count += 1
        if len(batch) == 1200:
            flush()
    flush()
    pack = {'id': source, 'title': title, 'version': version, 'count': count,
            'bytes': sum(f['bytes'] for f in files), 'files': files,
            'license': license_name, 'licenseUrl': license_url, 'sourceUrl': source_url}
    (OUT / f'{source}.json').write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{source}: {count:,} entries, {pack["bytes"]/1e6:.1f} MB in {len(files)} chunks', flush=True)
    return pack

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--kaikki', type=Path, help='Raw or Arabic-only Wiktextract JSONL[.gz]')
    parser.add_argument('--cache', type=Path, help='Existing research downloads')
    parser.add_argument('--skip-kaikki', action='store_true')
    args = parser.parse_args()
    DATA.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (DATA / 'camel-tools').mkdir(exist_ok=True)
    download('https://raw.githubusercontent.com/CAMeL-Lab/camel-tools-data/main/catalogue-1.6.json', DATA / 'camel-tools' / 'catalogue.json')
    if args.cache:
        for filename in ['camel_morph_msa_v1.0.db', 'lexicon.sqlite.zip', 'lexicon.sqlite']:
            source = args.cache / filename
            if source.exists() and not (DATA / filename).exists():
                shutil.copyfile(source, DATA / filename)
    download(CAMEL_URL, DATA / 'camel_morph_msa_v1.0.db')
    download(LANE_URL, DATA / 'lexicon.sqlite.zip')
    if not (DATA / 'lexicon.sqlite').exists():
        with zipfile.ZipFile(DATA / 'lexicon.sqlite.zip') as archive:
            # One explicitly named member; never extract arbitrary archive paths.
            with archive.open('lexicon.sqlite') as source, (DATA / 'lexicon.sqlite').open('wb') as dest:
                shutil.copyfileobj(source, dest)
    write_pack('lane', lane_entries(DATA / 'lexicon.sqlite'), "Lane’s Lexicon",
               'GPL-3.0 (database distribution; upstream Perseus attribution retained)',
               'https://github.com/laneslexicon/LexiconDatabase/blob/master/LICENSE', LANE_URL)
    if not args.skip_kaikki:
        path = args.kaikki or DATA / 'kaikki-arabic.jsonl'
        if not args.kaikki:
            download(KAIKKI_URL, path)
        write_pack('kaikki', kaikki_entries(path), 'Wiktionary · Kaikki',
                   'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/',
                   KAIKKI_URL if not args.kaikki else 'https://kaikki.org/dictionary/rawdata.html')
    print('Data ready. Pack downloads are optional in the reader’s settings.', flush=True)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
