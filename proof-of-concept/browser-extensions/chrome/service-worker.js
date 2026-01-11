// Chrome Extension Service Worker
//
// This handles the protocol logic for OOB session binding:
// 1. Receives binding requests from inject.js (via content-script.js)
// 2. Performs handshake + initialize with the service
// 3. If pre-negotiation requested, waits for page to complete it
// 4. Opens a popup window for trusted UI
// 5. Waits for user to enter pairing code, then calls /bind/complete
//
// The private key never leaves this context - pages cannot access it.

const ceremonies = new Map();  // tabId -> ceremony state

// Resolve endpoint URL: if it starts with http(s), use as-is; otherwise prepend origin
function resolveEndpoint(origin, endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return origin + endpoint;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-status') {
    const ceremony = ceremonies.get(message.tabId);
    sendResponse({ ceremony: ceremony || null });
    return false;
  }

  if (message.type === 'binding-request') {
    handleBindingRequest(message, sender).then(sendResponse);
    return true;
  }

  if (message.type === 'pre-negotiate-complete') {
    handlePreNegotiateComplete(message, sender).then(sendResponse);
    return true;
  }

  if (message.type === 'pre-negotiate-failed') {
    handlePreNegotiateFailed(message, sender);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'complete-ceremony') {
    handleComplete(message.tabId, message.pairingCode).then(sendResponse);
    return true;
  }

  if (message.type === 'cancel-ceremony') {
    const ceremony = ceremonies.get(message.tabId);
    if (ceremony) {
      ceremony.reject({ status: 'aborted' });
      ceremonies.delete(message.tabId);
    }
    sendResponse({ ok: true });
    return false;
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  ceremonies.delete(tabId);
});

async function handleBindingRequest(message, sender) {
  const { options, hasPreNegotiate } = message;
  const tabId = sender.tab.id;

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

    ceremonies.set(tabId, ceremony);

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
    return await showUIAndWaitForCompletion(tabId);

  } catch (error) {
    return { status: 'error', errorCode: 'network_error', errorMessage: error.message };
  }
}

async function handlePreNegotiateComplete(message, sender) {
  const tabId = sender.tab.id;
  const ceremony = ceremonies.get(tabId);

  if (!ceremony) {
    return { status: 'error', errorCode: 'no_ceremony' };
  }

  // Page finished pre-negotiation, now show UI
  return await showUIAndWaitForCompletion(tabId);
}

function handlePreNegotiateFailed(message, sender) {
  const tabId = sender.tab.id;
  const ceremony = ceremonies.get(tabId);

  if (ceremony) {
    ceremonies.delete(tabId);
  }
}

async function showUIAndWaitForCompletion(tabId) {
  const ceremony = ceremonies.get(tabId);
  if (!ceremony) {
    return { status: 'error', errorCode: 'no_ceremony' };
  }

  // Create a promise that the popup will resolve
  const resultPromise = new Promise((resolve, reject) => {
    ceremony.resolve = resolve;
    ceremony.reject = reject;
  });

  // Open window for trusted UI
  // Using 'normal' instead of 'popup' so tiling WMs can manage it
  chrome.windows.create({
    url: `sidepanel.html?tabId=${tabId}`,
    type: 'normal',
    width: 450,
    height: 550
  });

  // Notify side panel that ceremony started
  chrome.runtime.sendMessage({ type: 'ceremony-started', tabId }).catch(() => {});

  // Wait for completion
  return await resultPromise;
}

async function handleComplete(tabId, pairingCode) {
  const ceremony = ceremonies.get(tabId);
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
      ceremonies.delete(tabId);
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
