# Offline / Playgrounds validation — 25 October 2026

## v0.2.4 actual app-package validation

The user reported continued `-67072` Run signing failure on `AppIcon76x76@2x~ipad.png`, plus the obsolete 76x76@1x warning, while the preview now loads. They could not locate Package.swift in Playgrounds to confirm the opened copy. The repeated DerivedData path suggests cached products or reuse of the same document path is possible, but this is not established as the cause.

Previous checks assembled a small app fixture and compiled Swift files directly; they did not exercise the app-package builder. The new workflow runs `xcodebuild -workspace .` on the real Package.swift with the complete WaraqData tree from a checksum-pinned public release. It resolves the generated scheme, builds for iOS Simulator and device, signs each entire app with an ad-hoc identity on macOS, checks the icon metadata and verifies resource hashes for the icon, Assets.car, HTML and SQLite. Device provisioning/launch is not performed.

The full package build also emits duplicate asset-catalog build-file warnings. They persisted when the explicit process rule was removed, so that experiment was reverted. These Xcode warnings remain non-blocking and are not reported as fixed. Obsolete 1x assets have been removed, and CI requires the reported 76x76@1x warning to be absent. Releases now extract to a versioned project filename to avoid ambiguous copies.

[Full package checks](https://github.com/SlyZ1228/waraq/actions/runs/40168509631) passed with Xcode 26.6: both iPhoneOS and iPhoneSimulator app products build and pass macOS ad-hoc signature verification, including all 167 bundled resources. The reported obsolete 76x76@1x warning is absent. AppIntents metadata and duplicate-catalog warnings remain non-fatal. [Native checks](https://github.com/SlyZ1228/waraq/actions/runs/40168509662) also passed, including all 12 resource-location cases.

A successful Run build on the iPad remains required. The prior reserved-folder test found a real macOS bundle-layout problem, but did not establish the cause of this persistent iPad error.

## v0.2.3 reserved data-folder signing fix

The user confirmed the same -67072 error in v0.2.2, now naming `AppIcon76x76@2x~ipad.png`, while a new blank App runs in Swift Playgrounds 4.7. Replacing the icon was insufficient. The previous signing fixture omitted the copied Resources directory and therefore missed this packaging defect.

Apple's [bundle signing rules](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/bundlediskrep.cpp#L638-L680) differ when a separate Resources directory exists; files adjacent to it can be classified as nested code. The new package preserves the data tree under the non-reserved name `WaraqData`, and native lookup accepts that name in both main and SwiftPM resource bundles.

The regression first signs a flat simulator app, adds a root Resources/Web/index.html file, and confirms signing fails. It then changes only the directory name to WaraqData and requires signing and strict verification to succeed. Finally it inspects CodeResources to ensure the icon, Assets.car and HTML have content hashes rather than nested-code signatures. The macOS rejection is a bundle-format error, not a reproduction of the exact iPad OSStatus code.

[Native CI passed](https://github.com/SlyZ1228/waraq/actions/runs/40167230524): native compile/link, both icon compiler targets, the old/new folder signing comparison, resource-seal inspection and all 12 resource-location checks. The 12 shared-reader tests and both frontend builds also passed. Release ZIP CRC/source parity, the absence of Sources/Resources, all 129 morphology hashes and packaged SQLite integrity passed.

The final physical-iPad build, launch, offline lookup and persistence checks remain outstanding. Extract into a fresh folder so the old generated Sources/Resources tree is not retained.

## v0.2.2 icon signing workaround

The next on-device build failed during signing with `NSOSStatusErrorDomain -67072` and a component path ending in `_PlaceholderAppIcon76x76@2x~ipad.png`. Apple's [code-signing error definitions](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/CSCommon.h) name this code `errSecCSUnimplemented`; the code alone does not establish the underlying cause. Waraq now uses a processed `AppIcon` asset catalog instead of Playgrounds' generated placeholder.

- Release ZIP CRC and source parity checks pass. All ten icons decode as square, 8-bit RGB PNGs with no alpha, correct dimensions and valid CRCs. All 129 bundled morphology files match their manifest hashes. SQLite integrity passes during packaging.
- [Native Mac runner checks](https://github.com/SlyZ1228/waraq/actions/runs/40166440238) passed: native compile/link, all eight resource-location regressions, Apple asset compilation for both device and simulator, and ad-hoc signing plus strict signature verification of a simulator app fixture containing the native executable and compiled icons.
- This cannot reproduce Swift Playgrounds' on-device signing/provisioning. Confirm successful build and launch on the iPad Air M3; then test the native bridge, offline lookup, library persistence and PDF/File interfaces.
- Download the new project ZIP into a fresh Files folder. Keep the old project and any user-library backups. A remaining error naming `_PlaceholderAppIcon` can indicate an old project or cached build; check that the open Package.swift uses `appIcon: .asset("AppIcon")`.

## v0.2.1 native compile fix

The user reported that v0.2.0 did not compile in Swift Playgrounds: `Bundle` had no `module` member and `nil` lacked a contextual type in the same resource lookup. The generated accessor has been replaced by app-owned bundle discovery with validation of the expected Web/dictionary tree. The manifest still copies the Resources directory intact.

- [GitHub native checks](https://github.com/SlyZ1228/waraq/actions/runs/40165233659) passed: all native Swift sources compiled and linked using the iOS Simulator SDK with an iOS 17 deployment target and Swift 5 language mode.
- Eight Swift regression checks passed on macOS: copied Resources folder, resources at the bundle root, embedded SwiftPM bundle, renamed embedded bundle, incomplete resources, missing resources, main-bundle preference, and Foundation's macOS resourceURL layout.
- This is not a physical-iPad or Swift Playgrounds packaging/runtime test. The iPad still needs to open the v0.2.1 ZIP and run it, including verifying WKWebView asset loading, native storage, and the Files/PDF interfaces.

## Earlier shared-reader checks

This section supersedes the older Phase 1 limitations below. Windows validates the shared web code, packaged data, and bridge contract; Swift Playgrounds lifecycle behavior still needs physical-device validation.

## Completed checks

- `npm test`: 12 tests pass across three files. Coverage includes browser persistence/integrity plus native bridge binary encoding, metadata loading, normalized SQLite lookup arguments, and analysis caching without IndexedDB.
- Offline morphology parity: **568 words**, **529 with analyses**, compared against canonical CAMeL Tools 1.6.0 using the same MSA database. Every returned field, candidate ordering, and total matched (engine-version labels intentionally differ). Corpus includes weak/doubled verbs, vocalized forms, clitics, named roots, and reproducible sampled stems. This is a software parity check, not comprehensive linguistic validation.
- Both production web builds pass TypeScript and Vite. Browser bundle-size warning remains non-blocking. Native bundle explicitly defines production React mode, passes JavaScript syntax checking, and contains no unresolved `process.env.NODE_ENV` or `import.meta`.
- The exact packaged IIFE/CSS/assets also passed a browser smoke test on a separate temporary origin: library startup, sample EPUB import/rendering with embedded fonts, and local كتاب analysis (39 readings). This tests the bundled frontend, not the Swift bridge or native SQLite implementation.
- ZIP integrity passes. All 129 morphology resource checksums match, and the packaged JavaScript matches the final build. Archive is about 28 MB, 177.6 MB expanded. No user books, certificates, private keys, venv, or Python runtime are packaged.
- Native SQLite integrity check passes. Queries for كتاب, استكشف, مدرسة, and root كشف return expected sources; Lane entries retain multiple structured sense blocks. Native index contains 36,974 Kaikki definition/form rows and 47,919 Lane rows; glossless rows are filtered.
- Browser UI: sample import; custom title/author editing; full reload retains edits; left/right page-edge buttons navigate 0% → 17% → 0%; reopening retains position.
- Sidebar reflow regression fixed: opening at 17% reflows the text to 11% in a narrower layout; closing returns to the same original page at 17%. The text CFI is retained across layout changes instead of replacing it with an earlier page boundary. Displayed percentage remains approximate and layout-dependent.
- Installed Kaikki, updated Lane, and the full morphology pack through Settings. With the static server stopped and no API available on that origin, a full reload still opened the library and EPUB. Previously unseen يستكشف returned six local analyses; وبالكتاب returned 24, including prefix grammar. Both showed **on-device analysis**, not a saved result. Root navigation and Lane definitions also worked offline.
- Lane reading layout visually checked: separate source sense divisions, emphasized English glosses, clickable Arabic references, original-paragraph option. Screenshots: `research/screenshots/offline-morphology.png` and `research/screenshots/lane-reading-layout.png`.

## Remaining iPad checks

Owned temporary preview servers on ports 4173 and 4174 were stopped after validation. The earlier user-requested server setup was left intact. Use `Preview Waraq.cmd` to start the new laptop preview.

Follow `PLAYGROUNDS-SETUP.md` with the complete `releases/Waraq-Playgrounds.zip`.

1. Open and compile in Swift Playgrounds on the iPad Air M3; verify the native bridge and bundled SQLite access.
2. Import an EPUB through Files. Turn pages, select/tap words, rotate, use Split View, and reopen the same project; verify settings, metadata, bookmarks, and reading position.
3. In airplane mode, analyze an unseen word and follow a root into both bundled dictionaries.
4. Test progress export/import through native file pickers and preserve originals before project replacement. Container behavior during project duplication/deletion is not verified.
5. When a lawful personal PDF is available, test import, page navigation, last-page persistence, and root bookmarks. No PDF or Hans Wehr content was supplied for this check.
6. Measure device memory and responsiveness, especially large EPUBs/PDFs and fallback analysis if blob workers are unavailable. Broader publisher EPUB coverage remains needed.

---

## Historical browser/API validation

The following notes describe the earlier service-backed implementation; requirements for a running morphology server and the absence of full offline morphology no longer apply to the new build.
# Phase 1 validation — 24 October 2026

## Automated checks

- `npm run build`: TypeScript and production Vite/PWA build pass. The app shell precaches about 1.2 MB; dictionary chunks are explicitly excluded. Vite reports a non-blocking bundle-size warning for the EPUB/React application bundle.
- `npm test`: 7 tests pass: duplicate import preserves progress/bookmarks; matching-hash backup restoration; vowel/root dictionary indexing; corrupt/incomplete pack rejection; cached analysis without network; distinct supplied-harakat cache keys; normalization/pattern handling.
- `.venv\Scripts\python.exe -m pytest server\test_morphology.py -q`: 8 tests pass against the actual CAMeL Morph MSA database, not a fake analyzer.
- `npm audit` during final dependency installation: zero known vulnerabilities. EPUB.js 0.3.93 uses an explicit `@xmldom/xmldom` 0.9.12 override. This is not a comprehensive security review.
- Live HTTP checks: health ready; يستكشف returns 6 readings, كتب 30, كَتَبَ 1, وبالكتاب 24; invalid non-Arabic input returns HTTP 422. Local warm service requests took 5–6 ms in this test, excluding iPad/network latency and initial database startup.

## Browser checks completed

Tested in the desktop Chromium-based in-app browser, with a production service worker and the real source data.

- Original three-chapter Arabic EPUB imports, shows a cover/title/author, and renders RTL text with Noto Naskh Arabic.
- Real file chooser imports the same `public/sample.epub` while the servers are off. Library stays at one book and retains 17% progress.
- Tapping يستكشف on the page opens its vocalization, root ك ش ف, Form X pattern, and grammar. The alternative-readings dropdown distinguishes active/passive and indicative/subjunctive/jussive.
- Kaikki installs all 233,417 source rows; Lane installs all 47,919. Kaikki's updated pack also installs successfully and retains per-sense usage labels, such as the obsolete verbal-noun sense under كتاب.
- Root navigation finds Lane entries; expanding كشف shows its actual English explanation. Clicking فرج inside that entry opens another lookup; sidebar back returns to the earlier lookup.
- Page navigation, bookmark creation, and reopening after a full reload restore the saved page. A discovered font-load/pagination race was fixed by restoring the CFI after the reader font loads.
- Dusk theme is visibly a soft charcoal background, and remains selected after reloading. All four theme controls, font-size/line-spacing controls, and tap-lookup toggle are present.
- Production service-worker updates apply through the visible Update prompt and keep the local library/dictionaries.
- **Offline smoke test:** stopped both the Python API/static server and Vite. A full reload still opens the bookshelf and EPUB. Previously viewed يستكشف shows its cached CAMeL analysis and downloaded definition. Unseen مدرسة shows local Kaikki and Lane definitions and explicitly reports that new morphology requires the service.
- Responsive layout inspected at 1024×768 landscape and 768×1024 portrait. Portrait DOM measurements: reader 418 px plus dictionary 350 px; no horizontal overflow. At 640 px split-view width the dictionary becomes a bottom sheet. This does not emulate Safari or touch input.
- A screenshot of the working reader is saved in `research/screenshots/reader.jpg`.

Owned preview servers were stopped after testing. Start the service using `scripts/start.ps1` when trying the app again.

## Still requires device/content testing

- Physical iPad Safari/Home Screen installation over trusted HTTPS; long-press selection, rotation, keyboard behavior, and Split View on-device.
- Storage eviction, memory use, download duration, and offline behavior on the user's actual iPad. An update may temporarily require space for both dictionary versions.
- A broader sample of publisher EPUBs, especially image-heavy, fixed-layout, unusual font-obfuscation, or malformed files. The current target is DRM-free reflowable text.
- A linguistically reviewed benchmark across many words and sentences. The small integration suite verifies wiring and representative cases, not comprehensive linguistic accuracy. MSA coverage, lexical ambiguity, and partial vowel marks remain explicit limitations.
- Public hosting/authentication, cross-device synchronization, PDF reading, Hans Wehr licensing/integration, and a browser-based full offline morphology engine are not implemented in this phase.

## Manual acceptance check on iPad

1. Follow the HTTPS steps in README; add Waraq to Home Screen, then launch that icon.
2. Import a personal DRM-free EPUB and download both dictionaries.
3. Tap an unvowelled word, compare alternative readings, follow a root, and navigate back.
4. Turn a page, add a bookmark, select Dusk, close the app, and reopen it.
5. Disable Wi-Fi. Reopen the book and a previously viewed word; try an unseen word and confirm the offline limitation is clear.
6. Export progress, retain the original EPUB in Files, and keep the backup separately.
