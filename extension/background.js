const DEFAULT_API_BASE = "https://formpilot-brown.vercel.app";

async function getApiBase() {
  try {
    const result = await chrome.storage.sync.get("apiBase");
    return result.apiBase || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_FIELDS") {
    analyzeFields(message.fields, message.language)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.type === "GET_FIELDS") {
    // Forward to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ fields: [], error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: "SCAN_FIELDS" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not injected — page may be a restricted URL or needs a reload
          sendResponse({ fields: [], error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse(response);
      });
    });
    return true;
  }

  if (message.type === "SET_API_BASE") {
    chrome.storage.sync.set({ apiBase: message.url })
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_API_BASE") {
    getApiBase()
      .then((url) => sendResponse({ url }))
      .catch(() => sendResponse({ url: DEFAULT_API_BASE }));
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
    const apiBase = await getApiBase();
    const response = await fetch(`${apiBase}/api/auth/session`, {
      credentials: "include",
    });
    const session = await response.json();
    return { authenticated: !!session?.user, user: session?.user || null };
  } catch {
    return { authenticated: false };
  }
}

async function analyzeFields(fields, language) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/forms/analyze-web`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fields, language: language || "en" }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  return response.json();
}
