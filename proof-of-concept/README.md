# Proof of Concept: Secure and Sovereign Out-of-Band Session Binding for Web Browsers

> Disclaimer: The source code of this proof of concept was written entirely by a large language model.

This proof of concept demonstrates the OOB session binding protocol with two use cases:

1. **Authentication** - Cross-device login using passkeys
2. **File Transfer** - Streaming file transfer from phone to browser

Both use cases use the same binding protocol; the difference is what gets negotiated and delivered.

## Directory Structure

```
proof-of-concept/
├── authentication/       # Cross-device login PoC
│   ├── service/          # Login page + protocol endpoints (port 3000)
│   └── app/              # Companion app simulator (port 3001)
├── file-transfer/        # File transfer PoC
│   ├── service/          # File receiver + streaming relay (port 3000)
│   └── app/              # File sender simulator (port 3001)
└── browser-extensions/
    ├── chrome/           # Chrome extension (Manifest V3)
    └── firefox/          # Firefox extension (Manifest V2)
```

---

## Authentication PoC

### Quick Start

Requirements:
- Node.js (tested on version 22.16.0)
- either
  - Firefox (tested on version 134.0.2)
  - Chrome (tested on version 140.0.7339.207)

#### 1. Start the Service

```bash
cd authentication/service
npm install
node server.js
```

The service runs on http://localhost:3000 with a REPL for inspecting state.

#### 2. Start the App

```bash
cd authentication/app
npm install
node server.js
```

The companion app runs on http://localhost:3001.

> **Why a server?** The app is just static HTML/JS, but WebAuthn requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (localhost or HTTPS). Opening the HTML file directly (`file://`) won't work.

#### 3. Install a Browser Extension

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in `browser-extensions/firefox`

**Chrome:**
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select `browser-extensions/chrome`

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

Demonstrates the protocol for file transfer, where the negotiated result is streaming connection info rather than static data.

### Quick Start

```bash
# Terminal 1 - Service (port 3000)
cd file-transfer/service
npm start

# Terminal 2 - App (port 3001)
cd file-transfer/app
npm start
```

### Demo Flow

1. Open http://localhost:3000 in a browser
2. Open http://localhost:3001 in another tab (simulating the phone app)
3. In the browser: click "Receive file from app"
4. In the app: select a file, paste the session info, click "Upload"
5. In the app: note the pairing code
6. In the browser: enter the pairing code
7. In the browser: click "Download file" to verify the transfer worked

### Key Difference

In authentication, the negotiated result is a session token (static data).

In file transfer, the negotiated result is connection info for a live streaming session. The service acts as a buffered relay between the app (uploader) and browser (downloader), with minimal memory footprint.
