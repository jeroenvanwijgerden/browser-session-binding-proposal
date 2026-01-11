# File Transfer - Receiver Webpage

This is the webpage that receives files. It runs on a **different origin** from the relay to demonstrate cross-origin OOB binding.

## What it does

1. User clicks "Receive file from app"
2. Page calls `navigator.outOfBandBinding.request()` with a `preNegotiate` callback
3. Browser extension performs handshake + initialize with the relay
4. **Pre-negotiation:** The page's callback runs, negotiating a download algorithm and registering a download public key with the relay
5. Extension shows the pairing UI with session info
6. User enters the pairing code (from the app)
7. Extension completes the ceremony, returning file metadata and download URL
8. Page calls the download endpoint with a signed request
9. Relay streams the file to the browser

## Running

```bash
npm install
npm start
```

The receiver runs on http://localhost:3000.

## Code

- `server.js` - Minimal static file server
- `public/index.html` - UI and protocol logic

## Key implementation details

**Cross-origin:** This page runs at `localhost:3000` but communicates with the relay at `localhost:3002`. This demonstrates that OOB binding works across origins when the server allows it.

**Pre-negotiation callback:** The `preNegotiate` option enables the page to perform arbitrary exchanges with the server before the pairing UI appears:

```javascript
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: `${RELAY_URL}/bind/handshake`,
  // ... other endpoints
}, {
  preNegotiate: async (session) => {
    // Step 1: Offer algorithms to server
    // Step 2: Generate keypair with server-selected algorithm
    // Step 3: Register public key with server
  }
});
```

**Download authentication:** The page proves it holds the private key by signing a message. The relay verifies the signature before streaming the file.

**Memory efficiency:** The file is downloaded as a blob and then offered to the user via the download dialog. This is cross-browser compatible but means the file is briefly held in memory. For very large files, the File System Access API (Chrome-only) would allow true streaming.
