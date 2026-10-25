# Changelog

## v0.2.0 — Swift Playgrounds preview — 2026-10-25

First public release. The shared reader is tested on Windows; native Swift compilation and physical-iPad validation remain pending.

- Self-contained Swift Playgrounds project with bundled Kaikki, Lane, and CAMeL morphology, plus native library storage.
- Full offline analysis for new words, including harakat, roots, patterns, grammatical features, and alternative readings.
- Page-edge navigation and preservation of the text position when the dictionary sidebar opens or closes.
- Library title and author editing with persistent metadata.
- Lane reading layout with source sense divisions, gloss emphasis, clickable Arabic references, and original paragraph view.
- Optional personal dictionary PDF viewer with saved pages and document-specific root bookmarks. No Hans Wehr content included.

Validation: 12 automated tests passed; analyzer parity matched 568 words against canonical CAMeL Tools. Offline browser checks, packaged frontend smoke tests, ZIP checksums, and SQLite integrity checks passed. See [QA.md](QA.md) for details and device checks.

Download **Waraq-Playgrounds.zip** from the release. The optional **Waraq-Lane-Source.zip** preserves Lane's upstream source material and conversion scripts; it is not required for installation.
