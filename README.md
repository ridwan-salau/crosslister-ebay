# eBay → Depop Crosslister

A Chrome extension that copies eBay listing data into Depop's listing form with one click.

## Features

- **One-click scrape** — extracts title, price, description, images, category, brand, condition, size, and shipping from any eBay listing page
- **Smart field matching** — fuzzy-matches eBay values to Depop's autocomplete options for category, brand, and condition
- **Image transfer** — downloads eBay photos and uploads them to Depop's form automatically
- **Price buffer** — optionally add a percentage markup on Depop to offset fee differences
- **AI description rewrite** — optionally use Google Gemini to transform technical eBay descriptions into Depop's casual, hashtag-heavy style (disabled by default)
- **Listing history** — tracks your recent cross-lists in the extension popup

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Toggle **Developer mode** on (top-right switch)
4. Click **Load unpacked** and select the project folder
5. The extension icon appears in your toolbar

## Usage

1. Navigate to any eBay listing page (`ebay.com/itm/...`)
2. Click the pink **⚡ Copy to Depop** button that appears near the price
3. A new Depop tab opens — navigate through Depop's listing steps until you reach the form with description, category, and price fields
4. Click the red banner at the top of the page to paste everything in
5. Review the populated fields and click **Continue** on Depop

## Settings

Click the extension icon in the toolbar to configure:

- **Gemini API Key** — needed only if you want AI description rewriting. [Get a free key](https://aistudio.google.com/apikey)
- **Price Buffer (%)** — markup added to the eBay price on Depop (default: 10%)
- **Shipping** — preset package size to select on Depop
- **AI Description Rewrite** — toggle on/off (default: off)

## How it works

**eBay scraping** — The content script reads the DOM for title, price, description, category breadcrumbs, condition, brand, size, shipping cost, and high-resolution images.

**Data staging** — The background service worker holds the scraped data in memory until the Depop tab requests it.

**Depop form filling** — The content script uses React-compatible value setters (native property descriptors + synthetic events) and fuzzy text matching to select the closest options in Depop's autocomplete dropdowns.

**Image transfer** — Images are fetched through the background worker (which bypasses CORS), converted to `File` objects, and attached to Depop's file input via `DataTransfer`.

## Privacy

All data stays in your browser. The extension makes no external network requests except:
- Fetching eBay images (to your Depop tab)
- Optionally calling the Google Gemini API (only if you configure an API key and enable AI rewriting)

No analytics, no tracking, no third-party servers.

## License

MIT
