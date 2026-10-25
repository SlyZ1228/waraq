"""Build opaque iPad app icons from Waraq's existing dependency-free icon drawing."""
from pathlib import Path
import json
import sys

from make_sample import icon

CATALOG = Path(__file__).resolve().parents[1] / 'playgrounds/Waraq.swiftpm/Sources/Assets.xcassets'


def assets():
    images = []
    files = {}
    # iPadOS 17+ devices use Retina icons. The 76-point 1x slot is obsolete and
    # produces an asset-compiler warning in Swift Playgrounds 4.7.
    slots = [(size, 2, 'ipad') for size in (20, 29, 40, 76, 83.5)]
    slots += [(1024, 1, 'ios-marketing')]
    for size, scale, idiom in slots:
        filename = f'AppIcon-{size}@{scale}x.png'
        # RGB PNG with no alpha channel, metadata or pre-rounded corners.
        files[f'AppIcon.appiconset/{filename}'] = icon(int(size * scale))
        images.append({'filename': filename, 'idiom': idiom,
                       'size': f'{size}x{size}', 'scale': f'{scale}x'})
    info = {'author': 'xcode', 'version': 1}
    for path, data in [('Contents.json', {'info': info}),
                       ('AppIcon.appiconset/Contents.json', {'images': images, 'info': info})]:
        files[path] = (json.dumps(data, indent=2) + '\n').encode('utf-8')
    return files


def main():
    check = '--check' in sys.argv
    generated = assets()
    stale = [path for path in CATALOG.glob('AppIcon.appiconset/AppIcon-*.png')
             if path.relative_to(CATALOG).as_posix() not in generated]
    if check and stale:
        raise SystemExit('Obsolete generated icon files remain: ' + ', '.join(p.name for p in stale))
    for relative, expected in generated.items():
        path = CATALOG / relative
        if check:
            if not path.exists() or path.read_bytes() != expected:
                raise SystemExit(f'Icon asset missing or stale: {relative}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)
    for path in stale:
        path.unlink()
    count = sum(name.endswith('.png') for name in generated)
    print(f'{"Verified" if check else "Wrote"} {count} opaque iPad/marketing icon assets.')


if __name__ == '__main__':
    main()
