// Chrome Extension Service Worker
//
// This handles the protocol logic for OOB session binding:
// 1. Receives binding requests from inject.js (via content-script.js)
// 2. Performs handshake + initialize with the service
// 3. Opens a popup window for trusted UI
// 4. Waits for user to enter pairing code, then calls /bind/complete
//
// The private key never leaves this context - pages cannot access it.

const ceremonies = new Map();  // tabId -> ceremony state

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
  const { origin, options } = message;
  const tabId = sender.tab.id;

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

    // Handshake
    const handshakeUrl = origin + options.handshakeEndpoint;
    const handshakeRes = await fetch(handshakeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        algorithms: ['Ed25519']
      })
    });
    const handshake = await handshakeRes.json();

    if (handshake.type === 'rejected') {
      return { status: 'error', errorCode: 'algorithm_rejected' };
    }

    // Initialize
    const initUrl = origin + options.initializeEndpoint;
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
      negotiateUrl: origin + options.negotiateEndpoint,
      completeUrl: origin + options.completeEndpoint,
      pairingCodeSpec: handshake.pairing_code_specification,
      resolve: null,
      reject: null
    };

    // Create a promise that the popup will resolve
    const resultPromise = new Promise((resolve, reject) => {
      ceremony.resolve = resolve;
      ceremony.reject = reject;
    });

    ceremonies.set(tabId, ceremony);

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

  } catch (error) {
    return { status: 'error', errorCode: 'network_error', errorMessage: error.message };
  }
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
