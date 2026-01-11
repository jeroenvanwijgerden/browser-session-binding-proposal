# File Transfer - Relay Service

The relay is the backend service that:
- Implements the OOB binding protocol endpoints
- Manages streaming sessions
- Pipes data from uploaders to downloaders

## What it does

1. Accepts OOB handshake from **any origin** (cross-origin service)
2. Manages pre-negotiation (algorithm selection, download key registration)
3. Creates streaming sessions when the app negotiates
4. Holds upload requests open until downloaders connect
5. Verifies download signatures
6. Pipes data with backpressure (no full-file buffering)

## Running

```bash
npm install
npm start
```

The relay runs on http://localhost:3002 with an interactive REPL.

## Code

`server.js` contains everything:
- OOB protocol endpoints (`/bind/handshake`, `/bind/initialize`, etc.)
- Pre-negotiation endpoint (`/pre-negotiate`)
- Streaming endpoints (`/stream/:id/upload`, `/stream/:id/download`)
- REPL for debugging

## Protocol Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /bind/handshake` | Accept any origin, negotiate algorithm |
| `POST /bind/initialize` | Create session, store browser's public key |
| `POST /pre-negotiate` | Multi-step: algorithm offer, then key registration |
| `POST /bind/negotiate` | App provides file metadata, gets upload URL + pairing code |
| `POST /bind/complete` | Browser gets file metadata + download URL |

## Streaming Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /stream/:id/upload` | App uploads here (requires `X-Upload-Secret` header) |
| `POST /stream/:id/download` | Browser downloads here (requires signature proof) |

## Session State Machine

```
initialized -> pre-negotiated -> negotiated -> completed
                                            -> expired (manual)
```

## Key implementation details

**Cross-origin:** The handshake endpoint accepts any `requesting_origin`. This is safe for file transfer because it's not phishing-sensitive.

**Upload secret:** A random UUID returned by `/bind/negotiate`. The app must include it in the upload header. This prevents unauthorized uploads.

**Blocking uploads:** The upload endpoint doesn't respond until the download completes. This provides natural backpressure.

**No buffering:** Data flows through a PassThrough stream. The upload request is paused (`req.pause()`) until the downloader connects, then piped directly.

**Signature verification:** The download endpoint verifies an Ed25519 signature to ensure the downloader is the same page that registered the key during pre-negotiation.

## REPL Commands

- `sessions` - View active OOB sessions
- `streams` - View active streaming sessions
- `expire(id)` - Expire a session
- `expireAll()` - Expire all sessions
