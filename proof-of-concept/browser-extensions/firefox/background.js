// Firefox Extension Background Script
//
// This handles the protocol logic for OOB session binding:
// 1. Receives binding requests from inject.js (via content-script.js)
// 2. Performs handshake + initialize with the service
// 3. If pre-negotiation requested, waits for page to complete it
// 4. Opens a popup window for trusted UI
// 5. Waits for user to enter pairing code, then calls /bind/complete
//
// The private key never leaves this context - pages cannot access it.
//
// FIREFOX QUIRK: We use browser.storage.local to share ceremony state with
// the popup, because message passing gets blocked while this script awaits
// the completion promise. Chrome doesn't have this issue.

const ceremonies = new Map();  // tabId (as string) -> ceremony state

// Resolve endpoint URL: if it starts with http(s), use as-is; otherwise prepend origin
function resolveEndpoint(origin, endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return origin + endpoint;
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'get-status') {
    // Use string key for consistent lookup
    const ceremony = ceremonies.get(String(message.tabId));
    return Promise.resolve({ ceremony: ceremony || null });
  }

  if (message.type === 'get-any-ceremony') {
    // Return the first active ceremony (for sidebar)
    for (const [tabKey, ceremony] of ceremonies) {
      return Promise.resolve({ ceremony, tabId: parseInt(tabKey, 10) });
    }
    return Promise.resolve({ ceremony: null });
  }

  if (message.type === 'binding-request') {
    return handleBindingRequest(message, sender);
  }

  if (message.type === 'pre-negotiate-complete') {
    return handlePreNegotiateComplete(message, sender);
  }

  if (message.type === 'pre-negotiate-failed') {
    handlePreNegotiateFailed(message, sender);
    return Promise.resolve({ ok: true });
  }

  if (message.type === 'complete-ceremony') {
    return handleComplete(message.tabId, message.pairingCode);
  }

  if (message.type === 'cancel-ceremony') {
    const tabKey = String(message.tabId);
    const ceremony = ceremonies.get(tabKey);
    if (ceremony) {
      ceremony.reject({ status: 'aborted' });
      ceremonies.delete(tabKey);
      browser.storage.local.remove('activeCeremony');
    }
    return Promise.resolve({ ok: true });
  }
});

// Clean up when tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  ceremonies.delete(String(tabId));
});

async function handleBindingRequest(message, sender) {
  const { options, hasPreNegotiate } = message;
  const tabId = sender.tab.id;
  const tabKey = String(tabId);

  // SECURITY: Do NOT trust origin from page context. Extract from sender.tab.url
  // The page could dispatch fake events with a spoofed origin.
  const tabUrl = new URL(sender.tab.url);
  const origin = tabUrl.origin;

  try {
    // Generate Ed25519 keypair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      false,
      ['sign', 'verify']
    );

    // Export public key for sending to server
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)));

    // Handshake - include requesting_origin per protocol spec
    const handshakeUrl = resolveEndpoint(origin, options.handshakeEndpoint);
    const handshakeRes = await fetch(handshakeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesting_origin: origin,
        algorithms: ['Ed25519']
      })
    });
    const handshake = await handshakeRes.json();

    if (handshake.type === 'rejected') {
      // reasons is an array that may contain 'origin_not_allowed' and/or 'no_compatible_algorithm'
      const reasons = handshake.reasons || [];
      if (reasons.includes('origin_not_allowed')) {
        return { status: 'error', errorCode: 'origin_rejected', errorMessage: 'Service rejected the requesting origin' };
      }
      return { status: 'error', errorCode: 'algorithm_rejected', errorMessage: 'No compatible algorithm' };
    }

    // Initialize
    const initUrl = resolveEndpoint(origin, options.initializeEndpoint);
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_key: {
          algorithm: 'Ed25519',
          key: publicKeyB64
        }
      })
    });
    const init = await initRes.json();

    if (init.status !== 'initialized') {
      return { status: 'error', errorCode: 'init_failed' };
    }

    // Store ceremony state
    const ceremony = {
      tabId,
      origin,
      options,
      keyPair,
      sessionId: init.session_id,
      negotiateUrl: resolveEndpoint(origin, options.negotiateEndpoint),
      completeUrl: resolveEndpoint(origin, options.completeEndpoint),
      pairingCodeSpec: handshake.pairing_code_specification,
      resolve: null,
      reject: null
    };

    ceremonies.set(tabKey, ceremony);

    if (hasPreNegotiate) {
      // Page wants to do pre-negotiation before we show UI
      // Return session info and wait for pre-negotiate-complete message
      return {
        type: 'pre-negotiate-ready',
        session: {
          sessionId: init.session_id,
          negotiateUrl: ceremony.negotiateUrl
        }
      };
    }

    // No pre-negotiation, proceed directly to UI
    return await showUIAndWaitForCompletion(tabKey, ceremony);

  } catch (error) {
    return { status: 'error', errorCode: 'network_error', errorMessage: error.message };
  }
}

async function handlePreNegotiateComplete(message, sender) {
  const tabKey = String(sender.tab.id);
  const ceremony = ceremonies.get(tabKey);

  if (!ceremony) {
    return { status: 'error', errorCode: 'no_ceremony' };
  }

  // Page finished pre-negotiation, now show UI
  return await showUIAndWaitForCompletion(tabKey, ceremony);
}

function handlePreNegotiateFailed(message, sender) {
  const tabKey = String(sender.tab.id);
  const ceremony = ceremonies.get(tabKey);

  if (ceremony) {
    ceremonies.delete(tabKey);
  }
}

async function showUIAndWaitForCompletion(tabKey, ceremony) {
  // Create a promise that the popup will resolve
  const resultPromise = new Promise((resolve, reject) => {
    ceremony.resolve = resolve;
    ceremony.reject = reject;
  });

  // Store ceremony info for popup to read (message passing may be blocked)
  await browser.storage.local.set({
    activeCeremony: {
      tabId: ceremony.tabId,
      origin: ceremony.origin,
      sessionId: ceremony.sessionId,
      negotiateUrl: ceremony.negotiateUrl
    }
  });

  // Open window for trusted UI
  // Using 'normal' instead of 'popup' so tiling WMs can manage it
  browser.windows.create({
    url: 'popup.html',
    type: 'normal',
    width: 450,
    height: 550
  });

  // Wait for completion
  return await resultPromise;
}

async function handleComplete(tabId, pairingCode) {
  const tabKey = String(tabId);
  const ceremony = ceremonies.get(tabKey);
  if (!ceremony) {
    return { status: 'error', errorCode: 'no_ceremony' };
  }

  try {
    const timestamp = new Date().toISOString();

    // Build signature input
    let signatureInput = ceremony.sessionId + timestamp;
    if (pairingCode) {
      signatureInput = ceremony.sessionId + pairingCode + timestamp;
    }

    // Sign
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      ceremony.keyPair.privateKey,
      encoder.encode(signatureInput)
    );
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Complete request
    const body = {
      session_id: ceremony.sessionId,
      timestamp,
      signature: signatureB64
    };
    if (pairingCode) {
      body.pairing_code = pairingCode;
    }

    const res = await fetch(ceremony.completeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();

    if (result.status === 'complete') {
      ceremony.resolve({ status: 'success', result: result.result });
      ceremonies.delete(tabKey);
      await browser.storage.local.remove('activeCeremony');
      return { ok: true, result };
    } else if (result.status === 'pending') {
      return { ok: false, pending: true };
    } else {
      return { ok: false, result };
    }

  } catch (error) {
    return { ok: false, error: error.message };
  }
}
