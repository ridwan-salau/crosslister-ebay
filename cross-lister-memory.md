# eBay Cross-Lister — Session Context (2026-06-05)

## Project Location & Repo
`/Users/ridwan/Documents/personal/cross-lister/`
**Repo:** `git@github.com:ridwan-salau/crosslister-ebay.git` (branch: `main`)

## What Works

### Depop — fully functional
- Title + description, price with buffer, category/brand/condition/size via type-to-filter comboboxes, shipping, images

### Poshmark — partially working
**Working:**
- Price modal, title, description, category (two-level dropdown), condition
- Image conversion: webp→JPEG via Canvas API

**Recently fixed (2026-06-05):**
- **Brand field**: `fillCombobox`/`readComboboxOptions`/`clickComboboxOption` now accept CSS selectors via new `resolveEl()` helper — previously only `getElementById`, which failed on `input[placeholder*="Brand"]`
- **Gemini batchMatch**: maxOutputTokens increased 200→1000, temperature 0.1→0 for deterministic output, verbose finishReason logging added
- **Category-dependent fields**: `categoryDependentFields: ['brand', 'size']` + `categoryWaitMs: 1500` + `postCategory` hook polls for brand input & size trigger
- **All combobox functions**: unified to use `resolveEl()` (tries `getElementById` first, falls back to `querySelector`)

**Still to test:**
- Size AI batch — "44" matching against Poshmark letter sizes (was failing due to Gemini issues, fix applied)
- Brand field — selector should now be found (fix applied)
- Image upload — not yet tested

## Architecture
```
marketplaces/registry.js     # Platform defs
shared/combobox-utils.js     # resolveEl(), fillClickDropdown, fillCombobox, read/click variants
background/gemini.js         # Gemini client: callGemini, batchMatch, transformDescription
content/base-filler.js       # Platform-agnostic form engine: fillForm()
```

## Latest fixes
- **Multi-platform cross-listing**: eBay dropdown now shows checkboxes + "Copy to selected" button. Scrape once, stage+open each selected platform sequentially (500ms gap). Re-stages before each window.open so every tab gets fresh data.

## Key Fix Notes

### resolveEl() helper (combobox-utils.js:167-169)
```js
function resolveEl(ref) {
  return (typeof ref === 'string' ? (document.getElementById(ref) || document.querySelector(ref)) : document.getElementById(ref));
}
```
All combobox functions now use this — handles both plain IDs (Depop) and CSS selectors (Poshmark).

### Gemini batchMatch (background/gemini.js:57-91)
- `maxTokens: 1000` (was 200 — too low for structured output, causes empty response)
- `temperature: 0` (was 0.1 — 0 recommended for deterministic structured output)
- Verbose logging: `finishReason`, empty-text diagnostics

### Poshmark postCategory hook (poshmark/config.js:83-96)
Polls up to 5s for `input[placeholder*="Brand"]` and `[data-test="size"]` to appear after category is set.

## Not Yet Started
- Mercari integration
- Poshmark image upload testing
