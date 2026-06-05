# eBay Cross-Lister — Session Context (2026-06-05)

## Project Location & Repo
`/Users/ridwan/Documents/personal/cross-lister/`  
**Repo:** `git@github.com:ridwan-salau/crosslister-ebay.git` (branch: `main`)
**Chrome Web Store:** Submitted with privacy policy, permissions justified (storage only)

## What Works

### Depop — fully functional
- Title + description merged into description field
- Price with optional buffer
- Category/brand/condition via type-to-filter comboboxes (fuzzy matching)
- Size with AI translation fallback (Gemini)
- Image upload
- All fields populate correctly

### Poshmark — partially working
**Working:**
- Price modal: Smart Sell disabled, price filled, original price filled, Done clicked
- Title and description filled
- Category: two-level dropdown working — opens dropdown, clicks top-level "Men" (matched from full eBay path), then clicks subcategory "Suits & Blazers" (matched from leaf). Trigger updates to "Men Suits & Blazers"
- Condition: clicks "New With Tags (NWT)" — selection sticks, trigger updates
- Image conversion: webp→JPEG via Canvas API

**Not working:**
- **Size**: "44" (numeric suit size) doesn't match Poshmark's letter sizes. `fillClickDropdown` fails with "no-match". AI batch collected but returning empty.
- **Brand**: selector `input[placeholder*="Brand"]` not found — may not exist in DOM until certain conditions met
- **Color**: skipped (source is null in config)

## Architecture

Multi-platform Chrome extension (Manifest V3), no build step. Files loaded directly via manifest `content_scripts`.

```
cross-lister/
  manifest.json                    # Multi-platform content scripts
  background-wrapper.js             # importScripts loader for background modules

  shared/
    message-client.js              # safeSendMessage() — wraps chrome.runtime.sendMessage
    dom-utils.js                   # sleep(), escapeHtml()
    react-utils.js                 # setReactValue(), setReactTextarea()
    combobox-utils.js              # fillCombobox(), fillClickDropdown(), matchScore(), readClickDropdownOptions(), clickDropdownOption()
    image-utils.js                 # uploadImages(), fetchImageViaBackground(), convertToJpeg()
    ui-utils.js                    # makeBanner(), showToast(), showSignupModal()

  background/
    index.js                       # Message router
    storage.js                     # Staging, history, signup state
    gemini.js                      # Gemini client: transformDescription(), batchMatch()
    image-proxy.js                 # CORS bypass: fetchImageAsDataUrl(), fetchPageText()

  marketplaces/
    registry.js                    # Platform defs: Depop, Poshmark, Mercari
    depop/config.js                # Complete
    poshmark/config.js             # Current — has hooks, click-mode comboboxes
    mercari/config.js              # Stub

  content/
    base-filler.js                 # Platform-agnostic form engine: fillForm()
    ebay.js                        # eBay scraper + platform picker dropdown
    depop.js                       # Bootstrap for Depop
    poshmark.js                    # Bootstrap for Poshmark — DOM-based approach
    mercari.js                     # Stub
```

## Current Debugging: Poshmark Size

### The problem
Size combobox uses `fillClickDropdown` (click-to-select mode). Found 4 options but "44" matches none. AI batch collected and sent to Gemini but returns empty results.

### Gemini batchMatch issue (LATEST FIX, UNTESTED)
In `background/gemini.js`, the `callGemini` function was using snake_case for schema config:
```js
// WRONG (was):
body.generationConfig.response_mime_type = 'application/json';
body.generationConfig.response_schema = responseSchema;

// FIXED (now):
body.generationConfig.responseMimeType = 'application/json';
body.generationConfig.responseSchema = responseSchema;
```
The Gemini REST API v1beta expects camelCase. The snake_case version was silently ignored, so Gemini returned unstructured text that JSON.parse couldn't handle. Added verbose logging to both `callGemini` and `batchMatch`.

### Poshmark category — two-level dropdown (FIXED, WORKS)
Poshmark's category dropdown is two-level. After clicking a top-level category (e.g., "Men"), the dropdown STAYS OPEN and shows subcategories in a second `<ul>`. The `fillClickDropdown` function now handles this:
1. Click top-level match ("Men")
2. Wait 800ms
3. Check for subcategory `<ul>` lists (skip the first one which is navigation)
4. Score subcategories against leaf of eBay path
5. Click best subcategory match

### Poshmark condition — click-to-select (FIXED, WORKS)
Uses `<div class="dropdown__link">` elements. The `fillClickDropdown` dispatches: pointerdown → mousedown → pointerup → mouseup → click → .click(). Selection sticks, trigger text updates.

### Content script isolation (DISCOVERED)
Content scripts CANNOT access page JavaScript objects (like `__vue__`, Vuex stores). Only DOM events cross the boundary. So the Vuex approach was abandoned in favor of DOM-based clicking.

### Poshmark error modal (HANDLED)
"Sorry! You cannot currently perform this request" modal appears. The `base-filler.js` checks all `[data-test="modal-container"]` elements before filling and clicks `.btn--primary` if text contains "Sorry" or "Error". Modal #7 shows "Error" but OK button not found — may need different selector.

### Brand field (NOT WORKING)
Selector `input[placeholder*="Brand"]` returns null. The brand input is inside `[data-et-name="listingEditorBrandSection"]` but may not exist in DOM until after category is fully set. Needs investigation.

### Remaining Poshmark fields to fix
1. Size — AI batch needs to return results (Gemini camelCase fix should help)
2. Brand — selector not finding the input
3. Images — not tested yet (webp→JPEG conversion should handle it)
4. Color — skipped intentionally (source is null)

## Key Learnings

1. **Poshmark dropdowns are click-to-select**, not type-to-filter like Depop
2. **Poshmark category is two-level** — clicking a top-level option shows subcategories in the same dropdown
3. **Poshmark condition uses <div> elements** that respond to click events; category anchors use `<a>` tags
4. **Click events on DOM elements DO cross content script → page boundary** — the issue with `<a>` tags was not isolation-related
5. **Gemini structured output requires camelCase** property names in the REST API
6. **Content scripts can't access page JS objects** (Vue instances, Vuex stores) — only DOM events

## Not Yet Started
- Mercari integration (no HTML provided)
- Chrome Web Store publication
