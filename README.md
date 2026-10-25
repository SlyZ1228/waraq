# Waraq · ورق

A local Arabic EPUB reader with a bookshelf, four themes, persistent positions, and a word explorer. The **Swift Playgrounds project** bundles Kaikki, Lane, and a fully local CAMeL Morph analyzer. The same reader can be tested in a Windows browser.

**[Download Waraq for Swift Playgrounds](https://github.com/SlyZ1228/waraq/releases/download/v0.2.1/Waraq-Playgrounds.zip)** · **[Release notes](https://github.com/SlyZ1228/waraq/releases/tag/v0.2.1)** · **[Installation guide](PLAYGROUNDS-SETUP.md)**

On your iPad, download the ZIP, unzip it in Files, open **Waraq.swiftpm** in Apple's **Swift Playgrounds**, and tap **Run**. The release ZIP includes the offline resources; GitHub's automatically generated **Source code** archives do not. No laptop server or App Store publishing is needed.

**Preview status:** the shared reader and analyzer are tested on Windows. The native Swift sources compile and link against the iOS Simulator SDK in GitHub's macOS CI, and resource-location tests pass. Running the complete project in Swift Playgrounds on an iPad remains to be verified. Launch through Swift Playgrounds rather than a separately installed app icon. Version 0.2.1 fixes the `Bundle.module` compile error reported in 0.2.0.

## Laptop preview

After the source setup below, double-click **Preview Waraq.cmd**, then open **http://127.0.0.1:4173/**. Choose the sample or import a DRM-free EPUB. In Settings, install both dictionaries and offline morphology. Afterwards, new word analysis works even with the preview server stopped. Use the same browser and address to retain your library.

`npm run dev` starts the development UI without offline app-shell installation. No Python analysis server is required by the reader now. The earlier port 8000 launcher remains for existing libraries and the reference API. The HTTPS instructions in `IPAD-SETUP.md` are historical alternatives; they are unnecessary for Playgrounds.

## Features

- EPUB import, covers, duplicate detection, saved CFI position, bookmarks, table of contents, and library search.
- Displayed title/author editing. Reimporting an identical original preserves edits and progress.
- Full-height page-edge controls and footer arrows, with RTL-aware direction. Tap or select words in the reading text.
- Paper, Sepia, Sage, and soft Dusk themes, adjustable font size and spacing, bundled Arabic fonts.
- On-device harakat, lemma, root, pattern, verb form, grammar, and alternative readings. Supplied vowels constrain candidates. No contextual disambiguation or guessed roots.
- Separate attributed Kaikki and Lane definitions, clickable Arabic text, root search, lookup history.
- Lane layout preserves sense divisions and gloss emphasis, with its original continuous paragraph available.
- Native files and SQLite in Playgrounds; IndexedDB and verified downloadable resources in the browser.
- Optional personal PDF reference viewer in Playgrounds, with last-page persistence and PDF-specific root bookmarks. No Hans Wehr content is bundled.

The main library supports DRM-free reflowable EPUBs. General PDF library reading, OCR, word lookup inside PDFs, synchronization, media learning, and structured Hans Wehr definitions are not implemented. The optional reference viewer is separate from the EPUB library.

## Persistence

Playgrounds writes books and metadata to Application Support using atomic file writes. The browser uses IndexedDB. Neither mirrors a folder automatically. Keep original EPUBs and export progress before moving devices or changing/removing a project. Restoring progress requires the same original file hash. The setup guide covers remaining lifecycle checks.

## Data and architecture

| Resource | Size | Contents |
|---|---:|---|
| Kaikki / English Wiktionary | 64.9 MB browser pack | 233,417 source rows; 36,974 usable definition/form rows in the native index |
| Lane | 95.6 MB browser pack | 47,919 entries, original text plus reading layout |
| CAMeL Morph MSA 1.0 | 37.0 MB | 96,989 stem keys, affixes, compatibility rules; 128 stem shards |
| Native SQLite dictionaries | 138.1 MB | Indexed Kaikki and Lane |

Sizes are decimal MB. The complete project compresses to about 28 MB. It contains no user books, laptop certificates/private keys, or laptop runtime dependencies.

The TypeScript analyzer ports the relevant canonical CAMeL Tools analysis, merge, and rewrite logic. It lazily loads tables, retains at most 12 stem shards, and normally runs in a worker, with a local fallback if workers are unavailable. It analyzes previously unseen words; it is not a finite cache of pre-analyzed inflections. MSA coverage still has limits for classical forms and dialects. Lexical ranking cannot determine a sentence's intended meaning.

See [licenses/DATA-SOURCES.md](licenses/DATA-SOURCES.md), [research/hans-wehr-offline.md](research/hans-wehr-offline.md), and [QA.md](QA.md). `DESIGN.md` retains earlier research as historical context.

## Rebuild

For source development, install Git, Node.js 22.12+ (Node 24 recommended), and Python 3.11+ with venv. Fresh Windows setup:

```powershell
git clone https://github.com/SlyZ1228/waraq.git
cd waraq
.\scripts\setup.ps1
```

Setup creates the venv, installs dependencies, downloads data, compiles morphology tables, and builds the browser app. Generated data, dependencies, user libraries, and release archives are excluded from Git. Python is a build/reference tool, not an iPad requirement. Allow several GB for sources, dependencies, and outputs. If local PowerShell policy blocks the script, use `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1` for that one invocation.

To rebuild from an already prepared checkout:

```powershell
npm.cmd run build
npm.cmd run build:playgrounds
.venv\Scripts\python.exe scripts\package_playgrounds.py

# Regenerate tables and canonical parity fixtures when needed
.venv\Scripts\python.exe scripts\prepare_morphology.py
.venv\Scripts\python.exe scripts\morphology_reference.py
npm.cmd test
```

`src/` is shared reader/analyzer code; `playgrounds/Waraq.swiftpm/Sources/` is the Swift shell. `scripts/` prepares resources. `server/` retains the canonical analyzer for comparisons and the older preview. Shared code changes require both web builds and repackaging before transfer.

`scripts/prepare_data.py --kaikki <jsonl-or-jsonl.gz>` supports a newer raw Wiktextract feed. Kaikki labels the current Arabic-only snapshot deprecated. Recheck lookups and rebuild after data refreshes. Source licenses and links are included with the project. Definitions are rendered as text; imported EPUB active content and external resource URLs are stripped. This is not a comprehensive security audit.
