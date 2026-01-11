# File Transfer PoC

Demonstrates the OOB binding protocol for cross-origin file transfer, where:
- The relay service accepts requests from **any origin** (cross-origin policy)
- The receiver webpage runs on a **different origin** from the relay
- The negotiated result is streaming connection info rather than static data

This contrasts with the authentication PoC, which enforces same-origin policy.

## Directory Structure

```
file-transfer/
├── receiver/   # Receiver webpage (port 3000)
├── app/        # Sender app (port 3001)
└── relay/      # Backend relay service (port 3002, different origin)
```

## How it works

1. Receiver webpage (localhost:3000) calls `navigator.outOfBandBinding.request()` with relay endpoints
2. Browser extension performs handshake + initialize with relay (localhost:3002)
3. Receiver's `preNegotiate` callback runs: negotiates download algorithm, registers download public key
4. Extension opens a window showing session info to copy to the app
5. App receives the session info, selects a file, and calls `/bind/negotiate`
6. Relay creates a streaming session and returns a pairing code, upload URL, and upload secret
7. App shows pairing code and immediately starts uploading (with secret in header)
8. **Upload request blocks** - relay holds the response until browser receives file
9. User enters the pairing code in the extension window
10. Extension completes the ceremony and returns file metadata + download URL to the page
11. Receiver connects to download endpoint (with signature proof)
12. Relay pipes data from app's buffered upload to browser
13. When transfer completes, relay responds to app's upload request
14. App shows "done"

## Running

In three terminals:

```bash
# Terminal 1 - Receiver (port 3000)
cd receiver
npm start

# Terminal 2 - App (port 3001)
cd app
npm start

# Terminal 3 - Relay (port 3002)
cd relay
npm start
```

Then:
1. Install the browser extension (Chrome or Firefox - see `browser-extensions/`)
2. Open http://localhost:3000 in a browser (the receiver)
3. Open http://localhost:3001 in another tab (simulating the phone app)
4. In the receiver: click "Receive file from app"
5. The extension opens a window with session info
6. In the app: select a file, paste the session info, click "Upload"
7. In the app: note the pairing code shown (upload is now waiting)
8. In the extension window: enter the pairing code and click Complete
9. The receiver automatically downloads; app shows "done" when complete

## Cross-Origin Demo

The key point of this PoC is demonstrating cross-origin support:

- **Receiver** runs at `http://localhost:3000`
- **Relay** runs at `http://localhost:3002`
- These are different origins (different ports)

The relay's handshake endpoint accepts any `requesting_origin` because file transfer is not a phishing-sensitive operation. Compare this to the authentication PoC, where the service only accepts requests from `localhost` origins.

## Key difference from authentication PoC

| Aspect | Authentication PoC | File Transfer PoC |
|--------|-------------------|-------------------|
| Origin policy | Same-origin only | Any origin allowed |
| Negotiated result | Session token (static) | Stream URLs (live connection) |
| Service-webpage relationship | Same origin | Cross-origin |
| Phishing risk | High (credentials) | Low (file data) |

## Security note: upload_secret

When the app calls `/bind/negotiate`, the relay returns an `upload_secret` (a random UUID). The app must include this secret in the `X-Upload-Secret` header when uploading. This binds the upload to the negotiate call, preventing other parties from uploading to the stream.

**Production improvement:** For stronger security, the relay could require the app to sign its upload request with a keypair. During negotiate, the app would provide its public key. During upload, the app would sign the request, and the relay would verify the signature. This prevents an attacker who intercepts the upload_secret from hijacking the upload.
