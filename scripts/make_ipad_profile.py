"""Create an iPad install profile containing only the PUBLIC local CA certificate."""
from pathlib import Path
import hashlib
import html
import json
import plistlib
import ssl
import uuid

ROOT = Path(__file__).resolve().parents[1]

def main():
    settings = json.loads((ROOT / '.data/ipad/settings.json').read_text(encoding='utf-8-sig'))
    address = settings['address']
    public = ROOT / '.data/ipad/public'
    public.mkdir(parents=True, exist_ok=True)
    pem = (ROOT / '.data/caddy/pki/authorities/local/root.crt').read_text(encoding='ascii')
    der = ssl.PEM_cert_to_DER_cert(pem)
    fingerprint = hashlib.sha256(der).hexdigest().upper()
    printable = ':'.join(fingerprint[i:i+2] for i in range(0, len(fingerprint), 2))
    certificate = {
        'PayloadType': 'com.apple.security.root', 'PayloadVersion': 1,
        'PayloadIdentifier': 'local.waraq.reader.root',
        'PayloadUUID': str(uuid.uuid5(uuid.NAMESPACE_URL, fingerprint + '/certificate')).upper(),
        'PayloadDisplayName': 'Waraq Reader — local certificate',
        'PayloadDescription': 'Trusts only the local certificate authority used by your Waraq laptop server. Contains no private keys, VPN, or device-management enrollment.',
        'PayloadCertificateFileName': 'waraq-ca.cer', 'PayloadContent': der,
    }
    profile = {
        'PayloadType': 'Configuration', 'PayloadVersion': 1,
        'PayloadIdentifier': 'local.waraq.reader',
        'PayloadUUID': str(uuid.uuid5(uuid.NAMESPACE_URL, fingerprint + '/profile')).upper(),
        'PayloadDisplayName': 'Waraq Reader', 'PayloadOrganization': 'Your local Waraq server',
        'PayloadDescription': 'Local HTTPS certificate for your Arabic reader. After installing, enable Waraq Reader in Certificate Trust Settings.',
        'PayloadRemovalDisallowed': False, 'PayloadContent': [certificate],
    }
    (public / 'waraq.mobileconfig').write_bytes(plistlib.dumps(profile))
    (public / 'waraq-ca.cer').write_bytes(der)
    (ROOT / '.data/ipad/certificate-sha256.txt').write_text(printable + '\n', encoding='ascii')
    url = 'https://' + address
    page = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Waraq on your iPad</title>
<style>body{{font:17px/1.7 -apple-system,system-ui,sans-serif;background:#faf9f5;color:#292e28;max-width:650px;margin:40px auto;padding:24px}}h1{{font-size:36px;letter-spacing:-1px}}li{{margin:18px 0}}a{{color:#526a50}}.button{{display:inline-block;background:#526a50;color:white;border-radius:8px;padding:12px 20px;text-decoration:none}}small{{font-size:12px;color:#687062}}code{{overflow-wrap:anywhere;font-size:11px}}aside{{background:#e9ede4;padding:18px;border-radius:10px}}</style>
<h1>Waraq · ورق</h1><p>Your Arabic reading space, on this iPad.</p>
<ol><li><a class="button" href="/waraq.mobileconfig">Download the Waraq certificate</a><br/>Tap <b>Allow</b> when Safari asks to download a configuration profile.</li>
<li>Open <b>Settings → General → VPN &amp; Device Management → Waraq Reader → Install</b>. Enter your iPad passcode if asked. This locally created profile is unsigned and contains only a root certificate.</li>
<li>Open <b>Settings → General → About → Certificate Trust Settings</b>. Enable full trust for the certificate whose name starts with <b>Waraq Reader</b>.</li>
<li>Return to Safari and <a href="{html.escape(url)}">open Waraq securely</a>. Use <b>Share → Add to Home Screen</b>. Then open the new icon to import books and download dictionaries.</li></ol>
<aside>Your laptop must stay awake for new word analyses. Downloaded books, dictionaries, and saved analyses work offline. Keep both devices on the same home Wi-Fi.</aside>
<p><small>This certificate allows your iPad to trust this laptop's local HTTPS authority. It does not enroll or manage the iPad. You can remove it later under VPN &amp; Device Management.</small></p>
<p><small>Certificate SHA-256 fingerprint:</small><br/><code>{printable}</code></p>
<p><a href="/waraq-ca.cer">Download just the public certificate</a> · <a href="https://support.apple.com/102390">Apple's trust instructions</a></p></html>'''
    (public / 'index.html').write_text(page, encoding='utf-8')
    print(f'Certificate profile ready. On iPad: http://{address}/')
    print(f'App address: {url}/')
    print(f'Public certificate SHA-256: {printable}')

if __name__ == '__main__':
    main()
