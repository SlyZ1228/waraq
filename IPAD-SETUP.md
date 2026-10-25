# Optional home-network browser setup

For the current iPad installation, use **[Swift Playgrounds](PLAYGROUNDS-SETUP.md)**. It requires no laptop server, certificates, or firewall changes.

The files `Start Waraq.cmd`, `Stop Waraq.cmd`, and `scripts/*ipad*` are retained from an earlier home-network browser setup. They require machine-specific configuration and are not a turnkey installation path for a fresh clone. Both launchers expect PowerShell 7.

## Local configuration

A configured installation uses:

- `.data/ipad/settings.json`: the laptop's chosen LAN address, interface name, and relative Caddy executable path.
- `Caddyfile`: the local HTTPS proxy and setup-page configuration. `Caddyfile.example` demonstrates the simpler HTTPS proxy.
- `.data/caddy/`: Caddy's local certificate-authority storage, including private keys. Keep this directory private.
- `.data/ipad/public/`: a generated setup page and public certificate profile.
- `.data/ipad/processes.json` and logs: runtime process ownership and troubleshooting information.

These local files are intentionally excluded from Git and releases. A source checkout contains no preconfigured Wi-Fi address, certificate fingerprint, signing key, or local browser library. The original machine-specific instructions are retained locally in `.data/IPAD-SETUP-local.md` when migrating an existing workspace.

## Existing configured installations

Use **Start Waraq.cmd** to start the configured services and **Stop Waraq.cmd** to stop them. The launchers validate the saved address and track their own processes. The laptop must be reachable when initially loading or updating the browser app and downloading resources.

In the current reader, install **Kaikki**, **Lane**, and the complete **offline morphology** pack in Settings. New analyses then work on-device, without the Python service. The separate canonical Python API remains for development and comparisons.

Browser storage belongs to the exact origin. Changing the address or port creates a separate library. Keep original EPUBs and export progress before changing origins.

## Certificate setup

If maintaining this optional HTTPS route, use your own local Caddy certificate and your configured address. Follow [Apple's certificate-trust instructions](https://support.apple.com/102390) only for your own server certificate. Do not bypass a certificate-warning page. Firewall changes, if needed, should remain limited to the configured executable, interface, and local subnet. Swift Playgrounds avoids this configuration entirely.
