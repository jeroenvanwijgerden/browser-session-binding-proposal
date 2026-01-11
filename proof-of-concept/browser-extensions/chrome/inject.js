// Injected into page context by content-script.js
//
// This provides the navigator.outOfBandBinding API that web pages can call.
// It's a thin shim that forwards requests to the content script, which
// forwards them to the service worker where the actual crypto happens.
//
// SECURITY: This script runs in the page context, so it cannot access the
// private key. All it does is pass messages back and forth.

(function() {
  // Prevent re-injection
  if (navigator.outOfBandBinding) return;

  const pendingRequests = new Map();
  let requestId = 0;

  // Listen for responses from content script
  window.addEventListener('oob-binding-response', (event) => {
    const { id, result, error, type, session } = event.detail;
    const pending = pendingRequests.get(id);
    if (!pending) return;

    if (type === 'pre-negotiate-ready') {
      // Extension has completed handshake + initialize, now run preNegotiate callback
      pending.runPreNegotiate(session);
    } else if (type === 'final-result') {
      // Final result from the ceremony
      pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    } else {
      // Legacy: simple response without pre-negotiation
      pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  });

  const outOfBandBinding = {
    request(options, callbacks = {}) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        const hasPreNegotiate = typeof callbacks.preNegotiate === 'function';

        const pending = {
          resolve,
          reject,
          runPreNegotiate: async (session) => {
            try {
              // Run the page's pre-negotiation callback
              await callbacks.preNegotiate(session);

              // Signal extension to continue with UI
              window.dispatchEvent(new CustomEvent('oob-binding-request', {
                detail: { id, type: 'pre-negotiate-complete' }
              }));
            } catch (err) {
              // Pre-negotiation failed, abort
              window.dispatchEvent(new CustomEvent('oob-binding-request', {
                detail: { id, type: 'pre-negotiate-failed', error: err.message }
              }));
            }
          }
        };
        pendingRequests.set(id, pending);

        // Note: We do NOT send origin here. The service worker derives origin
        // from sender.tab.url to prevent spoofing by malicious pages.
        window.dispatchEvent(new CustomEvent('oob-binding-request', {
          detail: { id, type: 'start', options, hasPreNegotiate }
        }));
      });
    }
  };

  Object.defineProperty(navigator, 'outOfBandBinding', {
    value: Object.freeze(outOfBandBinding),
    writable: false,
    configurable: false
  });
})();
