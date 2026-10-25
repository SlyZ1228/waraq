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
  test -s "$output/AppIcon76x76@2x~ipad.png"
  test -s "$output/AppIcon83.5x83.5@2x~ipad.png"
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
