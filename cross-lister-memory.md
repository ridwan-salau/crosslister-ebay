# eBay Cross-Lister — Session Context (2026-06-05)

## Project Location
`/Users/ridwan/Documents/personal/cross-lister/`
**Repo:** `git@github.com:ridwan-salau/crosslister-ebay.git` (branch: `main`)
**Current state:** Directory is inaccessible due to macOS permissions issue. All code is committed and pushed to GitHub. Can clone fresh.

## What We Built

A Chrome extension (Manifest V3) that cross-lists eBay items to Depop, Poshmark, and Mercari. 

### Architecture (multi-file, no build step)
```
cross-lister/
  manifest.json                    # Multi-platform content scripts
  background-wrapper.js             # importScripts loader
  popup.html / popup.js            # Settings, platform selector, signup

  shared/
    message-client.js              # safeSendMessage()
    dom-utils.js                   # sleep(), escapeHtml()
    react-utils.js                 # setReactValue(), setReactTextarea()
    combobox-utils.js              # fillCombobox(), matchScore(), readComboboxOptions()
    image-utils.js                 # uploadImages(), fetchImageViaBackground()
    ui-utils.js                    # makeBanner(), showToast(), showSignupModal()

  background/
    index.js                       # Message router
    storage.js                     # Staging, history, signup state
    gemini.js                      # Gemini client: transformDescription(), batchMatch()
    image-proxy.js                 # CORS bypass: fetchImageAsDataUrl(), fetchPageText()

  marketplaces/
    registry.js                    # Platform defs: Depop, Poshmark, Mercari
    depop/config.js                # Complete — selectors, condition map, field order
    poshmark/config.js             # Stale — needs price modal hooks (locked file issue)
    mercari/config.js              # Stub — mercari.com HTML not yet provided

  content/
    base-filler.js                 # Platform-agnostic form engine: fillForm()
    ebay.js                        # eBay scraper + platform picker dropdown
    depop.js                       # ~25-line bootstrap for Depop
    poshmark.js                    # ~40-line bootstrap for Poshmark
    mercari.js                     # ~20-line stub for Mercari
```

### Key Features
- **eBay scraping:** Title, price, description (meta tag + iframe fallback), images (hi-res via data-zoom-src), category breadcrumbs (dedup), condition, brand, size from elevated-info section
- **Platform picker:** eBay button says "📦 Cross-list to..." → dropdown shows Depop/Poshmark/Mercari with colored dots
- **Depop form filling:** Fully functional — description (title + description merged), price with buffer, category/brand/condition via fuzzy-matched comboboxes, size with AI translation fallback, image upload
- **Poshmark form filling:** Config populated with real selectors from HTML. Price modal handling NOT yet implemented (file was locked when trying to write hooks)
- **Mercari:** Stub only — no HTML provided yet
- **Batch AI:** Collects all unmatched fields and sends ONE Gemini structured output call (`BATCH_MATCH`)
- **Signup:** Google Form pre-filled URL opened in new tab, shown at random intervals (3-7 cross-lists)
- **Condition mapping:** Exact eBay→Depop and eBay→Poshmark tables
- **Permissions:** Only `storage` (removed unused `activeTab` and `scripting`)

### Commit History (most recent first)
```
5f9e06a Replace pre-configured platform with in-page dropdown picker
effd4af Gitignore poshmark-create-listing.html
3f58406 Populate Poshmark config with real form selectors
6d219f9 Refactor to multi-platform architecture
86a50e8 Gitignore sample-out.html
b0f7796 Fix missing description variable declaration
f0424fd Harden condition mapping
7b64d96 Add exact eBay-to-Depop condition mapping table
```

## Current Blocker: Poshmark Price Modal

Poshmark opens a modal (`[data-test="modal-container"]`) when the price field is focused. It contains:
- `#listing-price-modal-listing-price-input` — actual price input
- Smart Sell toggle (`[data-test="toggle-input"]`) — must be disabled
- `#listing-price-modal-original-price-input` — original price
- `.btn--primary` — Done button to dismiss

### What needs to happen:
1. **poshmark/config.js:** Add `hooks.prePrice` (focus main price field to trigger modal, wait, disable Smart Sell toggle) and `hooks.postPrice` (fill original price, click Done). Point `selectors.input.price` at the modal's `#listing-price-modal-listing-price-input`.
2. **content/base-filler.js:** Update `fillForm()` to call `cfg.hooks.preField()` and `cfg.hooks.postField()` when a field has `hasHooks: true`.

### The locked file issue:
`marketplaces/poshmark/config.js` was locked by macOS ("Operation not permitted"). The user didn't intentionally lock it. The entire `cross-lister/` directory became inaccessible. User needs to fix macOS permissions (System Settings → Privacy & Security → Files and Folders → grant Documents access to terminal/IDE). Then clone fresh from GitHub.

## Remaining Tasks
1. [ ] Fix macOS permissions, re-clone from GitHub
2. [ ] Update `poshmark/config.js` with price modal hooks
3. [ ] Update `base-filler.js` to invoke hooks
4. [ ] Test Poshmark flow end-to-end
5. [ ] Get Mercari create-listing HTML → populate `mercari/config.js`
6. [ ] Test all three platforms
7. [ ] Chrome Web Store submission (permissions justified, privacy policy ready)
