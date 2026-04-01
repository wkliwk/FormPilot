# FormPilot — Product Document

## Overview

**What:** AI-powered form assistant that parses PDF, Word, and image forms, explains fields in plain language, and auto-fills from stored user profile data.

**Who:** People filling complex forms — tax (W-4, 1040), immigration (I-9, DS-160), legal, HR/employment, healthcare, and government forms.

**Core problem:** Complex forms are confusing, time-consuming, and error-prone. Users don't know what fields mean, where to find the information, or what format to use. FormPilot eliminates this friction.

---

## Features

### 1. Form Upload & Analysis

**Description:** Upload a PDF, Word doc (.doc/.docx), or image (PNG, JPEG, WebP, HEIC) and FormPilot extracts all fields, explains each one, and detects the form category.

**User flow:**
1. Click "Upload Form" from dashboard
2. Drag-and-drop or select file (max 10MB)
3. Wait for AI analysis (5-15 seconds)
4. Redirected to form detail page with all fields listed

**Acceptance criteria:**
- PDF, DOCX, DOC, PNG, JPEG, WebP, HEIC uploads accepted
- Magic-byte validation rejects spoofed file types
- AI extracts field labels, types, required status, and explanations
- Form categorized as TAX / IMMIGRATION / LEGAL / HR_EMPLOYMENT / HEALTHCARE / GENERAL
- Error shown if file too large, unreadable, or no fields detected

---

### 2. AI Field Explanation

**Description:** Each extracted field gets a plain-language explanation, example value, common mistakes to avoid, and "where to find it" guidance.

**User flow:**
1. On form detail page, click "What should I enter?" on any field
2. See explanation, example, and tips
3. Optionally switch language for explanations

**Acceptance criteria:**
- Every field has: label, type, required flag, explanation, example, common mistakes
- Explanations are category-aware (tax forms get IRS-specific guidance, etc.)
- Field explanations cached globally to reduce AI calls
- Language can be changed per form via dropdown (12 languages supported)

---

### 3. Profile Vault

**Description:** Encrypted user profile stores personal data for autofill — name, address, employment, identity docs, and preferences.

**User flow:**
1. Navigate to Profile page
2. Fill in personal information sections
3. Data auto-saves and is used for future autofills

**Acceptance criteria:**
- Fields: first/last name, email, phone, DOB, street/city/state/zip/country, employer, job title, annual income, SSN, passport number, driver's license
- Preferred language and country stored for AI context
- Data encrypted at rest
- Profile completion percentage shown on dashboard

---

### 4. Smart Autofill

**Description:** Uses profile vault + learned memory from prior forms to pre-fill fields with confidence scores.

**User flow:**
1. Upload or open a form
2. Click "Autofill" or autofill runs automatically on upload
3. Fields populated with suggested values and confidence indicators (High >80%, Medium 50-80%, Low <50%)
4. Accept, edit, or reject each suggestion

**Acceptance criteria:**
- Profile fields mapped intelligently to form fields
- Confidence scores displayed per field (green/yellow/red)
- User can accept/reject each autofilled value
- Autofill respects rate limit (20 requests/user/hour)

---

### 5. Guided Fill Mode

**Description:** Step-by-step form filling — one field at a time with full context, reducing cognitive overload.

**User flow:**
1. Click "Start Guided Fill" on form detail page
2. Navigate through fields one by one with Next/Back
3. Each field shows explanation, example, and input
4. Progress bar shows completion
5. Exit to full view at any time

**Acceptance criteria:**
- Fields grouped by category: Personal Info, Address, Employment, Identity, Other
- One field per screen with full explanation
- Progress indicator shows fields remaining
- Can switch between guided and full view modes

---

### 6. Document Preview with Zoom

**Description:** Side-by-side view showing the original PDF/image alongside the form fields, with zoom controls.

**User flow:**
1. Click "Side-by-Side" on form detail page
2. Original document appears on the right
3. Active field highlighted on document
4. Use +/- controls to zoom in/out (50%-300%)
5. Click "Fit" to reset to auto-fit

**Acceptance criteria:**
- PDF rendered page-by-page with navigation controls
- Active field highlighted with amber overlay on document
- Field overlays scale correctly at all zoom levels
- Zoom controls: in (+), out (-), reset to fit, 25% steps
- Works for both PDF and IMAGE source types

---

### 7. PDF Export

**Description:** Export the completed form as a filled PDF, preserving the original layout with user values inserted.

**User flow:**
1. Fill all fields on form detail page
2. Click "Export" → choose PDF format
3. Preview modal shows validation status
4. Download filled PDF

**Acceptance criteria:**
- All filled values appear in correct positions in exported PDF
- Original form formatting preserved
- Validation runs before export (warns about missing required fields)
- Checkbox, text, radio, and dropdown fields all export correctly

---

### 8. Form Templates

**Description:** Save a completed form as a reusable template (strips personal data) and share via link.

**User flow:**
1. Click "Share" on form detail page
2. Template created with shareable link
3. Copy link and share with others
4. Recipients can view template and create their own form from it

**Acceptance criteria:**
- Template strips all personal data, preserves structure + AI guidance
- Shareable URL generated at /t/[slug]
- Public template page shows fields and explanations (no auth required to view)
- "Use Template" button creates new form for logged-in users
- Templates can be revoked by creator

---

### 9. Batch Fill

**Description:** Upload up to 10 forms at once, auto-analyze and autofill all of them.

**User flow:**
1. Navigate to Batch Fill page
2. Select up to 10 files
3. Watch progress as each form is processed
4. Download all as ZIP

**Acceptance criteria:**
- Upload up to 10 forms (each ≤10MB)
- Real-time status per file: queued → uploading → autofilling → complete/error
- Counts against monthly free tier quota
- ZIP download with all filled forms

---

### 10. Form Memory

**Description:** FormPilot learns from completed forms — extracts and stores field values to improve future autofill.

**User flow:**
1. Complete and mark a form as done
2. FormPilot extracts key values (name, address, employer, etc.)
3. View learned values on Memory page
4. Edit or delete entries

**Acceptance criteria:**
- Auto-extracts values from completed forms
- Memory grouped by type: Name, Email, Phone, Address, Employment, Travel/ID, Tax, Other
- Shows label, value, confidence, source form
- Manual corrections override auto-extracted values
- Learned values used in future autofill suggestions

---

### 11. Dashboard

**Description:** Home screen showing all forms, stats, quota, and quick actions.

**User flow:**
1. Log in → see dashboard
2. View form list with status, progress, and field count
3. Sort/filter forms
4. See stats: fields filled, time saved, forms completed, quota usage

**Acceptance criteria:**
- Form cards show title, category badge, completion %, field count, status, last edited time
- Sort by: last opened, date uploaded, name A-Z
- Filter by: status (Ready to Fill, In Progress), category
- Search forms by title
- Quota bar shows monthly usage (X of 5 forms)
- Onboarding checklist for new users (profile, upload, autofill)

---

### 12. Billing & Subscription

**Description:** Free tier (5 forms/month) with Stripe-powered Pro upgrade (unlimited).

**User flow:**
1. View current plan on Billing page
2. Click "Upgrade" → Stripe checkout
3. After payment → Pro badge, unlimited forms
4. Manage subscription via Stripe portal

**Acceptance criteria:**
- Free: 5 forms/month, quota resets monthly
- Pro: unlimited forms
- Stripe checkout for upgrade
- Billing portal for subscription management
- Quota approaching email at 80% usage

---

### 13. Multi-Language Support

**Description:** Field explanations generated in user's preferred language. 12 languages supported.

**Supported languages:** English, Espanol, Simplified Chinese, Traditional Chinese, Cantonese, Korean, Vietnamese, Tagalog, Arabic, Hindi, French, Portuguese

**Acceptance criteria:**
- Language selector on form detail page
- Re-explain fields in selected language via API call
- Preferred language stored in profile and used by default

---

### 14. Chrome Extension

**Description:** Browser extension for filling web forms directly on external websites.

**User flow:**
1. Download extension from Extension page
2. Install in Chrome (developer mode)
3. Authorize with FormPilot account
4. Use on any web form

**Acceptance criteria:**
- Download link on /dashboard/extension
- Step-by-step installation instructions
- Extension authenticates with FormPilot session

---

### 15. Email Notifications

**Description:** Automated emails for key lifecycle events.

**Emails sent:**
- Welcome email on signup
- Form analyzed confirmation (form title, field count)
- Quota approaching warning (at 80% of free tier)
- Form abandoned reminder (48h idle, with dismiss link)
- Pro upgrade confirmation

**Acceptance criteria:**
- Each email renders correctly with user personalization
- Quota email only sent once per billing period
- Abandoned form email respects 7-day cooldown
- All emails include unsubscribe/dismiss mechanism

---

### 16. Re-Fill from Previous Form

**Description:** When uploading a new form of the same type, offer to re-fill values from a previously completed form.

**Acceptance criteria:**
- AI maps fields between old and new form
- Date fields that shouldn't be copied are excluded
- User can review and modify re-filled values

---

## Out of Scope

These are intentionally excluded from FormPilot MVP:

- **No e-signature or notarization** — FormPilot fills forms, not signs them
- **No multi-party / collaborative filling** — single-user only
- **No custom form builder** — we parse existing forms, not create new ones
- **No real-time government database lookups** — no SSA, IRS, or USCIS API integrations
- **No OCR** — Claude handles field intelligence, not optical character recognition
- **No mobile app** — web-only (responsive web planned)
