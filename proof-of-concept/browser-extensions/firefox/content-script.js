// Content script - bridges page context to background script
//
// Content scripts run in an isolated world with access to both:
// - The page's DOM (but not its JavaScript context)
// - The extension's messaging system
//
// We inject inject.js into the page context to provide the API,
// then relay messages between inject.js and the background script.

// Inject the API script into the page context
const script = document.createElement('script');
script.src = browser.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Track pending requests that need pre-negotiation
const pendingPreNegotiations = new Map();

// Listen for requests from the page
window.addEventListener('oob-binding-request', async (event) => {
  const detail = event.detail;

  if (detail.type === 'start') {
    // Initial request - forward to background script
    const { id, options, hasPreNegotiate } = detail;

    try {
      // Forward to background script
      // Note: We do NOT forward origin from page context - the background script
      // derives it from sender.tab.url to prevent spoofing.
      const result = await browser.runtime.sendMessage({
        type: 'binding-request',
        id,
        options,
        hasPreNegotiate
      });

      if (result.type === 'pre-negotiate-ready') {
        // Background script completed handshake + initialize, waiting for pre-negotiation
        pendingPreNegotiations.set(id, true);
        // FIREFOX QUIRK: Must use cloneInto() to make the event detail accessible
        // to the page context.
        window.dispatchEvent(new CustomEvent('oob-binding-response', {
          detail: cloneInto({ id, type: 'pre-negotiate-ready', session: result.session }, window)
        }));
      } else {
        // No pre-negotiation, this is the final result
        window.dispatchEvent(new CustomEvent('oob-binding-response', {
          detail: cloneInto({ id, result }, window)
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: cloneInto({ id, error: error.message }, window)
      }));
    }

  } else if (detail.type === 'pre-negotiate-complete') {
    // Page finished pre-negotiation, tell background script to continue
    const { id } = detail;

    if (!pendingPreNegotiations.has(id)) return;
    pendingPreNegotiations.delete(id);

    try {
      const result = await browser.runtime.sendMessage({
        type: 'pre-negotiate-complete',
        id
      });

      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: cloneInto({ id, type: 'final-result', result }, window)
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('oob-binding-response', {
        detail: cloneInto({ id, type: 'final-result', error: error.message }, window)
      }));
    }

  } else if (detail.type === 'pre-negotiate-failed') {
    // Page's pre-negotiation failed, abort
    const { id, error } = detail;

    if (!pendingPreNegotiations.has(id)) return;
    pendingPreNegotiations.delete(id);

    await browser.runtime.sendMessage({
      type: 'pre-negotiate-failed',
      id,
      error
    });

    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: cloneInto({ id, type: 'final-result', error }, window)
    }));
  }
});
