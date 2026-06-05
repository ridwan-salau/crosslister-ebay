// ebay-content.js — runs on eBay listing pages, injects "Copy to Depop" button

const BUTTON_ID = 'xlister-ebay-btn';
const STATUS_ID = 'xlister-ebay-status';

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const anchorSelectors = [
    '.x-price-section', '[data-testid="x-price-section"]',
    '.x-item-title', '[data-testid="x-item-title"]',
    '.x-elevated-info', '[data-testid="x-elevated-info"]',
    '.it-ttl', '#itemTitle',
    '.x-price-primary', '[data-testid="x-price-primary"]',
    'main', '[role="main"]',
  ];

  let targetEl = null;
  for (const sel of anchorSelectors) {
    targetEl = document.querySelector(sel);
    if (targetEl) break;
  }

  if (targetEl) {
    injectNear(targetEl);
  } else {
    injectFloating();
  }
}

function injectNear(el) {
  const wrapper = document.createElement('div');
  wrapper.id = 'xlister-container';
  wrapper.style.cssText = 'margin:12px 0;display:flex;align-items:center;gap:8px;z-index:9999;position:relative;';

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerText = '⚡ Copy to Depop';
  btn.style.cssText =
    'background:#ff0050;color:white;padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 2px 8px rgba(255,0,80,0.3);transition:transform .1s,box-shadow .1s;';
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.03)'; btn.style.boxShadow = '0 4px 14px rgba(255,0,80,0.4)'; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 2px 8px rgba(255,0,80,0.3)'; };
  btn.onclick = handleCopyClick;

  const status = document.createElement('span');
  status.id = STATUS_ID;
  status.style.cssText = 'font-size:13px;color:#555;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

  wrapper.appendChild(btn);
  wrapper.appendChild(status);

  if (el.parentNode) {
    el.parentNode.insertBefore(wrapper, el.nextSibling);
  }
}

function injectFloating() {
  const wrapper = document.createElement('div');
  wrapper.id = 'xlister-container';
  wrapper.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;';

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerText = '⚡ Copy to Depop';
  btn.style.cssText =
    'background:#ff0050;color:white;padding:12px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(255,0,80,0.4);transition:transform .15s;';
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
  btn.onclick = handleCopyClick;

  const status = document.createElement('span');
  status.id = STATUS_ID;
  status.style.cssText = 'font-size:12px;color:#fff;background:rgba(0,0,0,.75);padding:4px 10px;border-radius:4px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

  wrapper.appendChild(btn);
  wrapper.appendChild(status);
  document.body.appendChild(wrapper);
}

async function handleCopyClick() {
  const btn = document.getElementById(BUTTON_ID);
  const status = document.getElementById(STATUS_ID);
  btn.disabled = true;
  btn.innerText = '⏳ Scraping...';
  status.innerText = '';

  try {
    const data = extractEbayData();
    if (!data.title) {
      throw new Error('Could not read listing title. Make sure you are on an eBay item page (URL contains /itm/).');
    }

    // If description is empty (cross-origin iframe), fetch it via background worker
    if (!data.description) {
      status.innerText = 'Fetching description...';
      data.description = await fetchDescriptionViaBackground() || '';
    }

    status.innerText = 'Sending to background...';
    chrome.runtime.sendMessage({ action: 'STAGE_LISTING', data }, (response) => {
      if (chrome.runtime.lastError) {
        status.innerText = 'Error: ' + chrome.runtime.lastError.message;
        btn.disabled = false;
        btn.innerText = '⚡ Copy to Depop';
        return;
      }
      if (response && response.success) {
        status.innerText = '✓ Staged! Opening Depop...';
        btn.innerText = '✓ Done';
        btn.style.background = '#2ecc71';
        window.open('https://www.depop.com/products/create/', '_blank');
      }
    });
  } catch (err) {
    status.innerText = 'Error: ' + err.message;
    btn.disabled = false;
    btn.innerText = '⚡ Copy to Depop';
  }
}

function extractEbayData() {
  const itemIdMatch = window.location.pathname.match(/\/itm\/(\d+)/);
  const itemId = itemIdMatch ? itemIdMatch[1] : '';

  // Title
  const titleEl = document.querySelector('.x-item-title__mainTitle') ||
                  document.querySelector('[data-testid="x-item-title"]') ||
                  document.querySelector('.it-ttl') ||
                  document.querySelector('#itemTitle') ||
                  document.querySelector('h1');
  const title = titleEl ? titleEl.innerText.trim() : '';

  // Price — prefer Buy It Now
  let priceText = '';
  const binPriceEl = document.querySelector('.x-bin-price .x-price-primary');
  if (binPriceEl) {
    priceText = binPriceEl.innerText;
  } else {
    const priceEl = document.querySelector('.x-price-primary') ||
                    document.querySelector('[data-testid="x-price-primary"]');
    if (priceEl) priceText = priceEl.innerText;
  }
  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

  // Description — iframe is cross-origin, fetched async via background worker

  // Images — prefer data-zoom-src (highest resolution)
  const images = [];
  document.querySelectorAll('.ux-image-carousel-item img, .ux-image-filmstrip-carousel-item img').forEach(img => {
    const src = img.getAttribute('data-zoom-src') || img.dataset.src || img.src;
    if (src && !images.includes(src)) images.push(src);
  });
  if (images.length === 0) {
    const mainImg = document.querySelector('#icImg');
    if (mainImg) {
      const src = mainImg.getAttribute('data-zoom-src') || mainImg.src;
      if (src) images.push(src);
    }
  }
  const hiResImages = images.map(url =>
    url.replace(/\/s-l(?:64|140|300|400|500|960|1000)\//, '/s-l1600/')
  );

  // Category breadcrumbs (deduplicated)
  let category = '';
  const bcLinks = document.querySelectorAll('nav[aria-label="Breadcrumb"] a, .breadcrumb a, [data-testid="x-breadcrumb"] a');
  if (bcLinks.length > 0) {
    const seen = new Set();
    category = Array.from(bcLinks)
      .map(el => el.innerText.trim())
      .filter(t => t && !seen.has(t) && seen.add(t))
      .join(' > ');
  }

  // Condition, Brand, Size from elevated-info section
  let condition = '', brand = '', size = '';
  document.querySelectorAll('.elevated-info__item, [data-testid="x-elevated-info"] .elevated-info__item').forEach(item => {
    const label = item.querySelector('.elevated-info__item__label')?.innerText?.trim() || '';
    const value = item.querySelector('.elevated-info__item__value')?.innerText?.trim() || '';
    if (label === 'Condition') condition = value;
    if (label === 'Brand') brand = value;
    if (label === 'Size') size = value;
  });

  // Shipping
  let shippingText = '';
  const shippingSection = document.querySelector('.ux-labels-values--shipping');
  if (shippingSection) {
    shippingText = shippingSection.querySelector('.ux-labels-values__values-content')?.innerText?.trim() || '';
  }

  return {
    itemId, title, price, description,
    images: hiResImages,
    category, condition, brand, size,
    shipping: shippingText,
    ebayUrl: window.location.href,
    scrapedAt: Date.now()
  };
}

// Init with retry for lazy-loaded content
function tryInject(retries = 10, interval = 500) {
  injectButton();
  if (!document.getElementById(BUTTON_ID) && retries > 0) {
    setTimeout(() => tryInject(retries - 1, interval), interval);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => tryInject());
} else {
  tryInject();
}

async function fetchDescriptionViaBackground() {
  const descIframe = document.querySelector('#desc_ifr');
  if (!descIframe || !descIframe.src) return null;
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'FETCH_TEXT', url: descIframe.src },
      (response) => resolve(response?.text || null)
    );
  });
}

// Re-inject on SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => tryInject(), 1500);
  }
}).observe(document, { subtree: true, childList: true });
