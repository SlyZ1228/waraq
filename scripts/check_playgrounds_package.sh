#!/bin/bash
# Exercise Package.swift through Xcode, including the full shipped resource tree.
set -euo pipefail
version=$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')
project="$RUNNER_TEMP/Waraq-$version.swiftpm"
python3 - <<'PY'
from pathlib import Path
import hashlib
import io
import os
import json
import shutil
import urllib.request
import zipfile

# Pinned input data from our existing public release, not executable build tools.
url = 'https://github.com/SlyZ1228/waraq/releases/download/v0.2.3/Waraq-Playgrounds.zip'
with urllib.request.urlopen(url, timeout=90) as response:
    data = response.read()
assert hashlib.sha256(data).hexdigest() == 'c81b691a3d142d2653844740d63666fd8b676efac0f689b4468848f191d13253'
destination = Path('playgrounds/Waraq.swiftpm/Sources/WaraqData').resolve()
prefix = 'Waraq.swiftpm/Sources/WaraqData/'
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for entry in archive.infolist():
        if not entry.filename.startswith(prefix) or entry.is_dir():
            continue
        target = (destination / entry.filename[len(prefix):]).resolve()
        assert target.is_relative_to(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.read(entry))
assert (destination / 'dictionaries.sqlite').is_file()
print('Loaded the verified complete WaraqData tree for app-package validation.')
version = json.loads(Path('package.json').read_text())['version']
fresh = Path(os.environ['RUNNER_TEMP']) / f'Waraq-{version}.swiftpm'
shutil.copytree(Path('playgrounds/Waraq.swiftpm'), fresh,
                ignore=shutil.ignore_patterns('.swiftpm', '.build', '.DS_Store'))
PY

cd "$project"
xcodebuild -version
xcodebuild -workspace . -list -json > "$RUNNER_TEMP/package-schemes.json"
cat "$RUNNER_TEMP/package-schemes.json"
scheme=$(python3 -c 'import json,os; from pathlib import Path; schemes=json.loads((Path(os.environ["RUNNER_TEMP"])/"package-schemes.json").read_text())["workspace"]["schemes"]; assert len(schemes)==1,schemes; print(schemes[0])')
for platform in iphonesimulator iphoneos; do
  destination='generic/platform=iOS Simulator'
  if [ "$platform" = iphoneos ]; then destination='generic/platform=iOS'; fi
  xcodebuild -workspace . -scheme "$scheme" \
    -destination "$destination" \
    -derivedDataPath "$RUNNER_TEMP/WaraqPackageBuild" \
    CODE_SIGNING_ALLOWED=NO build > "$RUNNER_TEMP/package-build.log" 2>&1 || {
      tail -n 100 "$RUNNER_TEMP/package-build.log"
      exit 1
    }
python3 - <<'PY'
import os
from pathlib import Path
log = (Path(os.environ['RUNNER_TEMP']) / 'package-build.log').read_text()
for line in log.splitlines():
    if 'warning:' in line or 'error:' in line or '** BUILD ' in line:
        print(line)
assert '76x76@1x app icons only apply' not in log
assert 'Skipping duplicate build file' not in log
PY
  app="$RUNNER_TEMP/WaraqPackageBuild/Build/Products/Debug-$platform/Waraq.app"
  test -d "$app"
  test ! -d "$app/Resources"
  test -s "$app/WaraqData/dictionaries.sqlite"
  test -s "$app/AppIcon76x76@2x~ipad.png"
  codesign --force --sign - "$app"
  codesign --verify --deep --strict --verbose=2 "$app"
  python3 - "$app" <<'PY'
from pathlib import Path
import plistlib
import sys
app = Path(sys.argv[1])
with (app / 'Info.plist').open('rb') as source:
    info = plistlib.load(source)
assert info['CFBundleIcons~ipad']['CFBundlePrimaryIcon']['CFBundleIconName'] == 'AppIcon'
with (app / '_CodeSignature/CodeResources').open('rb') as source:
    files = plistlib.load(source)['files2']
for name in ['AppIcon76x76@2x~ipad.png', 'Assets.car', 'WaraqData/Web/index.html', 'WaraqData/dictionaries.sqlite']:
    assert 'hash2' in files[name] and 'cdhash' not in files[name], (name, files[name])
print('Verified complete', info['CFBundleSupportedPlatforms'], 'app, version', info['CFBundleShortVersionString'], 'with', len(files), 'sealed resources.')
PY
done
echo 'Both full app packages built and passed ad-hoc signing on macOS. iPad provisioning/launch still requires device testing.'
