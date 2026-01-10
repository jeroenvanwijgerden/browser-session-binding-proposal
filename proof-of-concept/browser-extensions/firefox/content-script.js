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

// Listen for requests from the page
window.addEventListener('oob-binding-request', async (event) => {
  const { id, origin, options } = event.detail;

  try {
    // Forward to background script
    const result = await browser.runtime.sendMessage({
      type: 'binding-request',
      id,
      origin,
      options
    });

    // FIREFOX QUIRK: Must use cloneInto() to make the event detail accessible
    // to the page context. Without this, the page gets "Permission denied"
    // when trying to read the result.
    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: cloneInto({ id, result }, window)
    }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('oob-binding-response', {
      detail: cloneInto({ id, error: error.message }, window)
    }));
  }
});
