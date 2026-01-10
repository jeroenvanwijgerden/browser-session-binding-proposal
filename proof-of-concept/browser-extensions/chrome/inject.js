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
    const { id, result, error } = event.detail;
    const pending = pendingRequests.get(id);
    if (pending) {
      pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  });

  const outOfBandBinding = {
    request(options) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pendingRequests.set(id, { resolve, reject });

        window.dispatchEvent(new CustomEvent('oob-binding-request', {
          detail: {
            id,
            origin: window.location.origin,
            options
          }
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
