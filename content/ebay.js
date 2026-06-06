// content/ebay.js — eBay scraper with platform picker dropdown

const BUTTON_ID = 'xlister-ebay-btn';
const DROPDOWN_ID = 'xlister-dropdown';
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

function buildButton(wrapper) {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerText = '📦 Cross-list to...';
  btn.style.cssText = 'background:#333;color:white;padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:transform .1s,box-shadow .1s;';
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.03)'; btn.style.boxShadow = '0 4px 14px rgba(0,0,0,.3)'; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.2)'; };
  btn.onclick = (e) => { e.stopPropagation(); toggleDropdown(); };
  wrapper.appendChild(btn);
  return btn;
}

function buildDropdown(wrapper, openUp) {
  const dropdown = document.createElement('div');
  dropdown.id = DROPDOWN_ID;
  dropdown.style.cssText = (openUp
    ? 'display:none;position:absolute;bottom:100%;right:0;margin-bottom:4px;'
    : 'display:none;position:absolute;top:100%;left:0;margin-top:4px;'
  ) + 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:99999;overflow:hidden;min-width:200px;';
  if (!openUp) wrapper.style.position = 'relative';
  dropdown.addEventListener('click', function(e) { e.stopPropagation(); });

  const platforms = getAllPlatforms();
  platforms.forEach(function(p) {
    var cbId = 'xlister-cb-' + p.key;
    var row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;transition:background .15s;';
    row.onmouseenter = function() { row.style.background = '#f5f5f5'; };
    row.onmouseleave = function() { row.style.background = 'transparent'; };
    row.innerHTML = '<input type="checkbox" id="' + cbId + '" value="' + p.key + '" style="margin:0;accent-color:' + p.color + ';cursor:pointer;">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + p.color + ';flex-shrink:0;"></span>' +
      '<span style="color:#333;font-weight:500;">' + p.name + '</span>';
    dropdown.appendChild(row);
  });

  var copyBtn = document.createElement('button');
  copyBtn.style.cssText = 'width:100%;padding:10px;border:none;background:#333;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,sans-serif;border-radius:0 0 8px 8px;transition:opacity .15s;';
  copyBtn.innerText = 'Copy to selected';
  copyBtn.onmouseenter = function() { copyBtn.style.opacity = '0.9'; };
  copyBtn.onmouseleave = function() { copyBtn.style.opacity = '1'; };
  copyBtn.onclick = function() {
    var checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) return;
    var selected = [];
    checked.forEach(function(cb) {
      var p = platforms.find(function(pl) { return pl.key === cb.value; });
      if (p) selected.push(p);
    });
    hideDropdown();
    handleCopyMulti(selected);
  };
  dropdown.appendChild(copyBtn);

  wrapper.appendChild(dropdown);
  return dropdown;
}

function toggleDropdown() {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function hideDropdown() {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (dropdown) dropdown.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#xlister-container')) hideDropdown();
});

function injectNear(el) {
  const wrapper = document.createElement('div');
  wrapper.id = 'xlister-container';
  wrapper.style.cssText = 'margin:12px 0;display:flex;align-items:center;gap:8px;z-index:9999;position:relative;';

  buildButton(wrapper);
  buildDropdown(wrapper, false);

  const status = document.createElement('span');
  status.id = STATUS_ID;
  status.style.cssText = 'font-size:13px;color:#555;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
  wrapper.appendChild(status);

  if (el.parentNode) {
    el.parentNode.insertBefore(wrapper, el.nextSibling);
  }
}

function injectFloating() {
  var wrapper = document.createElement('div');
  wrapper.id = 'xlister-container';
  wrapper.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'position:relative;';

  var btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerText = '📦 Cross-list to...';
  btn.style.cssText = 'background:#333;color:white;padding:12px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:transform .15s;';
  btn.onmouseenter = function() { btn.style.transform = 'scale(1.05)'; };
  btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };
  btn.onclick = function(e) { e.stopPropagation(); toggleDropdown(); };

  buildDropdown(btnRow, true);

  btnRow.insertBefore(btn, btnRow.firstChild);
  wrapper.appendChild(btnRow);

  var status = document.createElement('span');
  status.id = STATUS_ID;
  status.style.cssText = 'font-size:12px;color:#fff;background:rgba(0,0,0,.75);padding:4px 10px;border-radius:4px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
  wrapper.appendChild(status);
  document.body.appendChild(wrapper);
}

async function handleCopyMulti(platforms) {
  const btn = document.getElementById(BUTTON_ID);
  const status = document.getElementById(STATUS_ID);
  btn.disabled = true;
  btn.innerText = '⏳ Scraping...';
  status.innerText = '';

  try {
    const data = extractEbayData();
    if (!data.title) {
      throw new Error('Could not read listing title. Make sure you are on an eBay item page.');
    }

    if (!data.description) {
      status.innerText = 'Fetching description...';
      data.description = await fetchDescriptionViaBackground() || '';
    }

    var names = platforms.map(function(p) { return p.name; }).join(' + ');
    status.innerText = 'Opening ' + names + '...';

    // Stage and open each platform sequentially so each tab gets fresh data
    var pIndex = 0;
    function openNext() {
      if (pIndex >= platforms.length) {
        btn.disabled = false;
        btn.innerText = '✓ Done';
        btn.style.background = '#2ecc71';
        status.innerText = '✓ Opened ' + platforms.length + ' platform(s)';
        return;
      }
      var p = platforms[pIndex++];
      chrome.runtime.sendMessage({ action: 'STAGE_LISTING', data: data }, function(response) {
        if (chrome.runtime.lastError || !response || !response.success) {
          status.innerText = 'Error: ' + (chrome.runtime.lastError?.message || 'unknown');
          btn.disabled = false;
          btn.innerText = '📦 Cross-list to...';
          btn.style.background = '#333';
          return;
        }
        window.open(p.createUrl, '_blank');
        setTimeout(openNext, 500);
      });
    }
    openNext();
  } catch (err) {
    status.innerText = 'Error: ' + err.message;
    btn.disabled = false;
    btn.innerText = '📦 Cross-list to...';
    btn.style.background = '#333';
  }
}

function extractEbayData() {
  const itemIdMatch = window.location.pathname.match(/\/itm\/(\d+)/);
  const itemId = itemIdMatch ? itemIdMatch[1] : '';

  const titleEl = document.querySelector('.x-item-title__mainTitle') ||
                  document.querySelector('[data-testid="x-item-title"]') ||
                  document.querySelector('.it-ttl') ||
                  document.querySelector('#itemTitle') ||
                  document.querySelector('h1');
  const title = titleEl ? titleEl.innerText.trim() : '';

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

  const metaDesc = document.querySelector('meta[name="description"]');
  const description = metaDesc ? metaDesc.getAttribute('content')?.trim() || '' : '';

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

  let category = '';
  const bcLinks = document.querySelectorAll('nav[aria-label="Breadcrumb"] a, .breadcrumb a, [data-testid="x-breadcrumb"] a');
  if (bcLinks.length > 0) {
    const seen = new Set();
    category = Array.from(bcLinks)
      .map(el => el.innerText.trim())
      .filter(t => t && !seen.has(t) && seen.add(t))
      .join(' > ');
  }

  let condition = '', brand = '', size = '', color = '';
  document.querySelectorAll('.elevated-info__item, [data-testid="x-elevated-info"] .elevated-info__item').forEach(item => {
    const label = item.querySelector('.elevated-info__item__label')?.innerText?.trim() || '';
    const value = item.querySelector('.elevated-info__item__value')?.innerText?.trim() || '';
    const labelLower = label.toLowerCase();
    if (labelLower === 'condition') condition = value;
    if (labelLower === 'brand') brand = value;
    if (labelLower === 'size') size = value;
    if (labelLower === 'color' || labelLower === 'colour') color = value;
  });
  // Fallback: look for color in item specifics table
  if (!color) {
    document.querySelectorAll('.ux-labels-values__labels, .ux-labels-values--color .ux-labels-values__values-content, .itemAttr tr, [data-testid="ux-labels-values"] .ux-labels-values__labels').forEach(function (el) {
      var labelText = (el.querySelector('.ux-labels-values__labels-content') || el).innerText.trim().toLowerCase();
      if (labelText === 'color' || labelText === 'colour') {
        var valEl = el.closest('.ux-labels-values')?.querySelector('.ux-labels-values__values-content') ||
                    el.parentElement?.querySelector('.ux-labels-values__values-content') ||
                    el.nextElementSibling;
        if (valEl) color = valEl.innerText.trim();
      }
    });
  }

  let shippingText = '';
  const shippingSection = document.querySelector('.ux-labels-values--shipping');
  if (shippingSection) {
    shippingText = shippingSection.querySelector('.ux-labels-values__values-content')?.innerText?.trim() || '';
  }

  // Extract full item specifics for AI context
  var itemSpecifics = '';
  var specificsRows = document.querySelectorAll('[data-testid="ux-labels-values"]');
  specificsRows.forEach(function (row) {
    var label = row.querySelector('.ux-labels-values__labels-content')?.innerText?.trim() || '';
    var value = row.querySelector('.ux-labels-values__values-content')?.innerText?.trim() || '';
    if (label && value) itemSpecifics += (itemSpecifics ? '; ' : '') + label + ': ' + value;
  });

  return {
    itemId, title, price, description,
    images: hiResImages,
    category, condition, brand, size, color,
    shipping: shippingText,
    itemSpecifics,
    ebayUrl: window.location.href,
    scrapedAt: Date.now()
  };
}

async function fetchDescriptionViaBackground() {
  const descIframe = document.querySelector('#desc_ifr');
  if (!descIframe || !descIframe.src) return null;
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(
        { action: 'FETCH_TEXT', url: descIframe.src },
        (response) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(response?.text || null);
        }
      );
    } catch (e) { resolve(null); }
  });
}

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

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => tryInject(), 1500);
  }
}).observe(document, { subtree: true, childList: true });
