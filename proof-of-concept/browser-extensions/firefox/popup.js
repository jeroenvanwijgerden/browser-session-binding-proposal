// Firefox Popup script - trusted UI for OOB ceremony
//
// This runs in a browser-controlled popup window that the page cannot access.
// It displays session info for the user to copy to their companion app,
// accepts the pairing code, and triggers completion.
//
// FIREFOX QUIRK: We read ceremony state from storage.local instead of
// messaging, because Firefox blocks message passing while the background
// script is awaiting the completion promise. We also track lastCeremonyId
// to avoid redrawing the UI on every poll (which would clear text selection).

let currentTabId = null;
let lastCeremonyId = null;  // Used to detect ceremony changes and avoid unnecessary redraws

async function updateStatus() {
  try {
    // Read ceremony from storage (more reliable than message passing)
    const { activeCeremony } = await browser.storage.local.get('activeCeremony');

    if (activeCeremony) {
      // Only redraw if ceremony changed
      if (lastCeremonyId !== activeCeremony.sessionId) {
        lastCeremonyId = activeCeremony.sessionId;
        currentTabId = activeCeremony.tabId;
        showCeremony(activeCeremony);
      }
    } else {
      if (lastCeremonyId !== null) {
        lastCeremonyId = null;
        showNoCeremony();
      }
    }
  } catch (e) {
    // Ignore errors during polling
  }
}

async function init() {
  // Poll for status every 500ms
  setInterval(updateStatus, 500);
  updateStatus();
}

function showNoCeremony() {
  document.getElementById('no-ceremony').style.display = 'block';
  document.getElementById('ceremony').style.display = 'none';
}

function showCeremony(ceremony) {
  document.getElementById('no-ceremony').style.display = 'none';
  document.getElementById('ceremony').style.display = 'block';

  document.getElementById('origin').textContent = ceremony.origin;

  const sessionInfo = JSON.stringify({
    url: ceremony.negotiateUrl,
    session: ceremony.sessionId
  });
  document.getElementById('session-info').textContent = sessionInfo;
}

// Complete button
document.getElementById('complete-btn').addEventListener('click', async () => {
  const pairingCode = document.getElementById('pairing-code').value.trim();
  const status = document.getElementById('status');

  status.textContent = 'Completing...';

  const result = await browser.runtime.sendMessage({
    type: 'complete-ceremony',
    tabId: currentTabId,
    pairingCode
  });

  if (result.ok) {
    status.textContent = 'Success!';
    document.getElementById('pairing-code').value = '';
    setTimeout(() => window.close(), 1000);
  } else if (result.pending) {
    status.textContent = 'Waiting for negotiation... Try again after using companion app.';
  } else if (result.result?.reason === 'invalid_code') {
    status.textContent = 'Invalid pairing code. Try again.';
  } else {
    status.textContent = 'Error: ' + (result.error || result.result?.reason || 'Unknown');
  }
});

// Cancel button
document.getElementById('cancel-btn').addEventListener('click', async () => {
  await browser.runtime.sendMessage({
    type: 'cancel-ceremony',
    tabId: currentTabId
  });
  window.close();
});

// Click to copy session info
document.getElementById('session-info').addEventListener('click', async () => {
  const el = document.getElementById('session-info');
  try {
    await navigator.clipboard.writeText(el.textContent);
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 1000);
  } catch (e) {
    // Fallback: select text
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
});

init();
