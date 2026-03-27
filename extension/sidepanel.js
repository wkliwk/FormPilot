const scanBtn = document.getElementById("scanBtn");
const autofillBtn = document.getElementById("autofillBtn");
const clearBtn = document.getElementById("clearBtn");
const fieldList = document.getElementById("fieldList");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const content = document.getElementById("content");
const loginPrompt = document.getElementById("loginPrompt");

let currentFields = [];
let analysisResult = [];

// Check auth on load
chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
  if (response?.authenticated) {
    statusDot.classList.add("connected");
    statusText.textContent = `Connected as ${response.user.name || response.user.email}`;
    content.style.display = "block";
    loginPrompt.style.display = "none";
  } else {
    statusDot.classList.add("error");
    statusText.textContent = "Not signed in";
    content.style.display = "none";
    loginPrompt.style.display = "block";
  }
});

// Scan fields
scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";
  fieldList.innerHTML = '<div class="loading"><div class="spinner"></div>Scanning form fields...</div>';

  chrome.runtime.sendMessage({ type: "GET_FIELDS" }, async (response) => {
    if (!response?.fields || response.fields.length === 0) {
      fieldList.innerHTML = '<div class="empty">No form fields found on this page.</div>';
      scanBtn.disabled = false;
      scanBtn.textContent = "Scan Form Fields";
      return;
    }

    currentFields = response.fields;
    fieldList.innerHTML = '<div class="loading"><div class="spinner"></div>Analyzing fields with AI...</div>';

    // Send to API for analysis
    chrome.runtime.sendMessage(
      { type: "ANALYZE_FIELDS", fields: currentFields },
      (result) => {
        scanBtn.disabled = false;
        scanBtn.textContent = "Re-scan";

        if (!result?.success) {
          fieldList.innerHTML = `<div class="error-msg">${result?.error || "Analysis failed. Please try again."}</div>`;
          return;
        }

        analysisResult = result.data.fields;
        renderFields(analysisResult);

        // Highlight fields on the page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "HIGHLIGHT_FIELDS",
              data: analysisResult,
            });
          }
        });

        autofillBtn.style.display = "block";
        clearBtn.style.display = "block";
      }
    );
  });
});

// Autofill
autofillBtn.addEventListener("click", () => {
  const fieldsWithValues = analysisResult.filter((f) => f.value);
  if (fieldsWithValues.length === 0) {
    fieldList.insertAdjacentHTML(
      "afterbegin",
      '<div class="error-msg">No autofill values available. Set up your profile first.</div>'
    );
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "FILL_FIELDS",
        data: fieldsWithValues,
      });
    }
  });
});

// Clear highlights
clearBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR_HIGHLIGHTS" });
    }
  });
  fieldList.innerHTML = "";
  autofillBtn.style.display = "none";
  clearBtn.style.display = "none";
  scanBtn.textContent = "Scan Form Fields";
  analysisResult = [];
});

function renderFields(fields) {
  fieldList.innerHTML = "";

  fields.forEach((field) => {
    const confClass =
      field.confidence > 0.8 ? "high" : field.confidence > 0.5 ? "medium" : "low";

    const card = document.createElement("div");
    card.className = "field-card";
    card.innerHTML = `
      <div class="field-card-header">
        <span class="field-label">${field.label}</span>
        <span class="field-type">${field.type}</span>
      </div>
      <div class="field-explanation">${field.explanation}</div>
      <div class="field-example"><strong>Example:</strong> ${field.example}</div>
      ${field.commonMistakes ? `<div class="field-mistakes">Common mistake: ${field.commonMistakes}</div>` : ""}
      ${field.value ? `<div style="margin-top:6px"><span class="confidence ${confClass}">${field.value} (${Math.round((field.confidence || 0) * 100)}%)</span></div>` : ""}
    `;
    fieldList.appendChild(card);
  });
}
