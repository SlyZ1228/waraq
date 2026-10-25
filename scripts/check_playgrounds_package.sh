#!/bin/bash
# Exercise Package.swift through Xcode, including the full shipped resource tree.
set -euo pipefail
project="$PWD/playgrounds/Waraq.swiftpm"
python3 - <<'PY'
from pathlib import Path
import hashlib
import io
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
PY

cd "$project"
xcodebuild -version
xcodebuild -workspace . -list -json > "$RUNNER_TEMP/package-schemes.json"
cat "$RUNNER_TEMP/package-schemes.json"
scheme=$(python3 -c 'import json,os; from pathlib import Path; schemes=json.loads((Path(os.environ["RUNNER_TEMP"])/"package-schemes.json").read_text())["workspace"]["schemes"]; assert len(schemes)==1,schemes; print(schemes[0])')
xcodebuild -workspace . -scheme "$scheme" \
  -destination 'generic/platform=iOS Simulator' \
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
PY
app="$RUNNER_TEMP/WaraqPackageBuild/Build/Products/Debug-iphonesimulator/Waraq.app"
test -d "$app"
find "$app" -maxdepth 2 -type d
plutil -p "$app/Info.plist"
codesign --force --sign - "$app"
codesign --verify --deep --strict --verbose=2 "$app"
echo 'Full app package built and its complete resource tree passed simulator signing.'
