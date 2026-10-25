# Waraq on your iPad through Swift Playgrounds

Targets iPadOS 17 or newer, including iPad Air M3. EPUB reading, Kaikki, Lane, and CAMeL morphology are bundled. No laptop server, certificate, website publication, or App Store submission is needed.

**Preview status:** the shared reader and offline analyzer have been tested on Windows. Native Swift sources compile and link against the iOS Simulator SDK in GitHub's macOS CI, with resource-location regression tests passing. Running the complete project in Playgrounds on an iPad is still the remaining compatibility check. This is a source app project, not an already signed `.ipa` installer.

Version **0.2.3** moves the bundled data into `WaraqData`. A top-level folder named `Resources` conflicts with Apple's bundle/signing layout and can make the signer reject nearby files, including the app icon. The icon-only change in 0.2.2 did not solve the reported `-67072` failure. This version retains the earlier compiler fixes. Open the newly downloaded project, not the previous copy still open in Playgrounds. Keep the previous project until the new one opens successfully.

## Transfer and run

1. Install Apple's **Swift Playgrounds** on the iPad if needed.
2. On the iPad, **[download Waraq-Playgrounds.zip](https://github.com/SlyZ1228/waraq/releases/download/v0.2.3/Waraq-Playgrounds.zip)** and save it to Files. You can also transfer it from another computer. Use this named release asset, not GitHub's **Source code (zip)** download. It is about 28 MB compressed and 178 MB expanded. Leave extra room for compilation and books.
3. Save the new ZIP in a fresh Files folder (for example, **Waraq 0.2.3**), then tap it to extract it. Keep the complete **`Waraq.swiftpm`** project together; do not transfer only `Package.swift` or `Sources`.
4. Open `Waraq.swiftpm` in Swift Playgrounds. If Files does not open it directly, try **Share → Swift Playgrounds**, or Playgrounds' document browser. Exact wording may vary by version.
5. Tap **Run**. Initial compilation may take a little time. If offered, **Run App** opens the app in its own window.
6. Choose **Try a short Arabic read**, then **Add a book** to import DRM-free EPUBs from Files.

Return through Swift Playgrounds to launch the app. This workflow does not create a separately distributed App Store app. The dictionaries and morphology need no additional downloads inside the project.

For this update, extract into a fresh folder rather than merging files into the old project: `Sources` should contain **WaraqData**, with no sibling folder named **Resources**. Package.swift should use `.copy("WaraqData")`. Close the old project and open the new copy. If a compiler or signing error persists, keep the project and send the full error message and its filename. Do not delete the project or its data while troubleshooting.

## First checks

- Tap either full-height edge of the reading area. For Arabic books, left advances and right goes back. The text area still supports word lookup and selection.
- On the bookshelf, use **… → Edit title & author**. These are displayed library details; the original EPUB remains unchanged.
- Open a Lane entry. **Reading layout** separates source sense divisions and highlights English glosses. **Original paragraph** retains the continuous source text. The formatting does not modernize Lane's wording or choose a meaning for you.
- In airplane mode, search a word you have never viewed, such as `وبالكتاب` or `يستكشف`. Morphology and both dictionaries should work. Links to external source websites need a connection.
- Turn a page, add a bookmark, choose a theme, close the app, and reopen the **same project**. Check position, custom book details, bookmark, and theme.

## Library and backups

Imported EPUBs are copied into local application storage. Books, reading positions, bookmarks, displayed metadata, and preferences persist across ordinary launches. This storage is separate from the project source and from originals in Files; no folder synchronization is performed.

Keep original EPUBs. **Settings → Back up progress** exports JSON through the Files picker. To move laptop progress, export there, import the exact same original EPUBs on the iPad, then choose **Restore progress**. Files are matched by their original hash.

Before replacing, renaming, duplicating, or deleting the Playgrounds project, export progress and retain original books. Playgrounds' container behavior during project changes has not been verified here. Deleting the app or its container can remove the library. Progress backups do not contain EPUBs or personal PDF references.

## Optional Hans Wehr reference

No Hans Wehr text or PDF is included. This research did not verify a publisher-authorized reusable structured dataset/API.

If you later obtain a lawful PDF, choose **Settings → Personal dictionary PDF → Import dictionary PDF**. From the word explorer, **Open personal dictionary PDF** opens it. Navigate to the appropriate physical PDF page and tap **Save root here**. Later lookups of that root open the saved page; the PDF also remembers its last page.

The viewer does not extract definitions, guess pages, or OCR scans. Root mappings are tied to the PDF fingerprint, so another edition does not reuse incorrect page numbers. The viewer is implemented but still needs an iPad test with a PDF.

## Laptop testing

Double-click **Preview Waraq.cmd**, then visit **http://127.0.0.1:4173/**. In browser Settings, download Kaikki, Lane, and the **37 MB offline morphology** pack once. The iPad project already includes them.

Windows tests the shared reader, dictionary presentation, and analyzer. Swift compilation, native file pickers, PDFKit, WKWebView behavior, rotation, and touch require iPad testing.

Use the same preview address to retain that browser library. Your earlier `http://localhost:8000` library remains separate and its launcher is retained. Apply the update prompt if shown. The new reader no longer calls the Python analysis service.
