# File Transfer - Sender App

This simulates the companion app (e.g., a phone app) that sends files.

## What it does

1. User selects a file
2. User pastes session info from the browser extension
3. App calls `/bind/negotiate` with file metadata
4. Relay returns a pairing code and upload URL
5. App shows the pairing code and starts uploading
6. **Upload blocks** until the browser downloads the file
7. When complete, the upload request returns and the app shows success

## Running

```bash
npm install
npm start
```

The app runs on http://localhost:3001.

## Code

- `server.js` - Minimal static file server (no logic, just serves HTML)
- `public/index.html` - All the UI and upload logic

## Key implementation details

**Session info format:** The app accepts session info in two formats:
```json
{"url": "...", "session": "..."}       // Extension format
{"negotiateUrl": "...", "sessionId": "..."}  // Alternative format
```

**Upload secret:** The `/bind/negotiate` response includes an `upload_secret`. The app must include this in the `X-Upload-Secret` header when uploading. This binds the upload to the negotiate call.

**Blocking upload:** The upload request doesn't return until the browser has received the file. This is intentional - it provides backpressure and lets the app know when the transfer is complete.
