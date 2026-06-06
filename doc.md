# eBay Cross-Lister — User Guide

## Setup

1. Install the extension (see README)
2. Click the extension icon → **Gemini API Key** — paste your key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. Configure platform-specific settings per tab:
   - **Depop**: Price Buffer, Package Size, Shipping Address, Worldwide shipping
   - **Poshmark**: Price Buffer
   - **Mercari**: Price Buffer
4. Enable/disable **AI Description Rewrite** — rewrites eBay descriptions in the platform's style
5. Leave **Prefer AI matching** on (default) — uses Gemini for accurate category/size/color matching

## Cross-listing

1. Go to any eBay listing (`ebay.com/itm/...`)
2. Click **📦 Cross-list to...** near the price
3. Check one or more target platforms
4. Click **Copy to selected**
5. Each platform opens in a new tab — the form fills automatically
6. Review and submit

## Per-Platform Behavior

### Depop
- Fills: description (title + AI rewrite), price, category, size, brand, condition, package size, images
- Optionally adds shipping address and enables worldwide shipping
- Auto-clicks **Continue** at the end

### Poshmark
- Fills: price (disables Smart Sell), title, description, category (two-level), subcategory, size (grid), color (tiles), brand, condition, images
- Handles covershot modal (sets minimum zoom, clicks Apply)
- Auto-clicks **Next** at the end

### Mercari
- Stub — coming soon

## Settings Reference

| Setting | Description |
|---|---|
| Gemini API Key | Required for AI description rewrite and AI field matching |
| Gemini Model | Model used for AI calls (default: gemini-3.1-flash-lite) |
| AI Description Rewrite | Transforms eBay description into platform-appropriate tone |
| Prefer AI matching | Uses Gemini to match categories, sizes, colors (more accurate than fuzzy text) |
| Price Buffer (%) | Positive = markup, negative = markdown. Per-platform |
| Package Size (Depop) | Preset shipping size: XXS through XL |
| Shipping Address (Depop) | Pre-fills the "Add new shipping address" form |
| Offer worldwide shipping | Enables the worldwide shipping checkbox on Depop |

## Tips

- **Multi-platform**: Check Depop + Poshmark together to cross-list in one go
- **Price buffer**: Set to 0% for no change, or use -10% for a discount on platforms with lower fees
- **AI matching**: Works best with a Gemini API key. Without it, falls back to fuzzy text matching which may be less accurate
- **Item specifics**: The extension reads all item specifics from eBay (fabric, material, pattern, measurements) and passes them to the AI for smarter matching
