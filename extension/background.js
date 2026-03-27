const API_BASE = "https://formpilot-brown.vercel.app";

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_FIELDS") {
    analyzeFields(message.fields)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.type === "GET_FIELDS") {
    // Forward to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SCAN_FIELDS" }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true;
  }

  if (message.type === "GET_AUTH_STATUS") {
    getAuthStatus()
      .then((status) => sendResponse(status))
      .catch(() => sendResponse({ authenticated: false }));
    return true;
  }
});

async function getAuthStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/session`, {
      credentials: "include",
    });
    const session = await response.json();
    return { authenticated: !!session?.user, user: session?.user || null };
  } catch {
    return { authenticated: false };
  }
}

async function analyzeFields(fields) {
  const response = await fetch(`${API_BASE}/api/forms/analyze-web`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  return response.json();
}
