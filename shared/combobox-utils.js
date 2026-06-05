// shared/combobox-utils.js — generic combobox interaction helpers

// Normalize text for comparison
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Score how well a source value matches an option (0-1)
function matchScore(sourceText, optionText) {
  const s = normalize(sourceText);
  const o = normalize(optionText);

  if (s === o) return 1.0;
  if (o.includes(s)) return 0.95;
  if (s.includes(o)) return 0.9;

  const sWords = new Set(s.split(' ').filter(w => w.length > 1));
  const oWords = o.split(' ').filter(w => w.length > 1);
  if (sWords.size === 0 || oWords.length === 0) return 0;

  let matched = 0;
  for (const w of oWords) {
    if (sWords.has(w)) { matched++; continue; }
    for (const sw of sWords) {
      if (sw.includes(w) || w.includes(sw)) { matched += 0.5; break; }
    }
  }
  return matched / Math.max(oWords.length, 1);
}

// Extract the most specific part of a category path
// "Clothing > Men > Coats & Jackets" → "Coats & Jackets"
function extractLeafCategory(categoryPath) {
  if (!categoryPath) return '';
  const parts = categoryPath.split(/[>›]/).map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

// Fill a click-to-select dropdown (no typing — click to open, find match, click it)
async function fillClickDropdown(inputSelector, menuSelector, searchText, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';

  // Click the trigger to open the dropdown
  var trigger = typeof inputSelector === 'string'
    ? document.querySelector(inputSelector)
    : document.getElementById(inputSelector);
  console.log('[Crosslister] fillClickDropdown trigger:', inputSelector, 'found:', !!trigger);
  if (!trigger) return { success: false, reason: 'trigger-not-found', selector: inputSelector };

  trigger.click();
  await sleep(800);

  var menu = typeof menuSelector === 'string'
    ? document.querySelector(menuSelector)
    : document.getElementById(menuSelector);
  console.log('[Crosslister] fillClickDropdown menu:', menuSelector, 'found:', !!menu);
  if (!menu) {
    document.body.click();
    return { success: false, reason: 'menu-not-found', selector: menuSelector };
  }

  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });
  console.log('[Crosslister] fillClickDropdown options:', options.length, 'searchText:', searchText);

  if (options.length === 0) {
    document.body.click();
    return { success: false, reason: 'no-options' };
  }

  // Score and pick best
  var bestOption = null, bestScore = 0;
  for (var i = 0; i < options.length; i++) {
    var text = options[i].innerText.trim();
    var score = matchScore(searchText, text);
    if (score > bestScore) { bestScore = score; bestOption = options[i]; }
  }

  if (bestOption && bestScore >= 0.15) {
    bestOption.click();
    await sleep(400);
    return { success: true, matchedText: bestOption.innerText.trim(), score: bestScore };
  }

  // No match — close the dropdown
  document.body.click();
  await sleep(200);
  return { success: false, reason: 'no-match' };
}

// Fill a combobox by typing progressive search terms and picking the best match
async function fillCombobox(inputId, menuId, searchText, config) {
  config = config || {};
  const optionRole = config.optionRole || '[role="option"]';
  const disabledAttr = config.disabledAttr || 'aria-disabled';
  const noOptionsSelector = config.noOptionsSelector || '';
  const sectionHeaderSelector = config.sectionHeaderSelector || '';

  const input = document.getElementById(inputId);
  if (!input) return { success: false, reason: 'input-not-found' };

  const simplified = extractLeafCategory(searchText) || searchText;

  const searchTerms = [
    simplified,
    simplified.split('&')[0].trim(),
    simplified.split(' ').slice(0, 2).join(' '),
    simplified.split(' ')[0],
  ].filter((t, i, arr) => t && t !== arr[i - 1]);

  for (const term of searchTerms) {
    if (!term || term.length < 1) continue;

    input.focus();
    await sleep(100);
    setReactValue(input, term);
    await sleep(1000);

    const menu = document.getElementById(menuId);
    if (!menu) continue;

    let options = Array.from(menu.querySelectorAll(optionRole))
      .filter(opt => opt.getAttribute(disabledAttr) !== 'true');

    if (options.length === 0) {
      if (noOptionsSelector && menu.querySelector(noOptionsSelector)) continue;
      input.click();
      await sleep(500);
      options = Array.from(menu.querySelectorAll(optionRole))
        .filter(opt => opt.getAttribute(disabledAttr) !== 'true');
      if (options.length === 0) continue;
    }

    let bestOption = null, bestScore = 0;
    for (const opt of options) {
      const text = opt.innerText.trim();
      if (!text) continue;
      const sectionHeader = sectionHeaderSelector
        ? opt.closest('div')?.querySelector(sectionHeaderSelector)?.innerText?.trim() || ''
        : '';
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
      return { success: true, matchedText: bestOption.innerText.trim(), score: bestScore };
    }
  }

  document.body.click();
  return { success: false, reason: 'no-match' };
}

// Read all options from a combobox menu
async function readComboboxOptions(inputId, menuId, config) {
  config = config || {};
  const optionRole = config.optionRole || '[role="option"]';
  const disabledAttr = config.disabledAttr || 'aria-disabled';

  const input = document.getElementById(inputId);
  if (!input) return [];

  input.focus();
  await sleep(100);
  setReactValue(input, '');
  await sleep(300);
  input.click();
  await sleep(1000);

  const menu = document.getElementById(menuId);
  if (!menu) return [];

  return Array.from(menu.querySelectorAll(optionRole))
    .filter(opt => opt.getAttribute(disabledAttr) !== 'true')
    .map(opt => opt.innerText.trim())
    .filter(Boolean);
}

// Click a combobox option by index
async function clickComboboxOption(inputId, menuId, index, config) {
  config = config || {};
  const optionRole = config.optionRole || '[role="option"]';
  const disabledAttr = config.disabledAttr || 'aria-disabled';

  const input = document.getElementById(inputId);
  if (!input) return false;
  input.focus();
  await sleep(200);
  input.click();
  await sleep(800);

  const menu = document.getElementById(menuId);
  if (!menu) return false;

  const options = Array.from(menu.querySelectorAll(optionRole))
    .filter(opt => opt.getAttribute(disabledAttr) !== 'true');
  if (index >= 0 && index < options.length) {
    options[index].click();
    await sleep(400);
    return true;
  }
  return false;
}
