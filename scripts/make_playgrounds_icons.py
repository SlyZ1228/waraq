"""Build opaque iPad app icons from Waraq's existing dependency-free icon drawing."""
from pathlib import Path
import json
import sys

from make_sample import icon

CATALOG = Path(__file__).resolve().parents[1] / 'playgrounds/Waraq.swiftpm/Sources/Assets.xcassets'


def assets():
    images = []
    files = {}
    slots = [(size, scale, 'ipad') for size in (20, 29, 40, 76) for scale in (1, 2)]
    slots += [(83.5, 2, 'ipad'), (1024, 1, 'ios-marketing')]
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
    for relative, expected in assets().items():
        path = CATALOG / relative
        if check:
            if not path.exists() or path.read_bytes() != expected:
                raise SystemExit(f'Icon asset missing or stale: {relative}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)
    print('Verified 10 opaque iPad/marketing icon assets.' if check else 'Wrote 10 opaque iPad/marketing icon assets.')


if __name__ == '__main__':
    main()
