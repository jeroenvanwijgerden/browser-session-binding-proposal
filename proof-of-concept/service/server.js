// Service server for the OOB session binding protocol
//
// This implements the four protocol endpoints:
//   POST /bind/handshake   - Algorithm negotiation
//   POST /bind/initialize  - Session creation (browser sends public key)
//   POST /bind/negotiate   - Companion app authenticates and binds to session
//   POST /bind/complete    - Browser completes with pairing code and signature
//
// It also provides WebAuthn endpoints for passkey registration/authentication,
// which the companion app uses to prove identity during /bind/negotiate.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repl = require('repl');

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const PORT = 3000;

// WebAuthn relying party config
const rpName = 'OOB PoC Service';
const rpID = 'localhost';
const origin = `http://localhost:${PORT}`;

// In-memory state (cleared on restart)
const sessions = new Map();      // sessionId -> { publicKey, state, result, pairingCode, ... }
const passkeys = new Map();      // username -> { credentialId, publicKey, counter }
const challenges = new Map();    // username -> { challenge, type: 'register'|'auth' }

// Serve static files from public/
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  }[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(path.join(__dirname, 'public', filePath));
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

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

// Send JSON response
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Generate random ID
function randomId() {
  return crypto.randomUUID();
}

// Generate pairing code (2 digits for PoC simplicity)
function generatePairingCode() {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0');
}

// Timestamp for logs
function timestamp() {
  return new Date().toISOString().substr(11, 12);
}

// Request handler
async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // CORS for app server
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static files
  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
    return serveStatic(res, 'login.html');
  }

  // ==========================================================================
  // OOB Protocol Endpoints
  // ==========================================================================

  // Step 1: Handshake - negotiate cryptographic algorithm
  if (method === 'POST' && url.pathname === '/bind/handshake') {
    const body = await parseBody(req);
    console.log(`[${timestamp()}] HANDSHAKE: offered algorithms: ${body.algorithms?.join(', ')}`);
    if (body.algorithms?.includes('Ed25519')) {
      console.log(`[${timestamp()}] HANDSHAKE: accepted Ed25519, pairing code enabled (2 digits)`);
      return json(res, {
        type: 'accepted',
        algorithm: 'Ed25519',
        pairing_code_specification: {
          type: 'enabled',
          characters: ['0','1','2','3','4','5','6','7','8','9'],
          length: 2
        }
      });
    }
    console.log(`[${timestamp()}] HANDSHAKE: rejected (no compatible algorithm)`);
    return json(res, { type: 'rejected' });
  }

  // Step 2: Initialize - create session, receive browser's public key
  if (method === 'POST' && url.pathname === '/bind/initialize') {
    const body = await parseBody(req);
    const sessionId = randomId();

    sessions.set(sessionId, {
      publicKey: body.public_key,
      state: 'initialized',
      createdAt: Date.now(),
      result: null,
      pairingCode: null,
      negotiationCount: 0
    });

    console.log(`[${timestamp()}] INITIALIZE: session ${sessionId.substr(0, 8)}... created`);

    return json(res, {
      status: 'initialized',
      session_id: sessionId
    });
  }

  // Step 3: Negotiate - companion app authenticates and binds to session
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

    // Check for multi-negotiation
    if (session.state === 'negotiated') {
      session.compromised = true;
      console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} COMPROMISED - multiple negotiation attempts!`);
      return json(res, {
        status: 'compromised',
        message: 'Another device already completed negotiation for this session.'
      });
    }

    session.negotiationCount++;

    // Verify passkey assertion
    const { username, assertionResponse } = body;
    console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} attempting auth as "${username}"`);
    const passkey = passkeys.get(username);

    if (!passkey) {
      console.log(`[${timestamp()}] NEGOTIATE: user "${username}" not found`);
      return json(res, { error: 'unknown_user' }, 401);
    }

    const challengeData = challenges.get(username);
    if (!challengeData || challengeData.type !== 'auth') {
      console.log(`[${timestamp()}] NEGOTIATE: no valid challenge for "${username}"`);
      return json(res, { error: 'no_challenge' }, 401);
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: 'http://localhost:3001', // companion app origin
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: passkey.publicKey,
          counter: passkey.counter,
        },
      });

      if (!verification.verified) {
        console.log(`[${timestamp()}] NEGOTIATE: passkey verification failed for "${username}"`);
        return json(res, { error: 'verification_failed' }, 401);
      }

      // Update counter
      passkey.counter = verification.authenticationInfo.newCounter;
      challenges.delete(username);

    } catch (e) {
      console.log(`[${timestamp()}] NEGOTIATE: passkey error for "${username}": ${e.message}`);
      return json(res, { error: 'verification_failed', detail: e.message }, 401);
    }

    // Success - stage result
    const pairingCode = generatePairingCode();
    session.state = 'negotiated';
    session.result = { username };
    session.pairingCode = pairingCode;

    if (session.negotiationCount > 1) {
      session.compromised = true;
    }

    console.log(`[${timestamp()}] NEGOTIATE: session ${sessionIdShort} SUCCESS as "${username}", pairing code: ${pairingCode}`);

    return json(res, {
      status: 'negotiated',
      pairing_code: pairingCode
    });
  }

  // Step 4: Complete - browser proves key possession, provides pairing code
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

    // Verify signature (PoC: simplified - just check public key exists)
    // Real impl would verify Ed25519 signature
    if (!session.publicKey) {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} invalid signature`);
      return json(res, { error: 'invalid_signature' }, 403);
    }

    if (session.state !== 'negotiated') {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} pending (not yet negotiated)`);
      return json(res, { status: 'pending' });
    }

    // Check pairing code
    if (body.pairing_code !== session.pairingCode) {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} wrong pairing code (got "${body.pairing_code}", expected "${session.pairingCode}")`);
      return json(res, {
        status: 'error',
        reason: 'invalid_code',
        message: 'Pairing code does not match'
      });
    }

    // Success
    session.state = 'completed';
    const response = {
      status: 'complete',
      result: session.result
    };

    if (session.compromised) {
      response.compromised = true;
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} COMPLETE (with compromised flag!) as "${session.result.username}"`);
    } else {
      console.log(`[${timestamp()}] COMPLETE: session ${sessionIdShort} SUCCESS as "${session.result.username}"`);
    }

    sessions.delete(body.session_id);
    return json(res, response);
  }

  // ==========================================================================
  // WebAuthn Passkey Endpoints (used by companion app)
  // ==========================================================================

  // Registration: get challenge
  if (method === 'POST' && url.pathname === '/passkey/register/start') {
    const body = await parseBody(req);
    const { username } = body;

    if (passkeys.has(username)) {
      console.log(`[${timestamp()}] REGISTER START: user "${username}" already exists`);
      return json(res, { error: 'user_exists' }, 400);
    }

    console.log(`[${timestamp()}] REGISTER START: creating challenge for "${username}"`);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    challenges.set(username, {
      challenge: options.challenge,
      type: 'register'
    });

    return json(res, options);
  }

  // Registration: verify and store credential
  if (method === 'POST' && url.pathname === '/passkey/register/finish') {
    const body = await parseBody(req);
    const { username, attestationResponse } = body;

    const challengeData = challenges.get(username);
    if (!challengeData || challengeData.type !== 'register') {
      console.log(`[${timestamp()}] REGISTER FINISH: no valid challenge for "${username}"`);
      return json(res, { error: 'invalid_challenge' }, 400);
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: attestationResponse,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: 'http://localhost:3001', // companion app origin
        expectedRPID: rpID,
      });

      if (!verification.verified) {
        console.log(`[${timestamp()}] REGISTER FINISH: verification failed for "${username}"`);
        return json(res, { error: 'verification_failed' }, 400);
      }

      const { credential } = verification.registrationInfo;

      passkeys.set(username, {
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
      });

      challenges.delete(username);

      console.log(`[${timestamp()}] REGISTER FINISH: passkey registered for "${username}"`);
      return json(res, { status: 'registered' });

    } catch (e) {
      console.log(`[${timestamp()}] REGISTER FINISH: error for "${username}": ${e.message}`);
      return json(res, { error: 'verification_failed', detail: e.message }, 400);
    }
  }

  // Authentication: get challenge (used before /bind/negotiate)
  if (method === 'POST' && url.pathname === '/passkey/auth/start') {
    const body = await parseBody(req);
    const { username } = body;

    const passkey = passkeys.get(username);
    if (!passkey) {
      console.log(`[${timestamp()}] AUTH START: user "${username}" not found`);
      return json(res, { error: 'unknown_user' }, 404);
    }

    console.log(`[${timestamp()}] AUTH START: creating challenge for "${username}"`);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: passkey.credentialId,
      }],
      userVerification: 'preferred',
    });

    challenges.set(username, {
      challenge: options.challenge,
      type: 'auth'
    });

    return json(res, options);
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`Service server running on http://localhost:${PORT}`);
  console.log('');
  console.log('REPL available. Useful commands:');
  console.log('  sessions        - Map of active sessions');
  console.log('  passkeys        - Map of registered passkeys');
  console.log('  expire(id)      - Expire a session');
  console.log('  expireAll()     - Expire all sessions');
  console.log('');

  const r = repl.start('service> ');

  // Log function that redisplays prompt after logging
  const log = (...args) => {
    console.log(...args);
    r.displayPrompt(true);
  };
  r.context.log = log;

  r.context.sessions = sessions;
  r.context.passkeys = passkeys;
  r.context.challenges = challenges;
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
