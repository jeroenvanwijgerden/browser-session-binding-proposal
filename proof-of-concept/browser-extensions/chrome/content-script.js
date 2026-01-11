// Content script - bridges page context to service worker
//
// Content scripts run in an isolated world with access to both:
// - The page's DOM (but not its JavaScript context)
// - The extension's messaging system
//
// We inject inject.js into the page context to provide the API,
// then relay messages between inject.js and the service worker.

// Inject the API script into the page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Track pending requests that need pre-negotiation
const pendingPreNegotiations = new Map();

// Listen for requests from the page
window.addEventListener('oob-binding-request', async (event) => {
  const detail = event.detail;

  if (detail.type === 'start') {
    // Initial request - forward to service worker
    const { id, options, hasPreNegotiate } = detail;

    try {
      // Forward to service worker
      // Note: We do NOT forward origin from page context - the service worker
      // derives it from sender.tab.url to prevent spoofing.
      const result = await chrome.runtime.sendMessage({
        type: 'binding-request',
        id,
        options,
        hasPreNegotiate
      });

      if (result.type === 'pre-negotiate-ready') {
        // Service worker completed handshake + initialize, waiting for pre-negotiation
        pendingPreNegotiations.set(id, true);
        window.dispatchEvent(new CustomEvent('oob-binding-response', {
          detail: { id, type: 'pre-negotiate-ready', session: result.session }
        }));
      } else {
        // No pre-negotiation, this is the final result
        window.dispatchEvent(new CustomEvent('oob-binding-response', {
          detail: { id, result }
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: { id, error: error.message }
      }));
    }

  } else if (detail.type === 'pre-negotiate-complete') {
    // Page finished pre-negotiation, tell service worker to continue
    const { id } = detail;

    if (!pendingPreNegotiations.has(id)) return;
    pendingPreNegotiations.delete(id);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'pre-negotiate-complete',
        id
      });

      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: { id, type: 'final-result', result }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: { id, type: 'final-result', error: error.message }
      }));
    }

  } else if (detail.type === 'pre-negotiate-failed') {
    // Page's pre-negotiation failed, abort
    const { id, error } = detail;

    if (!pendingPreNegotiations.has(id)) return;
    pendingPreNegotiations.delete(id);

    await chrome.runtime.sendMessage({
      type: 'pre-negotiate-failed',
      id,
      error
    });

    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: { id, type: 'final-result', error }
    }));
  }
});
