"""Package a self-contained Swift app project; no server, keys or user library included."""
from pathlib import Path
import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scripts.prepare_data import normalize
PROJECT=ROOT/'playgrounds/Waraq.swiftpm'
RESOURCES=PROJECT/'Sources/WaraqData'

def main():
    version=json.loads((ROOT/'package.json').read_text())['version']
    project_name=f'Waraq-{version}.swiftpm'
    if (PROJECT/'Sources/Resources').exists():
        raise RuntimeError('Stale generated Sources/Resources folder found. Move it to Sources/WaraqData before packaging; Resources conflicts with Apple bundle signing.')
    subprocess.run([sys.executable, str(ROOT/'scripts/make_playgrounds_icons.py'), '--check'], check=True)
    web=RESOURCES/'Web'
    web.mkdir(parents=True,exist_ok=True)
    for filename in ['app.js','app.css']:
        shutil.copy2(ROOT/'.data/playgrounds-web'/filename,web/filename)
    (web/'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data: blob:; img-src 'self' data: blob:; connect-src 'self' data: blob:; frame-src 'self' blob: about:; worker-src blob:; object-src 'none'; base-uri 'self'"><title>Waraq</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>''',encoding='utf-8')
    shutil.copy2(ROOT/'public/sample.epub',web/'sample.epub')
    manifest=json.loads((ROOT/'public/morphology/manifest.json').read_text())
    for file in manifest['files']:
        source=ROOT/'public'/file['url'].lstrip('/')
        assert hashlib.sha256(source.read_bytes()).hexdigest()==file['sha256']
        target=web/file['url'].lstrip('/');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
    shutil.copy2(ROOT/'public/morphology/manifest.json',web/'morphology/manifest.json')
    dbpath=RESOURCES/'dictionaries.sqlite'
    # Replace only our generated database, never user data.
    if dbpath.exists(): dbpath.unlink()
    conn=sqlite3.connect(dbpath)
    conn.executescript('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE entries(id INTEGER PRIMARY KEY,root TEXT NOT NULL,json TEXT NOT NULL); CREATE TABLE lookup(word TEXT NOT NULL,entry INTEGER NOT NULL);')
    counts={}
    for source in ['kaikki','lane']:
        pack=json.loads((ROOT/f'public/dictionaries/{source}.json').read_text(encoding='utf-8'))
        (web/'dictionaries').mkdir(exist_ok=True)
        shutil.copy2(ROOT/f'public/dictionaries/{source}.json',web/f'dictionaries/{source}.json')
        count=0
        for chunk in pack['files']:
            raw=(ROOT/'public'/chunk['url'].lstrip('/')).read_bytes()
            assert hashlib.sha256(raw).hexdigest()==chunk['sha256']
            for entry in json.loads(raw):
                if not entry['senses'] and not entry['formOf']: continue
                entry.update(source=source,version=pack['version'],id=f'{source}:{pack["version"]}:{entry["entryId"]}')
                entry['root']=normalize(entry.get('root','')).replace('ٱ','ا').translate(str.maketrans('','',' .·'))
                cursor=conn.execute('INSERT INTO entries(root,json) VALUES(?,?)',(entry['root'],json.dumps(entry,ensure_ascii=False,separators=(',',':'))))
                keys=set()
                for value in entry['keys']:
                    key=normalize(value).replace('ٱ','ا');keys.add(key);keys.add(key.translate(str.maketrans('أإآ','ااا')))
                conn.executemany('INSERT INTO lookup(word,entry) VALUES(?,?)',[(key,cursor.lastrowid) for key in keys])
                count+=1
        counts[source]=count
    conn.executescript('CREATE INDEX entry_root ON entries(root); CREATE INDEX lookup_word ON lookup(word);')
    conn.commit()
    assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    conn.close()
    if (ROOT/'licenses').exists(): shutil.copytree(ROOT/'licenses',RESOURCES/'Licenses',dirs_exist_ok=True)
    conversion=RESOURCES/'Licenses/ConversionSource'
    conversion.mkdir(parents=True,exist_ok=True)
    for relative in ['scripts/prepare_data.py','scripts/prepare_morphology.py','scripts/package_playgrounds.py','src/morphology.ts']:
        target=conversion/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/relative,target)
    shutil.copy2(ROOT/'PLAYGROUNDS-SETUP.md',PROJECT/'README.md')
    out=ROOT/'releases';out.mkdir(exist_ok=True)
    archive=out/'Waraq-Playgrounds.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as package:
        for path in sorted(PROJECT.rglob('*')):
            if path.is_file() and not {'.swiftpm', '.build', '.DS_Store'}.intersection(path.relative_to(PROJECT).parts):
                package.write(path,Path(project_name)/path.relative_to(PROJECT))
    # Keep Lane's upstream XML-bearing database and our conversion source next to
    # the public binary distribution. This separate asset is not needed to run Waraq.
    lane_source=out/'Waraq-Lane-Source.zip'
    with zipfile.ZipFile(lane_source,'w',compression=zipfile.ZIP_STORED) as source:
        source.write(ROOT/'.data/lexicon.sqlite.zip','upstream/lexicon.sqlite.zip')
        for relative in ['licenses/Lane-GPL-3.0.txt','licenses/DATA-SOURCES.md','scripts/prepare_data.py','scripts/package_playgrounds.py','server/requirements.txt']:
            source.write(ROOT/relative,relative)
        source.writestr('README.txt',
            "Lane source material for Waraq. Not needed to install the reader.\n"
            "The upstream archive contains lexicon.sqlite, including Lane's source XML entries.\n"
            "Source: https://github.com/laneslexicon/LexiconDatabase\n"
            "Waraq's conversion scripts and upstream GPL-3.0 notice are included.\n"
            "Complete app source and build instructions: https://github.com/SlyZ1228/waraq\n")
    assets={path.name:{'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in [archive,lane_source]}
    report={'archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
            'dictionaryRows':counts,'morphologyBytes':manifest['bytes'],'databaseBytes':dbpath.stat().st_size,
            'appVersion':version,'projectName':project_name,'assets':assets,
            'nativeCompilation':'GitHub macOS CI builds full app packages for iOS device and Simulator with Xcode, checks complete resource seals, and runs native regressions. macOS ad-hoc signing does not verify Swift Playgrounds on-device signing or launch.'}
    (out/'package-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (out/'SHA256SUMS.txt').write_text(''.join(f'{info["sha256"]}  {name}\n' for name,info in assets.items()),encoding='ascii')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
