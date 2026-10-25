# Changelog

## v0.2.2 — Bundled iPad icons — 2026-10-25

- Replace Playgrounds' generated placeholder icon with a processed AppIcon asset catalog, including opaque PNGs for all iPad icon sizes and the 1024 px marketing icon. This targets the reported signing error `NSOSStatusErrorDomain -67072` whose component path pointed to `_PlaceholderAppIcon76x76@2x~ipad.png`.
- Add macOS CI checks that compile the icons for both the iOS device and Simulator platforms and ad-hoc sign/verify a simulator app bundle containing those assets.
- Keep the v0.2.1 resource lookup fix and the existing library storage format.

The placeholder path is removed from the project configuration. The exact iPad failure has not been reproduced on the Mac runner, so successful signing and launch in Swift Playgrounds remain to be confirmed. Extract the new ZIP into a fresh folder and open that project; keep the old project and any library backups.

## v0.2.1 — Playgrounds resource fix — 2026-10-25

- Fix the reported `Type 'Bundle' has no member 'module'` compiler error and the associated `nil` type-inference error in LocalStore.
- Locate the complete resource tree through the main app bundle or an embedded SwiftPM resource bundle without depending on a generated accessor or a hardcoded bundle name.
- Add GitHub macOS CI that compiles and links all native Swift sources against the iOS Simulator SDK and runs eight resource-location regression checks.

The native compiler and resource tests passed. Running the complete project in Swift Playgrounds on the physical iPad remains to be verified. Download the v0.2.1 project ZIP; no book-storage migration is required by this fix.

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
