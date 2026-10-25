# Publishing a Waraq release

1. Update the version in `package.json`/`package-lock.json`, the display/build versions in `playgrounds/Waraq.swiftpm/Package.swift`, release download links in README and the setup guide, and `CHANGELOG.md`.
2. With source data and dependencies prepared, run:

   ```powershell
   npm.cmd test
   npm.cmd run build
   npm.cmd run build:playgrounds
   .venv\Scripts\python.exe scripts\package_playgrounds.py
   ```

3. Inspect `releases/package-report.json` and `SHA256SUMS.txt`. Verify the complete project ZIP opens and every morphology checksum matches. Keep user books, `.data`, dependencies, certificates, and private keys outside Git and release assets. For native source changes, wait for the **Native Swift checks** GitHub workflow to pass before publishing; it compiles/links against the iOS SDK and runs resource-location regressions, but does not replace an on-device Playgrounds test.
4. Commit the source, create the matching version tag, and push the branch and tag. Use a GitHub draft release while uploading assets.
5. Attach `Waraq-Playgrounds.zip`, `Waraq-Lane-Source.zip`, `package-report.json`, and `SHA256SUMS.txt` from `releases/`. The Lane source asset preserves the upstream database with XML entries, notices, and conversion code alongside the distribution.
6. Describe actual test coverage and outstanding device checks. Mark previews as prereleases, then publish. Check the anonymous download URL and verify the downloaded app ZIP hash against the local checksum.

The full Playgrounds Resources folder is generated and intentionally excluded from source control. GitHub's automatic source archives are for development; the named Playgrounds release asset is the installable project.
