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

// Listen for requests from the page
window.addEventListener('oob-binding-request', async (event) => {
  const { id, origin, options } = event.detail;

  try {
    // Forward to service worker
    const result = await chrome.runtime.sendMessage({
      type: 'binding-request',
      id,
      origin,
      options
    });

    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: { id, result }
    }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: { id, error: error.message }
    }));
  }
});
