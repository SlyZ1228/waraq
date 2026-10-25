# Offline Hans Wehr investigation

Checked 25 October 2026. This is source and implementation research, not a determination of copyright status in every jurisdiction.

## Finding

Offline Hans Wehr software and structured OCR data exist, but this investigation did **not verify a publisher-authorized, reusable structured dataset or public dictionary API** that Waraq can bundle. A software repository's license label alone does not establish the rights to the dictionary text it includes. No dictionary scans or lexical datasets were downloaded during this investigation, and no publisher or developer was contacted.

The immediately implementable route is an optional **user-imported PDF reference**. The user supplies a copy they are entitled to use, Waraq keeps it on-device, and a native PDF viewer opens it alongside the reading workflow. This provides offline access to that copy; it is not automatically a searchable, structured Hans Wehr integration.

## Sources examined

- [Harrassowitz publisher listing](https://www.harrassowitz-verlag.de/titel_2675.ahtml): identifies the fourth enlarged Arabic-English edition, edited by J. Milton Cowan, 1,301 pages, ISBN 978-3-447-02002-2. The examined listing sells a hardback; it supplies no structured export, developer API, or reuse grant.
- [GibreelAbdullah/HansWehrDictionary](https://github.com/GibreelAbdullah/HansWehrDictionary): the maintainer describes a Flutter app with local SQLite storage and offline operation. Its README says the text was extracted from scanned pages and may contain errors, and credits Jamal Osman and Muhammad Abdurrahman for digitization. The examined repository root did not show a LICENSE file. No rights-holder permission for the lexicon was verified.
- [jamalosman/hanswehr-app](https://github.com/jamalosman/hanswehr-app): a prior Xamarin app with an MIT repository label; its README says its data comes from the FODT parsing project and needs cleaner extraction.
- [muhammad-abdurrahman/hans-wehr-fodt-parser](https://github.com/muhammad-abdurrahman/hans-wehr-fodt-parser): a parser repository listing XML/JSON artifacts and an MIT label. The presence of these files is evidence of a technical source, not verification of a publisher license covering their dictionary contents. The underlying lexical artifacts were not downloaded.
- [Hans Wehr Digital on the App Store](https://apps.apple.com/us/app/hans-wehr-digital/id6743653472): the developer advertises digitized text and verb-form highlighting on iPad. This listing establishes an existing app, not permission to extract its data or a supported external lookup/API contract. No integration endpoint or publisher authorization was verified.
- [Harrassowitz contact page](https://www.harrassowitz-verlag.de/kontakt.ahtml): the publisher lists a Rights and Licenses department. A future inquiry could ask specifically about an Arabic-English structured edition, personal on-device use, export formats, attribution, and whether a redistribution license is available. Do not send an inquiry without the user's authorization.

## Recommended implementation

1. Add an optional **Personal dictionary PDF** import in the native Playgrounds package. Do not include a Hans Wehr PDF or OCR database in the project archive.
2. Copy the selected document into persistent app storage so the original Files-provider connection is not needed afterward. Keep the library and EPUB position intact while presenting the reference.
3. Open it using Apple's `PDFDocument(url:)` and `PDFView`. Native PDFKit works with local files; its navigation API can seek to a `PDFPage` or `PDFDestination`. Sources: [PDFDocument](https://developer.apple.com/documentation/pdfkit/pdfdocument), [PDFView](https://developer.apple.com/documentation/pdfkit/pdfview), [PDF navigation](https://developer.apple.com/documentation/pdfkit/navigation).
4. Store optional mappings from a normalized Arabic root to a **document-specific page index**, plus the last viewed page. Bind mappings to a file fingerprint and label them as user bookmarks. Different editions/scans have different page offsets; do not bundle guessed page mappings or reuse a mapping for another document.
5. From a known CAMeL root, offer **Open personal reference**. Jump directly only if the user has saved a mapping; otherwise open the last page and provide normal navigation. Avoid implying an exact root match was found when it was not.
6. If the PDF has a reliable text layer, text search can be added. A scanned page with no text layer needs OCR before text search is meaningful. OCR does not automatically recover clean entries, grammatical labels, cross-references, or reliable Arabic diacritics.

This approach is technically feasible without new third-party native dependencies because PDFKit ships with iPadOS. It still requires physical-iPad validation of document import, persistence across Playgrounds runs, page restoration, large-document memory use, and returning to the EPUB. It does not replace the existing Kaikki/Lane definitions or the independent CAMeL morphology engine.

## What remains unresolved

- No legitimate downloadable Hans Wehr PDF purchase source was verified here; the feature must not imply that purchasing a printed book supplies a digital license or digital file.
- No exact-match automatic Hans Wehr word/root index is delivered by PDF viewing alone.
- Full structured integration remains contingent on a suitable licensed source and extraction-quality checks. If the user supplies a legitimately usable structured file, we can assess its schema and build an adapter without changing the reader UI.
