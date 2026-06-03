// depop-content.js — runs on Depop listing pages, fills form from staged eBay data

// Current Depop form element IDs (June 2026)
const DEPOP_IDS = {
  imageInput: 'upload-input__input',
  description: 'description',
  categoryInput: 'group-input',
  categoryMenu: 'group-menu',
  brandInput: 'brand-input',
  brandMenu: 'brand-menu',
  sizeInput: 'variants-input',
  sizeMenu: 'variants-menu',
  conditionInput: 'condition-input',
  conditionMenu: 'condition-menu',
  priceInput: 'priceAmount__input',
  shippingInput: 'shippingMethods-input',
  shippingMenu: 'shippingMethods-menu',
};

// --- React-compatible value setters ---
function setReactValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, String(value));
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  if (el._valueTracker) el._valueTracker.setValue(el.value);
}

function setReactTextarea(el, value) {
  setReactValue(el, value);
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 80) + 'px';
}

// --- Fuzzy matching ---
function matchScore(ebayText, optionText) {
  const e = ebayText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const o = optionText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (e === o) return 1.0;
  if (o.includes(e)) return 0.95;
  if (e.includes(o)) return 0.9;

  const eWords = new Set(e.split(' ').filter(w => w.length > 1));
  const oWords = o.split(' ').filter(w => w.length > 1);
  if (eWords.size === 0 || oWords.length === 0) return 0;

  let matched = 0;
  for (const w of oWords) {
    if (eWords.has(w)) { matched++; continue; }
    for (const ew of eWords) {
      if (ew.includes(w) || w.includes(ew)) { matched += 0.5; break; }
    }
  }
  return matched / Math.max(oWords.length, 1);
}

function extractLeafCategory(categoryPath) {
  if (!categoryPath) return '';
  const parts = categoryPath.split(/[>›]/).map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

// --- Combobox filler ---
async function fillCombobox(inputId, menuId, searchText) {
  const input = document.getElementById(inputId);
  if (!input) return false;

  const simplified = extractLeafCategory(searchText) || searchText;

  // Try progressively shorter search terms
  const searchTerms = [
    simplified,
    simplified.split('&')[0].trim(),
    simplified.split(' ').slice(0, 2).join(' '),
    simplified.split(' ')[0],
  ].filter((t, i, arr) => t && t !== arr[i - 1]);

  for (const term of searchTerms) {
    if (!term || term.length < 1) continue;

    input.focus();
    setReactValue(input, term);
    await sleep(1000);

    const menu = document.getElementById(menuId);
    if (!menu) continue;

    let options = Array.from(menu.querySelectorAll('[role="option"]'))
      .filter(opt => opt.getAttribute('aria-disabled') !== 'true');

    if (options.length === 0) {
      if (menu.querySelector('._noOptionText_yfvje_5')) continue;
      input.click();
      await sleep(500);
      options = Array.from(menu.querySelectorAll('[role="option"]'))
        .filter(opt => opt.getAttribute('aria-disabled') !== 'true');
      if (options.length === 0) continue;
    }

    // Score and pick best match
    let bestOption = null, bestScore = 0;
    for (const opt of options) {
      const text = opt.innerText.trim();
      if (!text) continue;
      const sectionHeader = opt.closest('div')?.querySelector('._sectionHeader_yfvje_68')?.innerText?.trim() || '';
      const score = Math.max(
        matchScore(searchText, text),
        matchScore(term, text),
        sectionHeader ? matchScore(searchText, `${sectionHeader} > ${text}`) : 0
      );
      if (score > bestScore) { bestScore = score; bestOption = opt; }
    }

    if (bestOption && bestScore >= 0.2) {
      bestOption.click();
      await sleep(400);
      return true;
    }
    // No strong match — skip this field rather than guess wrong
  }

  document.body.click();
  return false;
}

// --- Main fill ---
async function fillDepopForm(item) {
  updateBanner('⏳ Filling form...');

  const settings = await new Promise(resolve => {
    chrome.storage.local.get(['priceBuffer', 'aiEnabled', 'shippingPreference', 'geminiKey'], resolve);
  });

  const buffer = settings.priceBuffer || 0;
  const adjustedPrice = buffer > 0
    ? (item.price * (1 + buffer / 100)).toFixed(2)
    : item.price.toFixed(2);

  let filled = 0;

  // Description — Depop has no title field, so prepend eBay title
  const descEl = document.getElementById(DEPOP_IDS.description);
  if (descEl) {
    let desc = item.title || '';
    if (item.description) {
      desc += '\n\n' + item.description;
    }
    if (settings.aiEnabled && settings.geminiKey) {
      updateBanner('🤖 AI rewriting description...');
      desc = await transformDescription(desc);
    }
    setReactTextarea(descEl, desc);
    filled++;
  }

  // Price
  const priceEl = document.getElementById(DEPOP_IDS.priceInput);
  if (priceEl) {
    setReactValue(priceEl, adjustedPrice);
    filled++;
  }

  // Category (must be first — condition/brand depend on it)
  updateBanner('📋 Filling category...');
  if (item.category && await fillCombobox(DEPOP_IDS.categoryInput, DEPOP_IDS.categoryMenu, item.category)) {
    filled++;
    await sleep(1500); // wait for dependent fields to load
  }

  // Size (depends on category — uses AI when fuzzy match fails)
  updateBanner('📏 Filling size...');
  if (item.size) {
    const sizeOk = await fillCombobox(DEPOP_IDS.sizeInput, DEPOP_IDS.sizeMenu, item.size);
    if (!sizeOk) {
      const sizeOptions = await readComboboxOptions(DEPOP_IDS.sizeInput, DEPOP_IDS.sizeMenu);
      if (sizeOptions.length > 0 && settings.geminiKey) {
        const context = [item.category, item.title].filter(Boolean).join(' — ');
        const aiIdx = await aiMatchOption(item.size, sizeOptions, 'size', context);
        if (aiIdx >= 0 && aiIdx < sizeOptions.length) {
          await clickComboboxOption(DEPOP_IDS.sizeInput, DEPOP_IDS.sizeMenu, aiIdx);
          filled++;
          updateBanner('🤖 AI translated size...');
        }
      } else if (sizeOptions.length > 0) {
        updateBanner('⚠️ Size needs manual selection — set a Gemini API key for auto-conversion', true);
        showToast('⚠️ Size could not be matched automatically. Configure a Gemini API key in the extension popup to enable size conversion.');
      }
    } else {
      filled++;
    }
  }

  // Brand
  updateBanner('🏷️ Filling brand...');
  if (item.brand && await fillCombobox(DEPOP_IDS.brandInput, DEPOP_IDS.brandMenu, item.brand)) {
    filled++;
  }

  // Condition
  updateBanner('✅ Filling condition...');
  if (item.condition && await fillCombobox(DEPOP_IDS.conditionInput, DEPOP_IDS.conditionMenu, item.condition)) {
    filled++;
  }

  // Shipping
  if (settings.shippingPreference) {
    const shipLabel = { small: 'Small', medium: 'Medium', large: 'Large', xl: 'Extra Large', free: 'Free', manual: 'Arrange' }[settings.shippingPreference] || settings.shippingPreference;
    updateBanner('📦 Filling shipping...');
    if (await fillCombobox(DEPOP_IDS.shippingInput, DEPOP_IDS.shippingMenu, shipLabel)) {
      filled++;
    }
  }

  // Images
  if (item.images && item.images.length > 0) {
    const imageInput = document.getElementById(DEPOP_IDS.imageInput);
    if (imageInput) {
      updateBanner('🖼️ Uploading images...');
      await uploadImages(item.images, imageInput);
      filled++;
    }
  }

  chrome.runtime.sendMessage({
    action: 'LOG_LISTING',
    data: { ebayTitle: item.title, ebayId: item.itemId, price: adjustedPrice }
  });
  chrome.runtime.sendMessage({ action: 'CONSUME_STAGED' });

  updateBanner(`✓ Done! ${filled} fields filled. Review and publish.`);
  showToast(`✓ ${filled} fields pasted — review and publish on Depop.`);
  setTimeout(removeBanner, 4000);
}

// --- Banner ---
function showBanner(stagedItem) {
  if (document.getElementById('xlister-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'xlister-banner';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999999;
    background:linear-gradient(135deg,#ff0050,#ff4d6d);
    color:#fff;padding:10px 20px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:14px;font-weight:600;
    display:flex;align-items:center;justify-content:center;gap:12px;
    box-shadow:0 2px 12px rgba(255,0,80,0.3);
    cursor:pointer;
  `;
  const safeTitle = escapeHtml(stagedItem.title.slice(0, 60));
  banner.innerHTML = `<span>📦 eBay listing ready: <strong>${safeTitle}${stagedItem.title.length > 60 ? '…' : ''}</strong></span> <span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:4px;">Click to paste into form</span>`;
  banner.onclick = () => fillDepopForm(stagedItem);
  document.body.appendChild(banner);
  document.documentElement.style.marginTop = '46px';
}

function updateBanner(text, isError) {
  const banner = document.getElementById('xlister-banner');
  if (!banner) return;
  banner.innerHTML = `<span>${text}</span>`;
  if (isError) {
    banner.style.background = '#e74c3c';
    setTimeout(removeBanner, 5000);
  }
}

function removeBanner() {
  const banner = document.getElementById('xlister-banner');
  if (banner) {
    banner.remove();
    document.documentElement.style.marginTop = '';
  }
}

// --- Helpers ---
async function transformDescription(original) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'TRANSFORM_DESCRIPTION', description: original },
      (response) => resolve(response?.transformed || original)
    );
  });
}

async function uploadImages(imageUrls, fileInput) {
  const files = [];
  for (const url of imageUrls.slice(0, 8)) {
    try {
      const blob = await fetchImageViaBackground(url);
      if (blob) {
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        files.push(new File([blob], `ebay-${files.length + 1}.${ext}`, { type: blob.type || 'image/jpeg' }));
      }
    } catch (_) { /* skip failed images */ }
  }
  if (files.length === 0) return;

  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
}

async function fetchImageViaBackground(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'FETCH_IMAGE_BLOB', url }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (response?.dataUrl) {
        const arr = response.dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        resolve(new Blob([u8arr], { type: mime }));
      } else {
        reject(new Error(response?.error || 'Unknown'));
      }
    });
  });
}

function showToast(message) {
  const existing = document.querySelector('.xlister-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'xlister-toast';
  toast.innerText = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999999;
    background:#1a1a1a;color:#fff;padding:12px 20px;
    border-radius:8px;font-size:14px;font-family:-apple-system,sans-serif;
    box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:360px;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 5000);
}

// Read all available options from a combobox menu
async function readComboboxOptions(inputId, menuId) {
  const input = document.getElementById(inputId);
  if (!input) return [];
  // Clear any existing value and click to open the full menu
  input.focus();
  await sleep(100);
  setReactValue(input, '');
  await sleep(300);
  input.click();
  await sleep(1000);
  const menu = document.getElementById(menuId);
  if (!menu) return [];
  return Array.from(menu.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-disabled') !== 'true')
    .map(opt => opt.innerText.trim())
    .filter(Boolean);
}

// Use Gemini to pick the best matching option from a list
async function aiMatchOption(ebayValue, options, field, context) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'MATCH_OPTION', ebayValue, options, field, context },
      (response) => resolve(response?.index ?? -1)
    );
  });
}

// Click a combobox option by index
async function clickComboboxOption(inputId, menuId, index) {
  const input = document.getElementById(inputId);
  if (!input) return false;
  input.focus();
  await sleep(200);
  input.click();
  await sleep(800);
  const menu = document.getElementById(menuId);
  if (!menu) return false;
  const options = Array.from(menu.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-disabled') !== 'true');
  if (index >= 0 && index < options.length) {
    options[index].click();
    await sleep(400);
    return true;
  }
  return false;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Init ---
const isCreatePage = /\/products\/create\/|\/sell|\/listing/.test(window.location.href);

if (isCreatePage) {
  chrome.runtime.sendMessage({ action: 'GET_STAGED_LISTING' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.item) return;
    showBanner(response.item);

    // Auto-fill if form is already visible
    setTimeout(() => {
      if (document.getElementById(DEPOP_IDS.description) || document.getElementById(DEPOP_IDS.priceInput)) {
        fillDepopForm(response.item);
      }
    }, 3000);
  });
}
