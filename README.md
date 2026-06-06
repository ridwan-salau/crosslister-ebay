# eBay Cross-Lister

Chrome extension to cross-list eBay listings to Depop, Poshmark, and Mercari with one click.

## Features

- Multi-platform: Depop, Poshmark, Mercari (extensible)
- One-click: scrape eBay → opens target platform → fills the form automatically
- Multi-select: check multiple platforms and cross-list to all at once
- Smart field matching: fuzzy text + AI (Gemini) for categories, sizes, colors
- Image transfer: downloads eBay photos, converts WebP→JPEG where needed
- Per-platform settings: price buffer (markup or markdown), shipping, address
- AI description rewrite: Gemini transforms eBay descriptions to platform-appropriate tone
- Listing history in the popup

## Installation (Development)

1. Clone: `git clone git@github.com:ridwan-salau/crosslister-ebay.git`
2. Chrome → `chrome://extensions/` → toggle **Developer mode**
3. **Load unpacked** → select the project directory
4. No build step — Manifest V3 loads files directly

## Project Structure

```
├── manifest.json              # Multi-platform content scripts, permissions
├── background-wrapper.js       # importScripts loader for background modules
├── popup.html / popup.js       # Settings UI (tabs, per-platform config)
│
├── shared/                     # Cross-cutting utilities
│   ├── message-client.js       # safeSendMessage() wrapper
│   ├── dom-utils.js            # sleep(), escapeHtml()
│   ├── react-utils.js          # setReactValue(), setReactTextarea()
│   ├── combobox-utils.js       # fillClickDropdown(), fillCombobox(),
│   │                           #   resolveEl(), matchScore(), read/click variants
│   ├── image-utils.js          # uploadImages(), fetchImageViaBackground(),
│   │                           #   convertToJpeg(), isWebP()
│   └── ui-utils.js             # makeBanner(), showToast(), showSignupModal()
│
├── background/                 # Service worker
│   ├── index.js                # Message router
│   ├── storage.js              # Staging, history, signup state
│   ├── gemini.js               # Gemini client (callGemini, batchMatch,
│   │                           #   transformDescription)
│   └── image-proxy.js          # CORS bypass for image/text fetching
│
├── marketplaces/               # Platform definitions (DRY — add new platforms here)
│   ├── registry.js             # Platform list, URL→key mapping
│   ├── depop/config.js         # Depop selectors, hooks, field mapping
│   ├── poshmark/config.js      # Poshmark: two-level click dropdowns, size grid
│   └── mercari/config.js       # Mercari (stub)
│
└── content/                    # Content scripts injected into pages
    ├── base-filler.js          # Platform-agnostic form engine: fillForm()
    ├── ebay.js                 # eBay scraper + platform picker UI
    ├── depop.js                # Depop bootstrap (fillForm + address + submit)
    ├── poshmark.js             # Poshmark bootstrap (fillForm + Next button)
    └── mercari.js              # Mercari bootstrap (stub)
```

## Architecture

### Data flow

```
[eBay page]
    │  ebay.js scrapes DOM → {title, price, description, images,
    │    category, condition, brand, size, color, itemSpecifics}
    ▼
[background/index.js]  ← STAGE_LISTING
    │  holds data in memory
    ▼
[target platform page]
    │  GET_STAGED_LISTING → item
    ▼
[base-filler.js]  fillForm(config, item, settings)
    │  iterates fieldOrder, resolves values, runs hooks,
    │  fuzzy-matches or AI-batches combobox fields
    ▼
[platform bootstrap]  post-fill hooks (address, worldwide, submit)
```

### Combobox strategies

- **Type-to-filter** (Depop): types into `<input>`, reads `[role="option"]` from dropdown, fuzzy-matches text
- **Click-to-select** (Poshmark): clicks trigger, reads `.dropdown__link` or custom `optionRole`, clicks best match
- **Two-level** (Poshmark category): clicks top-level, waits, scores sub-options in second `<ul>`

### AI matching (batch)

When `preferAi` is enabled (default) and Gemini key is configured:

1. All `aiBatchable` fields collect dropdown options without fuzzy matching
2. Single batched Gemini call matches all fields at once using structured output
3. Category-dependent fields (size, brand) get a second pass after category is set
4. Context sent to LLM: title + description + full item specifics from eBay

### Key config options per platform

Each `config.js` defines:
- `selectors` — text/input/combobox/imageUpload DOM targets
- `comboboxConfig` — optionRole, disabledAttr, twoLevel support
- `fieldOrder` — order fields are filled (respects dependencies)
- `fieldMapping` — source → target mapping, fuzzyMatch, aiBatchable, useMap, hooks
- `hooks` — pre/post hooks for fields (open modals, confirm selections, handle subcategories)
- `conditionMap` — eBay → platform condition keyword mapping

### Adding a new marketplace

1. Create `marketplaces/<name>/config.js` with selectors, fieldOrder, fieldMapping, hooks
2. Add to `marketplaces/registry.js`
3. Create `content/<name>.js` bootstrap (calls fillForm + platform-specific post-fill)
4. Add content_scripts entry in `manifest.json`
5. Add tab in `popup.html` + `popup.js`

## Development Notes

- **No build step** — all files are plain JS loaded via manifest `content_scripts`
- **Content script isolation** — cannot access page JS objects (Vue, React internals). All interaction is via DOM events
- **React compatibility** — `setReactValue()` uses native property descriptors + synthetic `input`/`change` events
- **Gemini structured output** — uses `responseMimeType` + `responseSchema` in generationConfig. Model is configurable in popup
- **Storage keys** — `platformSettings` (per-platform), `geminiKey`, `geminiModel`, `aiEnabled`, `listingHistory`
- **Staged data** — held in memory (service worker variable), consumed by target tab. Multi-platform re-stages before each `window.open`

## Privacy

All data stays in-browser. External requests only:
- eBay image CDN (via background proxy for CORS)
- Google Gemini API (only if key configured)
