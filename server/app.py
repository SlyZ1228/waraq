"""Waraq's same-origin morphology API and production static server."""
from __future__ import annotations
import os
from pathlib import Path
import re
import time
import unicodedata
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('WARAQ_DATA', ROOT / '.data'))
CATALOGUE = DATA / 'camel-tools'
CATALOGUE.mkdir(parents=True, exist_ok=True)
os.environ['CAMELTOOLS_DATA'] = str(CATALOGUE)
ENGINE_VERSION = 'camel-tools-1.6.0-camel-morph-msa-1.0-v1'
MARKS = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')
analyzer = None
startup_error: str | None = None

def normalize(text: str) -> str:
    return MARKS.sub('', unicodedata.normalize('NFKC', text))

def marks_by_letter(text: str):
    result = []
    for ch in unicodedata.normalize('NFC', text):
        if unicodedata.combining(ch):
            if result:
                result[-1][1].add(ch)
        elif ch != '\u0640':
            result.append((ch, set()))
    return result

def compatible_vowels(surface: str, reading: str) -> bool:
    supplied, generated = marks_by_letter(surface), marks_by_letter(reading)
    if not any(marks for _, marks in supplied):
        return True
    if len(supplied) != len(generated):
        return False
    fold = str.maketrans('أإآٱى', 'ااااي')
    return all(a.translate(fold) == b.translate(fold) and ma.issubset(mb)
               for (a, ma), (b, mb) in zip(supplied, generated))

@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer, startup_error
    try:
        from camel_tools.morphology.analyzer import Analyzer
        from camel_tools.morphology.database import MorphologyDB
        database = DATA / 'camel_morph_msa_v1.0.db'
        if not database.exists():
            raise FileNotFoundError('Run scripts/prepare_data.py first.')
        analyzer = Analyzer(MorphologyDB(str(database)), cache_size=5000)
    except Exception as exc:
        startup_error = f'{type(exc).__name__}: {exc}'
        print(f'Morphology unavailable: {startup_error}', flush=True)
    yield

app = FastAPI(title='Waraq morphology', lifespan=lifespan, docs_url=None, redoc_url=None)
requests_by_ip: dict[str, deque] = defaultdict(deque)

@app.middleware('http')
async def limits(request: Request, call_next):
    if request.url.path.startswith('/api/'):
        try:
            size = int(request.headers.get('content-length', '0') or 0)
        except ValueError:
            return JSONResponse({'detail': 'Invalid content length.'}, status_code=400)
        if size > 4096:
            return JSONResponse({'detail': 'Request is too large.'}, status_code=413)
        if request.method == 'POST':
            origin = request.headers.get('origin')
            if origin and origin.rstrip('/') != str(request.base_url).rstrip('/'):
                # Vite's proxy uses changeOrigin=false so its original Host is retained.
                return JSONResponse({'detail': 'Use the reader on this server.'}, status_code=403)
            key = request.client.host if request.client else 'local'
            queue = requests_by_ip[key]
            now = time.monotonic()
            while queue and queue[0] < now - 60:
                queue.popleft()
            if len(queue) >= 120:
                return JSONResponse({'detail': 'Please wait a moment before another lookup.'}, status_code=429)
            queue.append(now)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response

class AnalyzeRequest(BaseModel):
    surface: str = Field(min_length=1, max_length=80)

@app.get('/api/health')
def health():
    return {'ready': analyzer is not None, 'engineVersion': ENGINE_VERSION,
            'detail': 'Ready' if analyzer else 'Morphology data or dependencies are not ready. See the server log.'}

@lru_cache(maxsize=6000)
def analyze_word(surface: str):
    raw = analyzer.analyze(surface)
    grouped = {}
    for item in raw:
        if not compatible_vowels(surface, item.get('diac', '')):
            continue
        lemma = re.sub(r'_[0-9]+$', '', item.get('lex', ''))
        # Keep distinct vowelings and grammatical readings; deduplicate duplicate lexicon rows.
        fields = ['pos','asp','vox','per','gen','num','cas','mod','stt','prc0','prc1','prc2','prc3','enc0']
        key = (item.get('diac'), lemma, *(item.get(f, '') for f in fields))
        if key in grouped:
            continue
        root = item.get('root', '')
        root = '' if root in ('NOAN', 'na', 'None') else root.replace('.', ' ')
        grouped[key] = {
            'diac': item.get('diac', surface), 'lemma': lemma, 'root': root,
            'pattern': item.get('pattern_abstract') or item.get('pattern') or '',
            'gloss': item.get('gloss', '').replace('_', ' '),
            'features': {f:item[f] for f in fields if item.get(f) not in (None,'na','0','-')},
            'source': item.get('source', 'lex'),
            'score': float(item.get('pos_lex_logprob', -99) or -99),
        }
    # Tie-break by a stable presentation order, not by an inferred sentence meaning.
    results = sorted(grouped.values(), key=lambda x:(-x['score'],
        x['features'].get('vox') == 'p',
        {'i': 0, 'u': 1, 's': 2, 'j': 3}.get(x['features'].get('mod', ''), 0),
        x['lemma'], x['diac']))
    for i, item in enumerate(results):
        item['id'] = str(i)
        item.pop('score')
    return {'surface': surface, 'engineVersion': ENGINE_VERSION,
            'analyses': results[:80], 'total': len(results),
            'ranking': 'lexical; not contextual', 'truncated': len(results)>80}

@app.post('/api/analyze')
def analyze(payload: AnalyzeRequest):
    if analyzer is None:
        raise HTTPException(503, 'Morphology service is not ready. Download the data and restart it.')
    surface = payload.surface.strip()
    if not re.fullmatch('[\u0621-\u063a\u0641-\u064a\u0671\u064b-\u065f\u0670\u0640]+', surface):
        raise HTTPException(422, 'Choose one Arabic word, without punctuation.')
    return analyze_word(surface)

# Same-origin production deployment. The API needs no book uploads or user account.
if (ROOT / 'public' / 'dictionaries').exists():
    app.mount('/dictionaries', StaticFiles(directory=ROOT / 'public' / 'dictionaries'), name='dictionaries')
if (ROOT / 'dist').exists():
    app.mount('/', StaticFiles(directory=ROOT / 'dist', html=True), name='reader')
