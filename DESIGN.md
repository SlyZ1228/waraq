# Arabic reading companion

Research and proposed design, 24 October 2026. This document records the original research plan. Phase 1 has since been implemented; see [README.md](README.md) for the current app, setup, and limitations, and [QA.md](QA.md) for validation.

## Recommendation

Build an iPad-focused Progressive Web App (PWA), installed from Safari. Begin with DRM-free, reflowable EPUBs, a persistent dictionary sidebar, and a replaceable dictionary/morphology layer. Add PDFs with usable text layers after the EPUB interaction is reliable. The user confirmed that Safari installation is acceptable.

Use three complementary resources:

- **CAMeL Morph MSA**, operated through CAMeL Tools, for candidate analyses: vocalization, lemma, root, pattern, grammatical features, and short glosses.
- **Wiktionary data extracted by Kaikki**, compiled into a local index, for accessible contemporary definitions, forms, and usage information. Treat coverage and quality as variable.
- **Lane's Arabic-English Lexicon**, as a downloadable classical reference for deeper investigation.

**Hans Wehr is the preferred additional modern reference**, subject to obtaining an appropriate data license or using it as a separately opened reference. No supported public API or authorized structured download was verified. A scan visible on a website is not evidence of an integration license.

This combination is a practical starting point, not a claim that open data equals a professionally edited modern dictionary. Keep each source's identity, senses, and register visible. Do not merge conflicting meanings into a single authoritative answer.

## Dictionary evaluation

| Resource | Value for this reader | Integration evidence and limitation |
| --- | --- | --- |
| [Hans Wehr / Cowan, A Dictionary of Modern Written Arabic](https://www.harrassowitz-verlag.de/titel_2675.ahtml) | Preferred reference for formal modern prose; a better primary fit for news and novels than an exclusively classical lexicon. | Publisher confirms the Arabic-English fourth edition. No supported public developer API or licensed structured dataset verified in this research. Keep an adapter slot; do not make the MVP depend on scraping it. |
| [Lane's digital lexicon](https://laneslexicon.github.io/) | Detailed classical senses and root exploration, especially useful given the learner's Qur'anic background. Archaic English and historical senses need clear labeling. | The [database project](https://github.com/laneslexicon/LexiconDatabase) offers SQLite. Its repository [license](https://github.com/laneslexicon/LexiconDatabase/blob/master/LICENSE) is GPL-3.0; preserve package notices and trace the upstream Perseus text notices in the pack build. Do not label the digital distribution simply unrestricted because the original book is old. |
| [Kaikki Arabic](https://kaikki.org/dictionary/Arabic/) | Practical modern coverage, English senses, forms, examples, and some etymological information. Editorial consistency varies. | Downloadable machine-readable data. Prefer the [raw extraction feed](https://kaikki.org/dictionary/rawdata.html); the Arabic site's postprocessed feed is marked deprecated. Filter Arabic entries from the English-language Wiktionary extraction. Preserve per-entry provenance and applicable [Wiktionary text terms](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), including CC BY-SA. Omit media/quotations with separate terms from the initial pack. |
| [Aratools](https://aratools.com/) | Relevant alternative: affix analysis, roots, POS and offline dictionary functionality already exist in its own apps. | The site links GPL redistributable content and advertises a Python core library; its [API announcement](https://aratools.mataroa.blog/blog/api-documentation-for-aratools-core/) concerns library documentation. This is not a verified hosted REST service with a public access contract. Evaluate if the core becomes readily obtainable. |
| [Living Arabic / Lughatuna](https://www.livingarabic.com/en/) | Valuable future option for dialect media, with dialect-specific entries and examples. | A reference website/app, not a verified integration API or downloadable licensed pack here. MSA morphology should not be presented as comprehensive dialect support. |
| [Birzeit Qabas](https://arxiv.org/abs/2406.06598) | Interesting lemma alignment resource for future cross-dictionary joins. | Linking a lemma to other dictionaries does not supply unrestricted access to all their definitions. The live API pages timed out during research, so availability, access and response quality remain unverified. |

Almaany and [Mawrid Reader](https://ejtaal.net/aa/) are useful manual reference destinations. No production API/access agreement was verified for them. Almaany returned HTTP 403 to the research browser. Do not build the essential reading interaction around page scraping, private endpoints, or bypassing that response.

## Morphology is a separate problem

A dictionary headword and a word in a sentence are different objects. A root is a set of consonants, not necessarily a standalone word with one definition. Opening a root should show a family of derived words and source articles.

For example, **كتب** can represent **كَتَبَ** (he wrote), **كُتُب** (books), and other analyses. **وَبِكِتَابِهِ** includes a conjunction, a preposition, a noun, and a possessive suffix. Removing the first/last few letters is not a reliable analyzer, especially for weak roots, doubled consonants, broken plurals, and attached pronouns.

[CAMeL Morph MSA](https://aclanthology.org/2024.lrec-main.240/) is a research-backed candidate. Its [frozen release](https://github.com/CAMeL-Lab/camel_morph/tree/main/official_releases/lrec-coling2024_release) documents CC BY 4.0 data and compatibility with CAMeL Tools. Keep this database distinct from the older **calima-msa-r13** default: that data is GPL v2, while **calima-msa-s31** requires a licensed SAMA copy. CAMeL Tools' MIT code license does not override dataset licenses. See the [database documentation](https://camel-tools.readthedocs.io/en/latest/api/morphology/database.html).

The [feature schema](https://camel-tools.readthedocs.io/en/latest/reference/camel_morphology_features.html) supports the fields this UI needs. Actual database inspection confirmed `diac`, `lex`, `root`, `pattern`, `pattern_abstract`, and `gloss` fields. This verifies data availability, not accuracy on the user's books or browser performance.

Vocalization and syntactic role must be handled honestly:

- Preserve diacritics supplied in the book and use them to filter candidates.
- Distinguish the dictionary citation form from the selected word's possible inflection.
- Group candidates by lemma/reading instead of displaying dozens of nearly identical case-ending analyses.
- Show alternative readings; allow a manual choice and preserve it for that occurrence.
- Display case/mood as candidate features when unresolved. An analyzer is not a complete i'rab explanation of the sentence.
- Use “suggested from context” only when a contextual model actually ran. Never turn a raw ranking score into a confidence percentage.
- CAMeL's [MLE disambiguator](https://camel-tools.readthedocs.io/en/latest/api/disambig/mle.html) is a useful frequency baseline, not contextual sentence understanding. A [BERT disambiguator](https://camel-tools.readthedocs.io/en/latest/api/disambig/bert.html) is a separate later experiment; verify model/database compatibility and performance.

## Reading interaction

Landscape: the book remains in a broad reading column; a 320–380 px inspector opens beside it. Let the user choose the side. Portrait or Split View: use a dismissible sheet and restore the exact reading position when it closes. Use large Arabic type and generous line height so shadda and vowel marks do not collide.

1. Tap a word in lookup mode, or select text normally and use the app's lookup control. Avoid relying on replacing Safari's native context menu.
2. Immediately show the original selected spelling and loading/cached state.
3. Show candidate vocalization, a concise source-attributed meaning, and a collapsible grammar section.
4. Show lemma, root, pattern/form when supported, number/gender/person, aspect/voice, and clitic breakdown as applicable.
5. Make lemmas and Arabic words in definitions tappable. Parse Arabic runs as text with safe DOM construction; preserve existing links and do not split combining marks.
6. Root links open a root-family view. Search can accept a surface form, lemma, or spaced root. Do not treat all queries with the same stripping rule.
7. Maintain sidebar Back/Forward history independently of the book. A deep dive must never navigate the reader away from its page.

Show full dictionary entries on demand; do not overwhelm the first view with every historical sense. Keep grammatical labels in accessible English with optional Arabic terminology. Unknown words should offer manual search and preserve the original selection, not fabricate a root. No LLM is required for v1.

## Implementation architecture

Use TypeScript with a small UI framework, [epub.js](https://github.com/futurepress/epub.js) behind a reader adapter, IndexedDB for books/settings/history, and a service worker for the application shell and downloaded packs. This library choice is provisional until iPad RTL selection and pagination pass a real-device spike. [Foliate-js](https://github.com/johnfactotum/foliate-js) is an alternative if that spike fails. Readium Swift is suitable for a future native app, not the selected web client.

Keep publication scripts disabled and sanitize imported content. Use a sandboxed reading frame, block unexpected external resources, and preserve text offsets and EPUB locators. Detect words using DOM ranges plus Arabic-aware segmentation, not a global replacement that breaks text shaping or EPUB markup. Keep original text alongside normalized lookup keys; normalize presentation forms/tatweel carefully, and make hamza folding a fallback rather than a destructive rewrite.

Proposed modules:

```text
ReaderAdapter -> SelectedOccurrence -> LookupCoordinator
                                      |-> local sense index
                                      |-> cached morphological candidates
                                      |-> MorphologyProvider
                                      |-> RootIndex
                                      -> inspector + independent history
```

### First working version

Run the canonical Python analyzer in a small service exposed over HTTPS. Load its database once when the process starts. The iPad stores and renders books locally; only lookup input goes to the service. A hosted service is an operational dependency and may have a hosting cost; a Windows-hosted service only works while the computer and network route are available. The iPad does not run this Python service itself.

Define an application-owned `POST /api/analyze` contract with `surface`, optional sentence, selected token offsets, and requested language variety. Return a versioned list of candidate analyses and explicit status. This is a proposed API we would implement, not an existing CAMeL public endpoint. For basic analysis, send the word only; enable sentence transmission only with a contextual feature the user chooses.

Lookup locally first. Cache morphology by original spelling/diacritics, variety, engine version and data version. Cache contextual ranking separately by sentence + token occurrence + model version. Dictionary sense records have independent stable source IDs. Cancel or ignore superseded requests so a slow response never replaces the current word.

Offline in this first version: imported reading, downloaded lexical entries, root exploration from available indexes, and previously cached analyses. **A new inflected word may need connectivity for its analysis.** Do not describe this milestone as fully offline morphology.

### Full offline milestone

Port the bounded prefix/stem/suffix compatibility algorithm to TypeScript or WebAssembly in a Web Worker, and compile the database into compact, indexed tables. A dictionary stored in SQLite alone does not perform morphological analysis. Do not enumerate every possible inflected word, and do not bundle an entire Python/ML runtime as the default solution.

Use canonical Python outputs as the oracle for a browser implementation. This is the largest technical uncertainty. Ship it only after parity tests and Safari memory/latency checks. A light dictionary can remain in IndexedDB; consider SQLite/WASM with OPFS for larger packs after a Safari compatibility and memory test. Avoid loading hundreds of MB of JSON objects into the main thread.

## Storage and installation

Measured public artifacts on 24 October 2026:

| Artifact | Verified size | Interpretation |
| --- | ---: | --- |
| CAMeL Morph MSA v1.0 database | 84,959,404 bytes (~85 MB) | Raw file, not browser index or runtime memory. |
| Lane SQLite archive | 61,636,179 bytes (~62 MB) | Download size. |
| Lane SQLite inside archive | 264,806,400 bytes (~265 MB) | Uncompressed database; no new app indexes included. |

Together the raw morphology and Lane data are about **350 MB**, before book files and a modern dictionary. Kaikki's Arabic page currently lists an approximately **828 MB** postprocessed JSONL file; that is not the final pack size and is not the feed to build a long-lived pipeline around. A stripped, compressed and indexed pack should be measured before promising a size. Browser heap consumption is a separate budget from disk storage.

Serve the PWA from a stable HTTPS origin. On iPad use Safari → Share → Add to Home Screen, with Open as Web App enabled where offered. See [Apple's instructions](https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados). Cache the application and download packs before claiming offline readiness. Import books from Files into app storage.

[Service workers require a secure context](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API): opening an HTML file from Files is not an install/deployment strategy. An ordinary HTTP LAN address is not equivalent to localhost on the iPad. HTTPS hosting serves app code; it does not require uploading personal books.

[WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) supports persistence requests but does not make browser storage an unconditional backup. Request persistence, show actual usage and download completion, handle quota errors, and provide export/import for notes, vocabulary and reading positions. Preserve originals in Files. Download packs transactionally with versions/checksums; keep a working pack if an update fails.

## PDF scope

Add [PDF.js](https://mozilla.github.io/pdf.js/) after EPUB. A rendered PDF page is straightforward; reliable Arabic selection depends on its embedded Unicode text and reading order. A scanned page requires OCR. Separate these cases in the UI. Initial PDF support should handle documents with usable text layers and explicitly say when lookup is unavailable; scanned-PDF OCR is a later project.

## Build order and acceptance criteria

1. **Data/lookup spike:** run the chosen analyzer and compare at least 100 representative words from actual intended reading with checked analyses. Cover clitics, hamza, weak/doubled roots, broken plurals, partial vowels, ambiguous forms, and proper names. Verify lemma-to-definition joins, not just analyzer output.
2. **EPUB vertical slice:** install the PWA on the user's iPad, import one RTL EPUB, select a word, fetch analyses, show local definitions, follow a root and return without moving the book. Test portrait, landscape, Split View and touch selection.
3. **Useful library:** resume positions, TOC, font controls, bookmarks, inspector search/history, source attribution, dictionary downloads, backup, and clear offline states. Verify restart and airplane-mode behavior.
4. **Offline morphology:** worker/index implementation with canonical parity checks and measured memory usage on the actual iPad. Keep incomplete/offline status honest until this passes.
5. **PDF text layer**, then contextual disambiguation and dialect support based on actual reading needs.

Performance goals, not measurements: warm local lookup p95 below 150 ms; warm online candidate response around/below one second on normal Wi-Fi. Report cold-start time separately. The initial inspection did not run an analyzer, benchmark a hosted API, test iPad storage, or validate EPUB rendering. Those are the next implementation gates.

## Concept validation

The illustrative interface was rendered and checked in a desktop browser. Word/root navigation, nested lookup with Back, search for كتب, and switching between كُتُب and كَتَبَ were exercised. A 736 px layout was visually inspected; at 320 px the content stacked and its measured scroll width matched its client width. These checks validate the concept's interactions and layout only, not touch behavior or Safari on an actual iPad. Entries and the practice passage are authored examples, not live dictionary results.
