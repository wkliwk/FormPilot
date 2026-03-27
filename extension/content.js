// FormPilot Content Script — detects form fields on the page

let highlightedFields = [];
let tooltips = [];

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

// Fill fields with autofill data
function fillFields(fieldValues) {
  const selectors = [
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
    "textarea",
    "select",
  ];
  const elements = document.querySelectorAll(selectors.join(","));

  fieldValues.forEach((fv) => {
    const el = elements[fv.index];
    if (!el || !fv.value) return;

    // Set value and dispatch events so frameworks pick it up
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        "value"
      )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, fv.value);
    } else {
      el.value = fv.value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Visual feedback
    el.classList.add("formpilot-filled");
    setTimeout(() => el.classList.remove("formpilot-filled"), 2000);
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
    fillFields(message.data);
    sendResponse({ success: true });
  }

  if (message.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
  }
});
