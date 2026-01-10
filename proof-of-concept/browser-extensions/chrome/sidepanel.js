// Popup/Side panel script - trusted UI for OOB ceremony
//
// This runs in a browser-controlled popup window that the page cannot access.
// It displays session info for the user to copy to their companion app,
// accepts the pairing code, and triggers completion.

let currentTabId = null;

async function updateStatus() {
  if (!currentTabId) return;

  // Get status from service worker
  const status = await chrome.runtime.sendMessage({
    type: 'get-status',
    tabId: currentTabId
  });

  if (status.ceremony) {
    showCeremony(status.ceremony);
  } else {
    showNoCeremony();
  }
}

async function init() {
  // Check for tabId in URL params (popup window mode)
  const params = new URLSearchParams(window.location.search);
  const tabIdParam = params.get('tabId');

  if (tabIdParam) {
    currentTabId = parseInt(tabIdParam, 10);
  } else {
    // Fallback: get the active tab (side panel mode)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabId = tab.id;
    }
  }

  updateStatus();

  // Listen for tab changes (only relevant for side panel mode)
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (!tabIdParam) {
      currentTabId = activeInfo.tabId;
      updateStatus();
    }
  });

  // Listen for ceremony updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ceremony-started' && message.tabId === currentTabId) {
      updateStatus();
    }
  });
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

  const result = await chrome.runtime.sendMessage({
    type: 'complete-ceremony',
    tabId: currentTabId,
    pairingCode
  });

  if (result.ok) {
    status.textContent = 'Success!';
    document.getElementById('pairing-code').value = '';
    // Close popup window after success, or reset side panel
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tabId')) {
        window.close();
      } else {
        showNoCeremony();
        status.textContent = '';
      }
    }, 1000);
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
  await chrome.runtime.sendMessage({
    type: 'cancel-ceremony',
    tabId: currentTabId
  });
  showNoCeremony();
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
