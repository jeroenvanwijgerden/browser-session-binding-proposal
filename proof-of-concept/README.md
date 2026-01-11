# Proof of Concept: Secure and Sovereign Out-of-Band Session Binding for Web Browsers

> Disclaimer: The source code of this proof of concept was written entirely by a large language model.

This proof of concept demonstrates the OOB session binding protocol with two use cases:

1. **Authentication** - Cross-device login using passkeys (same-origin)
2. **File Transfer** - Streaming file transfer from phone to browser (cross-origin)

Both use cases use the same browser extension and the same binding protocol. The difference is:
- **What gets negotiated:** a session token vs. streaming connection info
- **Origin policy:** authentication enforces same-origin; file transfer allows any origin

## Directory Structure

```
proof-of-concept/
├── browser-extensions/       # Shared by both use cases
│   ├── chrome/               # Chrome extension (Manifest V3)
│   └── firefox/              # Firefox extension (Manifest V2)
├── authentication/           # Cross-device login PoC
│   ├── service/              # Login page + protocol endpoints (port 3000)
│   └── app/                  # Companion app simulator (port 3001)
└── file-transfer/            # File transfer PoC
    ├── receiver/             # Receiver webpage (port 3000)
    ├── app/                  # Sender app simulator (port 3001)
    └── relay/                # Streaming relay service (port 3002)
```

## Browser Extension Setup (Required for Both PoCs)

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in `browser-extensions/firefox`

**Chrome:**
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select `browser-extensions/chrome`

---

## Authentication PoC

Demonstrates same-origin authentication where a companion app (e.g., a password manager) authenticates on behalf of the user.

### Requirements

- Node.js (tested on version 22.16.0)
- Firefox (tested on version 134.0.2) or Chrome (tested on version 140.0.7339.207)
- Browser extension installed (see above)

### Quick Start

```bash
# Terminal 1 - Service (port 3000)
cd authentication/service
npm install
node server.js

# Terminal 2 - App (port 3001)
cd authentication/app
npm install
node server.js
```

### Demo Flow

1. Open http://localhost:3001 (companion app) and register a passkey with username and service URL `http://localhost:3000`

2. Open http://localhost:3000 (service login page) and click "Login with OOB"

3. The browser extension popup appears with session info - copy the JSON

4. In the companion app, paste the session info and click "Load Session"

5. Select your identity and click "Login" - you'll receive a pairing code

6. Enter the pairing code in the extension popup and click "Complete"

7. The login page shows "Logged in as [username]"

### What's Implemented

**Protocol Endpoints:**
- `POST /bind/handshake` - Algorithm negotiation (Ed25519)
- `POST /bind/initialize` - Session creation with browser's public key
- `POST /bind/negotiate` - Companion app authenticates and binds to session
- `POST /bind/complete` - Browser completes with pairing code and signature

**Security Features:**
- Ed25519 signatures for browser-to-server binding
- Pairing codes (2-digit for demo) to prevent relay attacks
- Multi-negotiation detection (compromised session flag)
- WebAuthn/passkey authentication for the companion app

**Browser API:**
- `navigator.outOfBandBinding.request()` - Initiates the OOB ceremony

**Not Implemented (out of scope for PoC):**
- Persistent storage (everything is in-memory)
- Session timeouts (but can be triggered manually via REPL)
- Full signature verification (simplified for demo)
- Production-ready error handling

### Interesting Flows to Try

#### Happy Path
The normal flow described in "Demo Flow" above.

#### Compromised Session Detection
1. Start a login flow on the service page
2. Copy the session info to **two** companion app browser tabs
3. Load the session and negotiate in the first tab - get pairing code
4. Try to negotiate in the second tab - you'll see a "COMPROMISED" warning
5. The service REPL shows the compromise detection in logs

#### Session Expiration
1. Start a login flow and copy the session info
2. In the service REPL, run `sessions` to see active sessions
3. Run `expire('<session-id>')` or `expireAll()` to expire sessions
4. Try to complete the flow - you'll get a "session expired" error

#### Multiple Identities
1. Register multiple passkeys in the companion app (same or different service URLs)
2. When you load a session, you can choose which identity to authenticate as
3. The passkey table shows all registered credentials

---

## File Transfer PoC

Demonstrates cross-origin file transfer where a relay service bridges the sender app and receiver browser. This showcases:

- **Cross-origin support:** The receiver webpage (port 3000) communicates with the relay (port 3002)
- **Pre-negotiation phase:** The page registers a download key before the pairing UI appears
- **Streaming with backpressure:** Files transfer without buffering the entire file in memory

### Quick Start

```bash
# Terminal 1 - Receiver webpage (port 3000)
cd file-transfer/receiver
npm install
npm start

# Terminal 2 - Sender app (port 3001)
cd file-transfer/app
npm install
npm start

# Terminal 3 - Relay service (port 3002)
cd file-transfer/relay
npm install
npm start
```

### Demo Flow

1. Open http://localhost:3000 in a browser (the receiver)
2. Open http://localhost:3001 in another tab (simulating the phone app)
3. In the receiver: click "Receive file from app"
4. The extension opens a window with session info - copy the JSON
5. In the app: select a file, paste the session info, click "Upload"
6. Note the pairing code shown in the app
7. In the extension window: enter the pairing code and click Complete
8. The receiver shows "File ready!" - click "Download file"
9. The app shows "File sent successfully!" when the browser finishes downloading

### Key Differences from Authentication

| Aspect | Authentication PoC | File Transfer PoC |
|--------|-------------------|-------------------|
| Origin policy | Same-origin only | Any origin allowed |
| Negotiated result | Session token (static) | Stream URLs (live connection) |
| Pre-negotiation | Not used | Page registers download key |
| Phishing risk | High (credentials) | Low (file data) |

See `file-transfer/README.md` for detailed documentation of the streaming protocol.

---

## Code Organization

The code is intentionally written to be **readable and approachable** rather than highly optimized. Readers exploring the proposal can follow along with the implementation without needing deep expertise.

Each file includes comments explaining:
- What the component does
- How it fits into the protocol
- Key security considerations

### Entry Points for Reading

**Browser Extension (Firefox):**
- `browser-extensions/firefox/inject.js` - The `navigator.outOfBandBinding` API
- `browser-extensions/firefox/background.js` - Protocol logic and crypto
- `browser-extensions/firefox/popup.js` - Trusted UI interaction

**Authentication Service:**
- `authentication/service/server.js` - All four protocol endpoints + REPL

**File Transfer Relay:**
- `file-transfer/relay/server.js` - Protocol endpoints + streaming logic

---

## What This Demonstrates

1. **The protocol works.** Both authentication and file transfer complete successfully using the same browser extension and protocol structure.

2. **Flexibility via origin policy.** The server decides whether to accept cross-origin requests. Authentication rejects non-localhost; file transfer accepts any origin.

3. **Extensibility via pre-negotiation.** The file transfer PoC shows how pages can perform arbitrary protocol exchanges with the server before the pairing UI appears.

4. **Security properties hold.** Session hijacking is prevented by signatures. Session fixation is prevented by pairing codes. Multi-negotiation is detected and flagged.

5. **Browser extensions suffice.** The full protocol can be implemented without native browser support, enabling ecosystem development today.
