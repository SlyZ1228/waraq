#!/bin/bash
# Run on macOS after compiling the native shell to $RUNNER_TEMP/Waraq.
# This exercises Apple's asset compiler and a simulator app's resource seal.
# It does not reproduce Swift Playgrounds' on-device provisioning/signing.
set -euo pipefail

project="playgrounds/Waraq.swiftpm"
app="$RUNNER_TEMP/WaraqIconCheck.app"
mkdir -p "$app"
python3 scripts/make_playgrounds_icons.py --check

for platform in iphonesimulator iphoneos; do
  output="$RUNNER_TEMP/WaraqIcons-$platform"
  mkdir -p "$output"
  xcrun --sdk "$platform" actool "$project/Sources/Assets.xcassets" \
    --compile "$output" --platform "$platform" \
    --minimum-deployment-target 17.0 --target-device ipad \
    --app-icon AppIcon --output-partial-info-plist "$output/IconInfo.plist" \
    --output-format human-readable-text --warnings --errors
  test -s "$output/Assets.car"
  # Modern actool stores the remaining sizes in Assets.car, not loose PNGs.
  test -s "$output/AppIcon76x76@2x~ipad.png"
done

cp "$RUNNER_TEMP/Waraq" "$app/Waraq"
cp "$RUNNER_TEMP/WaraqIcons-iphonesimulator/Assets.car" "$app/"
cp "$RUNNER_TEMP/WaraqIcons-iphonesimulator/"*.png "$app/"
python3 - <<'PY'
import os
import json
import plistlib
from pathlib import Path

temp = Path(os.environ['RUNNER_TEMP'])
version = json.loads(Path('package.json').read_text())['version']
with (temp / 'WaraqIcons-iphonesimulator/IconInfo.plist').open('rb') as source:
    info = plistlib.load(source)
assert info['CFBundleIcons~ipad']['CFBundlePrimaryIcon']['CFBundleIconName'] == 'AppIcon'
info.update(CFBundleExecutable='Waraq', CFBundleIdentifier='local.waraq.reader',
            CFBundleName='Waraq', CFBundlePackageType='APPL',
            CFBundleShortVersionString=version, CFBundleVersion='1',
            CFBundleSupportedPlatforms=['iPhoneSimulator'],
            MinimumOSVersion='17.0', UIDeviceFamily=[2])
with (temp / 'WaraqIconCheck.app/Info.plist').open('wb') as target:
    plistlib.dump(info, target)
PY

codesign --force --sign - "$app"
codesign --verify --deep --strict --verbose=2 "$app"
echo 'iPad icon assets compiled for device and simulator; simulator app signature verified.'

# Reproduce the reserved Resources directory layout, which the previous fixture
# omitted. macOS can reject the bundle outright; iPad signing can instead select
# nested-code rules and fail on a root icon. Do not claim identical OSStatus codes.
legacy="$RUNNER_TEMP/WaraqLegacyLayout.app"
cp -R "$app" "$legacy"
mkdir -p "$legacy/Resources/Web"
echo '<!doctype html><title>Fixture</title>' > "$legacy/Resources/Web/index.html"
if codesign --force --sign - "$legacy" > "$RUNNER_TEMP/legacy-signing.log" 2>&1; then
  echo 'Unexpected: the legacy Resources layout signed successfully.'
  exit 1
fi
cat "$RUNNER_TEMP/legacy-signing.log"
python3 - <<'PY'
import os
from pathlib import Path
log = (Path(os.environ['RUNNER_TEMP']) / 'legacy-signing.log').read_text()
assert ('bundle format unrecognized, invalid, or unsuitable' in log or
        ('In subcomponent:' in log and ('AppIcon' in log or 'Assets.car' in log))), log
print('Reproduced: adding a root Resources directory breaks bundle signing on macOS.')
PY

# Change only the data directory name, then repeat the identical signing check.
mv "$legacy/Resources" "$legacy/WaraqData"
codesign --force --sign - "$legacy"
codesign --verify --deep --strict --verbose=2 "$legacy"
python3 - <<'PY'
import os
import plistlib
from pathlib import Path
manifest = Path('playgrounds/Waraq.swiftpm/Package.swift').read_text()
assert '.copy("WaraqData")' in manifest and '.copy("Resources")' not in manifest
app = Path(os.environ['RUNNER_TEMP']) / 'WaraqLegacyLayout.app'
with (app / '_CodeSignature/CodeResources').open('rb') as source:
    files = plistlib.load(source)['files2']
for name in ['AppIcon76x76@2x~ipad.png', 'Assets.car', 'WaraqData/Web/index.html']:
    assert 'hash2' in files[name] and 'cdhash' not in files[name], (name, files[name])
print('PASS: renaming only Resources to WaraqData restores signing; icons and data are sealed as resources.')
PY
