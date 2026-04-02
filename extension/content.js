// FormPilot Content Script — detects form fields on the page

let highlightedFields = [];
let tooltips = [];

// ── Badge / proactive detection ──────────────────────────────────────────────

const BADGE_THRESHOLD = 3;

const QUALIFYING_SELECTOR = [
  "input:not([type=hidden]):not([type=submit]):not([type=button])" +
    ":not([type=reset]):not([type=image]):not([type=password]):not([type=file])",
  "textarea",
  "select",
].join(",");

function countQualifyingInputs() {
  const els = document.querySelectorAll(QUALIFYING_SELECTOR);
  let count = 0;
  for (const el of els) {
    // Skip visually hidden elements
    if (el.offsetParent !== null || el.getBoundingClientRect().width > 0) {
      count++;
    }
  }
  return count;
}

function sendBadgeUpdate(count) {
  try {
    chrome.runtime.sendMessage({ type: "SET_BADGE", count });
  } catch {
    // Extension context may be invalidated after SW restart — ignore
  }
}

let _toastShownThisSession = false;

async function maybeShowDetectionToast() {
  if (_toastShownThisSession) return;

  const hostname = location.hostname;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const storageKey = `fp_toast_${hostname}_${today}`;

  let alreadyShown = false;
  try {
    const result = await chrome.storage.local.get(storageKey);
    alreadyShown = !!result[storageKey];
  } catch {
    return; // storage unavailable
  }
  if (alreadyShown) return;

  _toastShownThisSession = true;

  // Mark as shown for today
  try {
    await chrome.storage.local.set({ [storageKey]: true });
  } catch {
    // best-effort
  }

  // Inject toast
  const toast = document.createElement("div");
  toast.id = "fp-detection-toast";
  toast.style.cssText = [
    "position:fixed", "bottom:20px", "right:20px", "z-index:2147483647",
    "display:flex", "align-items:center", "gap:10px",
    "background:#1e293b", "color:#f8fafc", "border-radius:12px",
    "padding:12px 14px 12px 14px", "font-family:-apple-system,sans-serif",
    "font-size:13px", "line-height:1.4", "max-width:300px",
    "box-shadow:0 4px 20px rgba(0,0,0,0.25)",
    "transition:opacity 0.3s ease", "opacity:0",
  ].join(";");

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span style="flex:1">FormPilot detected a form — click the extension to autofill</span>
    <button id="fp-toast-dismiss" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;line-height:1;padding:0;flex-shrink:0" aria-label="Dismiss">✕</button>
  `;

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.opacity = "1"; });
  });

  function dismissToast() {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }

  document.getElementById("fp-toast-dismiss").addEventListener("click", dismissToast);
  setTimeout(dismissToast, 4000);
}

let _mutationTimer = null;

function checkAndUpdateBadge() {
  const count = countQualifyingInputs();
  sendBadgeUpdate(count);
  if (count >= BADGE_THRESHOLD) {
    maybeShowDetectionToast();
  }
}

function initFormDetection() {
  checkAndUpdateBadge();

  // Watch for DOM changes (SPAs, lazy-rendered forms)
  const observer = new MutationObserver(() => {
    clearTimeout(_mutationTimer);
    _mutationTimer = setTimeout(checkAndUpdateBadge, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // SPA navigation via history API
  const _origPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    _origPushState(...args);
    setTimeout(checkAndUpdateBadge, 200);
  };
  window.addEventListener("popstate", () => setTimeout(checkAndUpdateBadge, 200));
}

// Run after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFormDetection);
} else {
  initFormDetection();
}

// ── End badge / proactive detection ─────────────────────────────────────────

// Scan for all input fields on the page
function scanFields() {
  const selectors = [
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
    "textarea",
    "select",
  ];

  const elements = document.querySelectorAll(selectors.join(","));
  const fields = [];

  elements.forEach((el, index) => {
    const label = getFieldLabel(el);
    const field = {
      id: el.id || el.name || `field_${index}`,
      label: label,
      type: getFieldType(el),
      tagName: el.tagName.toLowerCase(),
      placeholder: el.placeholder || "",
      required: el.required || el.getAttribute("aria-required") === "true",
      value: el.value || "",
      index: index,
    };
    fields.push(field);
  });

  return fields;
}

function getFieldLabel(el) {
  // Check for associated <label>
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent.trim();
  }

  // Check parent label
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = parentLabel.textContent.trim();
    // Remove the input's own value from label text
    const inputText = el.value || el.placeholder || "";
    return text.replace(inputText, "").trim();
  }

  // Check aria-label
  if (el.getAttribute("aria-label")) {
    return el.getAttribute("aria-label");
  }

  // Check aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent.trim();
  }

  // Check preceding sibling text
  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN")) {
    return prev.textContent.trim();
  }

  // Fallback to name/id/placeholder
  return el.placeholder || el.name || el.id || "Unknown field";
}

function getFieldType(el) {
  if (el.tagName === "SELECT") return "select";
  if (el.tagName === "TEXTAREA") return "textarea";
  return el.type || "text";
}

// Highlight fields and show tooltips
function highlightFields(analysisData) {
  clearHighlights();

  const selectors = [
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
    "textarea",
    "select",
  ];
  const elements = document.querySelectorAll(selectors.join(","));

  analysisData.forEach((fieldData) => {
    const el = elements[fieldData.index];
    if (!el) return;

    // Add highlight border
    el.classList.add("formpilot-highlight");
    highlightedFields.push(el);

    // Create tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "formpilot-tooltip";
    tooltip.innerHTML = `
      <div class="formpilot-tooltip-header">${fieldData.label}</div>
      <div class="formpilot-tooltip-body">${fieldData.explanation}</div>
      <div class="formpilot-tooltip-example"><strong>Example:</strong> ${fieldData.example}</div>
    `;
    tooltip.style.display = "none";

    document.body.appendChild(tooltip);
    tooltips.push(tooltip);

    // Show tooltip on hover
    el.addEventListener("mouseenter", () => {
      const rect = el.getBoundingClientRect();
      tooltip.style.display = "block";
      tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
      tooltip.style.left = `${rect.left + window.scrollX}px`;
    });

    el.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

/**
 * Normalize a date value to YYYY-MM-DD for <input type="date"> fields.
 * Handles MM/DD/YYYY, DD-MM-YYYY, and ISO strings.
 */
function normalizeDateValue(value) {
  if (!value) return value;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // MM/DD/YYYY
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // Try generic Date parse as last resort
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return value;
}

/**
 * Fill a single element with a value.
 * Returns true if filled, false if skipped (sets skipReason on the field object).
 */
function fillElement(el, fv) {
  if (!fv.value) {
    fv.skipReason = "no profile match";
    return false;
  }
  if (el.disabled || el.readOnly) {
    fv.skipReason = "field locked";
    return false;
  }
  // Skip password and payment card fields (security exclusion)
  if (
    el.type === "password" ||
    el.autocomplete === "cc-number" ||
    el.autocomplete === "cc-csc" ||
    el.autocomplete === "cc-exp"
  ) {
    fv.skipReason = "unsupported field type";
    return false;
  }

  if (el.tagName === "SELECT") {
    // React-controlled selects require the native HTMLSelectElement setter
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, fv.value);
    } else {
      el.value = fv.value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.type === "date") {
    const normalized = normalizeDateValue(fv.value);
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, normalized);
    } else {
      el.value = normalized;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, fv.value);
    } else {
      el.value = fv.value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Visual feedback
  el.classList.add("formpilot-filled");
  setTimeout(() => el.classList.remove("formpilot-filled"), 2000);
  return true;
}

// Fill fields with autofill data — returns a stats object via Promise
function fillFields(fieldValues) {
  return new Promise((resolve) => {
    const selectors = [
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
      "textarea",
      "select",
    ];

    const elements = document.querySelectorAll(selectors.join(","));
    let filledCount = 0;
    const filledIndices = new Set();
    const skippedFields = [];

    fieldValues.forEach((fv) => {
      const el = elements[fv.index];
      if (!el) {
        skippedFields.push({ label: fv.label || "unknown", reason: "no profile match" });
        return;
      }
      if (fillElement(el, fv)) {
        filledCount++;
        filledIndices.add(fv.index);
      } else {
        skippedFields.push({ label: fv.label || getFieldLabel(el), reason: fv.skipReason || "no profile match" });
      }
    });

    // Post-fill re-scan after 500ms for dynamically revealed fields
    // TODO: replace with MutationObserver for better reliability
    setTimeout(() => {
      const newElements = document.querySelectorAll(selectors.join(","));
      let updatedAfterReaction = 0;

      fieldValues.forEach((fv) => {
        if (filledIndices.has(fv.index)) return; // already filled in first pass
        const el = newElements[fv.index];
        if (!el || !fv.value) return;
        // Only fill newly visible elements
        if (el.offsetParent !== null) {
          if (fillElement(el, fv)) {
            updatedAfterReaction++;
          }
        }
      });

      resolve({
        filled: filledCount,
        updatedAfterReaction,
        skipped: skippedFields.length,
        skippedFields,
      });
    }, 500);
  });
}

function clearHighlights() {
  highlightedFields.forEach((el) => {
    el.classList.remove("formpilot-highlight");
  });
  tooltips.forEach((t) => t.remove());
  highlightedFields = [];
  tooltips = [];
}

// Listen for messages from background/sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_FIELDS") {
    const fields = scanFields();
    sendResponse({ fields });
  }

  if (message.type === "HIGHLIGHT_FIELDS") {
    highlightFields(message.data);
  }

  if (message.type === "FILL_FIELDS") {
    fillFields(message.data).then((stats) => {
      sendResponse({ success: true, stats });
    });
    return true; // keep channel open for async response
  }

  if (message.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
  }
});
