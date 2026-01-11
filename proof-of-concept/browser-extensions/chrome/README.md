# Out-of-Band Binding PoC - Chrome Extension

Demo extension for evaluating the OOB binding protocol. Review the code if you're curious - it's ~200 lines total.

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory
4. "Out-of-Band Binding PoC" should appear in your extensions list

## Usage

The extension is always active. When a page calls `navigator.outOfBandBinding.request()`:

1. A window with session info to copy (click the extension icon to open it manually)
2. Paste the JSON into your companion app
3. Enter the pairing code back into the side panel
4. Click Complete

## Security Implementation

This extension implements several security-critical measures that would be required in any browser-native implementation of the OOB binding protocol.

### Origin Isolation (Phishing Resistance)

The extension **never trusts origin information from page context**. When a page dispatches a binding request event, a malicious page could include a spoofed `origin` field. Instead, the service worker derives the origin from `sender.tab.url`:

```javascript
// SECURITY: Do NOT trust origin from page context. Extract from sender.tab.url
// The page could dispatch fake events with a spoofed origin.
const tabUrl = new URL(sender.tab.url);
const origin = tabUrl.origin;
```

This origin is sent to the server in the handshake request as `requesting_origin`. The server decides whether to accept the binding based on its origin policy - this is where phishing resistance is enforced.

### Private Key Isolation

The Ed25519 keypair is generated inside the service worker with `extractable: false`:

```javascript
const keyPair = await crypto.subtle.generateKey(
  { name: 'Ed25519' },
  false,  // non-extractable
  ['sign', 'verify']
);
```

The private key never leaves the service worker context. Page JavaScript cannot access it - pages can only trigger the binding ceremony, not extract cryptographic material.

### Trusted UI

Pairing code entry happens in extension-controlled UI (popup window), not in page context. This prevents:
- Pages from intercepting the pairing code
- Pages from displaying fake pairing UI
- Pages from manipulating the completion flow

# Test report

2026-01-10: Manually tested on Chrome version 140.0.7339.207 (Official Build) (64-bit) (Linux)
