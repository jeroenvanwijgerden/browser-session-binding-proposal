// File Transfer Relay - demonstrates cross-origin OOB binding
//
// This is a standalone relay service that accepts requests from ANY origin,
// demonstrating the protocol's flexibility for non-phishing-sensitive use cases.
//
// Session state machine:
//   initialized -> pre-negotiated -> negotiated -> completed
//                                                -> expired (manual)
//
// Protocol endpoints:
//   POST /bind/handshake   - Algorithm negotiation (accepts any origin)
//   POST /bind/initialize  - Session creation
//   POST /bind/negotiate   - App provides file metadata, gets stream info
//   POST /bind/complete    - Browser gets file metadata + stream URL
//
// Pre-negotiation endpoint (file transfer specific):
//   POST /pre-negotiate     - Multi-step negotiation before UI shown
//     step=offer            - Page offers algorithms, server selects one
//     step=register         - Page registers download public key
//
// Streaming endpoints:
//   POST /stream/:id/upload    - App uploads file here (requires upload_secret)
//   POST /stream/:id/download  - Browser downloads file here (requires signature proof)
//
// Note: The upload endpoint blocks until the browser connects and receives the file.
// The upload_secret binds the upload to the negotiate call. For better security,
// a production implementation could use a keypair (app signs upload request).

const http = require('http');
const crypto = require('crypto');
const repl = require('repl');
const { PassThrough } = require('stream');

const PORT = 3002;

// In-memory state
const sessions = new Map();  // sessionId -> { state, fileMetadata, streamId, ... }
const streams = new Map();   // streamId -> { passthrough, fileMetadata, uploaderConnected, downloaderConnected }

// Parse JSON body
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Parse form body (application/x-www-form-urlencoded)
async function parseFormBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const params = new URLSearchParams(body);
        const result = {};
        for (const [key, value] of params) {
          result[key] = value;
        }
        resolve(result);
      } catch {
        resolve({});
      }
    });
  });
}

// Send JSON response
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function randomId() {
  return crypto.randomUUID();
}

function generatePairingCode() {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0');
}

function timestamp() {
  return new Date().toISOString().substr(11, 12);
}

// Request handler
async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // CORS - accept any origin (this is a cross-origin service)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Upload-Secret');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ==========================================================================
  // OOB Protocol Endpoints
  // ==========================================================================

  if (method === 'POST' && url.pathname === '/bind/handshake') {
    const body = await parseBody(req);
    const requestingOrigin = body.requesting_origin;
    console.log(`[${timestamp()}] HANDSHAKE: requesting_origin: ${requestingOrigin}`);
    console.log(`[${timestamp()}] HANDSHAKE: offered algorithms: ${body.algorithms?.join(', ')}`);

    // File transfer relay is a cross-origin service - accept any origin
    // This demonstrates the protocol's flexibility for non-phishing-sensitive use cases
    const reasons = [];

    if (!body.algorithms?.length) {
      reasons.push('no_compatible_algorithm');
    }

    if (reasons.length > 0) {
      console.log(`[${timestamp()}] HANDSHAKE: rejected (${reasons.join(', ')})`);
      return json(res, { type: 'rejected', reasons });
    }

    console.log(`[${timestamp()}] HANDSHAKE: accepted (cross-origin relay, any origin allowed)`);
    return json(res, {
      type: 'accepted',
      algorithm: body.algorithms?.[0] || 'Ed25519',
      pairing_code_specification: {
        type: 'enabled',
        characters: ['0','1','2','3','4','5','6','7','8','9'],
        length: 2
      }
    });
  }

  if (method === 'POST' && url.pathname === '/bind/initialize') {
    const body = await parseBody(req);
    const sessionId = randomId();

    sessions.set(sessionId, {
      publicKey: body.public_key,
      downloadPublicKey: null,  // Set during pre-negotiation
      state: 'initialized',
      createdAt: Date.now(),
      fileMetadata: null,
      streamId: null,
      pairingCode: null
    });

    console.log(`[${timestamp()}] INITIALIZE: session ${sessionId.substr(0, 8)}... created`);

    return json(res, {
      status: 'initialized',
      session_id: sessionId
    });
  }

  // Pre-negotiation: multi-step negotiation between page and server
  // This happens after initialize but before the browser shows the pairing UI.
  // Demonstrates the protocol's support for arbitrary back-and-forth exchanges.
  if (method === 'POST' && url.pathname === '/pre-negotiate') {
    const body = await parseBody(req);
    const sessionIdShort = body.session_id?.substr(0, 8) + '...';
    const session = sessions.get(body.session_id);

    if (!session) {
      console.log(`[${timestamp()}] PRE-NEGOTIATE: session ${sessionIdShort} not found`);
      return json(res, { error: 'unknown_session' }, 404);
    }

    if (session.state !== 'initialized') {
      console.log(`[${timestamp()}] PRE-NEGOTIATE: session ${sessionIdShort} not in initialized state`);
      return json(res, { error: 'invalid_state' }, 400);
    }

    // Step 1: Algorithm offer - page offers algorithms, server selects one
    if (body.step === 'offer') {
      const offered = body.algorithms || [];
      console.log(`[${timestamp()}] PRE-NEGOTIATE: session ${sessionIdShort} offered algorithms: ${offered.join(', ')}`);

      // Server selects first supported algorithm (we only support Ed25519)
      const supported = ['Ed25519'];
      const selected = offered.find(a => supported.includes(a));

      if (!selected) {
        console.log(`[${timestamp()}] PRE-NEGOTIATE: no compatible algorithm`);
        return json(res, { error: 'no_compatible_algorithm' }, 400);
      }

      session.downloadAlgorithm = selected;
      console.log(`[${timestamp()}] PRE-NEGOTIATE: session ${sessionIdShort} selected algorithm: ${selected}`);
      return json(res, { status: 'ok', algorithm: selected });
    }

    // Step 2: Key registration - page registers its public key
    if (body.step === 'register') {
      if (!session.downloadAlgorithm) {
        console.log(`[${timestamp()}] PRE-NEGOTIATE: must offer algorithms first`);
        return json(res, { error: 'algorithm_not_negotiated' }, 400);
      }

      if (body.algorithm !== session.downloadAlgorithm) {
        console.log(`[${timestamp()}] PRE-NEGOTIATE: algorithm mismatch`);
        return json(res, { error: 'algorithm_mismatch' }, 400);
      }

      session.downloadPublicKey = body.publicKey;
      session.state = 'pre-negotiated';  // Ready for app to negotiate
      console.log(`[${timestamp()}] PRE-NEGOTIATE: session ${sessionIdShort} download key registered (${body.algorithm})`);
      return json(res, { status: 'ok' });
    }

    return json(res, { error: 'invalid_step' }, 400);
  }

  if (method === 'POST' && url.pathname === '/bind/negotiate') {
    const body = await parseBody(req);
    const sessionIdShort = body.session_id?.substr(0, 8) + '...';
    const session = sessions.get(body.session_id);

    if (!session) {
      console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} not found`);
      return json(res, { error: 'unknown_session' }, 404);
    }

    if (session.state === 'expired') {
      console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} expired`);
      return json(res, { error: 'session_expired' }, 410);
    }

    if (session.state === 'negotiated') {
      console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} already negotiated`);
      return json(res, { error: 'already_negotiated' }, 400);
    }

    if (session.state !== 'pre-negotiated') {
      console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} pre-negotiation not complete (state: ${session.state})`);
      return json(res, { error: 'pre_negotiation_required' }, 400);
    }

    // Extract file metadata from payload
    const { fileName, fileSize, fileType } = body;
    if (!fileName || !fileSize) {
      console.log(`[${timestamp()}] NEGOTIATE: missing file metadata`);
      return json(res, { error: 'missing_file_metadata' }, 400);
    }

    // Create stream session
    const streamId = randomId();
    const pairingCode = generatePairingCode();
    const uploadSecret = randomId();  // Secret to authorize upload

    // Store file metadata and stream info
    session.state = 'negotiated';
    session.fileMetadata = { fileName, fileSize, fileType };
    session.streamId = streamId;
    session.pairingCode = pairingCode;

    // Create the streaming relay - include download public key for verification
    streams.set(streamId, {
      passthrough: new PassThrough(),
      fileMetadata: { fileName, fileSize, fileType },
      downloadPublicKey: session.downloadPublicKey,
      uploadSecret: uploadSecret,  // Required to upload
      uploaderConnected: false,
      downloaderConnected: false,
      downloaderFinished: false,
      bytesTransferred: 0,
      uploadResponse: null,  // Will hold the response object to send when download completes
      uploadResolve: null    // Will resolve when download completes
    });

    console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} - file "${fileName}" (${fileSize} bytes)`);
    console.log(`[${timestamp()}] NEGOTIATE: stream ${streamId.substr(0, 8)}... created, pairing code: ${pairingCode}`);

    return json(res, {
      status: 'negotiated',
      pairing_code: pairingCode,
      stream_id: streamId,
      upload_url: `http://localhost:${PORT}/stream/${streamId}/upload`,
      upload_secret: uploadSecret
    });
  }

  if (method === 'POST' && url.pathname === '/bind/complete') {
    const body = await parseBody(req);
    const sessionIdShort = body.session_id?.substr(0, 8) + '...';
    const session = sessions.get(body.session_id);

    if (!session) {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} not found`);
      return json(res, { error: 'unknown_session' }, 404);
    }

    if (session.state === 'expired') {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} expired`);
      return json(res, { error: 'session_expired' }, 410);
    }

    if (session.state !== 'negotiated') {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} pending`);
      return json(res, { status: 'pending' });
    }

    // Check pairing code
    if (body.pairing_code !== session.pairingCode) {
      console.log(`[${timestamp()}] COMPLETE: wrong pairing code`);
      return json(res, { status: 'error', reason: 'invalid_code' });
    }

    session.state = 'completed';
    console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} SUCCESS`);

    return json(res, {
      status: 'complete',
      result: {
        fileMetadata: session.fileMetadata,
        streamId: session.streamId,
        downloadUrl: `http://localhost:${PORT}/stream/${session.streamId}/download`
      }
    });
  }

  // ==========================================================================
  // Streaming Endpoints
  // ==========================================================================

  // Upload endpoint - App streams file here (requires upload_secret)
  // This endpoint BLOCKS until the browser connects and receives the file.
  const uploadMatch = url.pathname.match(/^\/stream\/([^/]+)\/upload$/);
  if (method === 'POST' && uploadMatch) {
    const streamId = uploadMatch[1];
    const streamSession = streams.get(streamId);

    if (!streamSession) {
      console.log(`[${timestamp()}] UPLOAD: stream not found`);
      return json(res, { error: 'stream_not_found' }, 404);
    }

    // Verify upload secret (from header)
    const uploadSecret = req.headers['x-upload-secret'];
    if (!uploadSecret || uploadSecret !== streamSession.uploadSecret) {
      console.log(`[${timestamp()}] UPLOAD: invalid upload secret`);
      return json(res, { error: 'invalid_upload_secret' }, 403);
    }

    if (streamSession.uploaderConnected) {
      console.log(`[${timestamp()}] UPLOAD: uploader already connected`);
      return json(res, { error: 'uploader_already_connected' }, 400);
    }

    streamSession.uploaderConnected = true;
    streamSession.uploadRequest = req;     // Save request to resume later
    streamSession.uploadResponse = res;    // Save response to send later
    console.log(`[${timestamp()}] UPLOAD: uploader connected for "${streamSession.fileMetadata.fileName}"`);

    // Pause upload until downloader connects - prevents buffering entire file
    req.pause();

    // Track bytes for logging
    req.on('data', (chunk) => {
      streamSession.bytesTransferred += chunk.length;
    });

    req.on('end', () => {
      console.log(`[${timestamp()}] UPLOAD: finished (${streamSession.bytesTransferred} bytes)`);
      streamSession.passthrough.end();
    });

    req.on('error', (err) => {
      console.log(`[${timestamp()}] UPLOAD: error - ${err.message}`);
      streamSession.passthrough.destroy(err);
    });

    // If downloader already connected, start flowing immediately
    if (streamSession.downloaderConnected) {
      console.log(`[${timestamp()}] UPLOAD: downloader already connected, starting transfer`);
      req.pipe(streamSession.passthrough, { end: true });
      req.resume();
    } else {
      console.log(`[${timestamp()}] UPLOAD: waiting for browser to connect...`);
    }

    return;
  }

  // Download endpoint - Browser downloads file here (requires signature proof)
  const downloadMatch = url.pathname.match(/^\/stream\/([^/]+)\/download$/);
  if (method === 'POST' && downloadMatch) {
    const streamId = downloadMatch[1];
    const streamSession = streams.get(streamId);

    if (!streamSession) {
      console.log(`[${timestamp()}] DOWNLOAD: stream not found`);
      return json(res, { error: 'stream_not_found' }, 404);
    }

    if (streamSession.downloaderConnected) {
      console.log(`[${timestamp()}] DOWNLOAD: downloader already connected`);
      return json(res, { error: 'downloader_already_connected' }, 400);
    }

    // Parse the proof body (supports both JSON and form data)
    const contentType = req.headers['content-type'] || '';
    let body;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = await parseFormBody(req);
    } else {
      body = await parseBody(req);
    }
    const { public_key, message, signature } = body;

    if (!public_key || !message || !signature) {
      console.log(`[${timestamp()}] DOWNLOAD: missing proof fields`);
      return json(res, { error: 'missing_proof' }, 400);
    }

    // Verify public key matches the one registered during initialize
    if (streamSession.downloadPublicKey !== public_key) {
      console.log(`[${timestamp()}] DOWNLOAD: public key mismatch`);
      return json(res, { error: 'invalid_public_key' }, 403);
    }

    // Verify signature
    try {
      const publicKeyBuffer = Buffer.from(public_key, 'base64');
      const signatureBuffer = Buffer.from(signature, 'base64');
      const messageBuffer = Buffer.from(message);

      const keyObject = crypto.createPublicKey({
        key: Buffer.concat([
          // Ed25519 public key DER prefix
          Buffer.from('302a300506032b6570032100', 'hex'),
          publicKeyBuffer
        ]),
        format: 'der',
        type: 'spki'
      });

      const valid = crypto.verify(null, messageBuffer, keyObject, signatureBuffer);

      if (!valid) {
        console.log(`[${timestamp()}] DOWNLOAD: signature verification failed`);
        return json(res, { error: 'invalid_signature' }, 403);
      }
    } catch (err) {
      console.log(`[${timestamp()}] DOWNLOAD: signature error - ${err.message}`);
      return json(res, { error: 'signature_error', detail: err.message }, 400);
    }

    streamSession.downloaderConnected = true;
    console.log(`[${timestamp()}] DOWNLOAD: signature verified, downloader connected for "${streamSession.fileMetadata.fileName}"`);

    // If uploader is waiting, start the transfer now
    if (streamSession.uploadRequest) {
      console.log(`[${timestamp()}] DOWNLOAD: resuming upload, starting transfer`);
      streamSession.uploadRequest.pipe(streamSession.passthrough, { end: true });
      streamSession.uploadRequest.resume();
    }

    // Set headers for file download
    const { fileName, fileSize, fileType } = streamSession.fileMetadata;
    res.writeHead(200, {
      'Content-Type': fileType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileSize,
      'Access-Control-Allow-Origin': '*'
    });

    // Pipe the passthrough stream to the response
    streamSession.passthrough.pipe(res);

    streamSession.passthrough.on('end', () => {
      console.log(`[${timestamp()}] DOWNLOAD: complete`);
      streamSession.downloaderFinished = true;

      // Signal the upload endpoint that we're done
      if (streamSession.uploadResponse) {
        console.log(`[${timestamp()}] DOWNLOAD: signaling upload complete`);
        json(streamSession.uploadResponse, { status: 'uploaded', bytes: streamSession.bytesTransferred });
        streamSession.uploadResponse = null;
      }

      // Cleanup after a delay
      setTimeout(() => streams.delete(streamId), 5000);
    });

    streamSession.passthrough.on('error', (err) => {
      console.log(`[${timestamp()}] DOWNLOAD: error - ${err.message}`);
      res.end();
    });

    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`File Transfer Relay running on http://localhost:${PORT}`);
  console.log('');
  console.log('This is a cross-origin service - accepts requests from any origin.');
  console.log('');
  console.log('REPL available. Useful commands:');
  console.log('  sessions        - Map of active sessions');
  console.log('  streams         - Map of active streams');
  console.log('  expire(id)      - Expire a session');
  console.log('  expireAll()     - Expire all sessions');
  console.log('');

  const r = repl.start('relay> ');

  // Log function that redisplays prompt after logging
  const log = (...args) => {
    console.log(...args);
    r.displayPrompt(true);
  };
  r.context.log = log;

  r.context.sessions = sessions;
  r.context.streams = streams;
  r.context.expire = (id) => {
    const session = sessions.get(id);
    if (session) {
      session.state = 'expired';
      log(`Session ${id} expired`);
    } else {
      log('Session not found');
    }
  };
  r.context.expireAll = () => {
    for (const [id, session] of sessions) {
      session.state = 'expired';
    }
    log(`Expired ${sessions.size} sessions`);
  };

  // Override console.log to redisplay prompt
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog(...args);
    r.displayPrompt(true);
  };
});
