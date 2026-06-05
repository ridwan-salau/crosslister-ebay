// shared/combobox-utils.js — generic combobox interaction helpers

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchScore(sourceText, optionText) {
  var s = normalize(sourceText);
  var o = normalize(optionText);
  if (s === o) return 1.0;
  if (o.includes(s)) return 0.95;
  if (s.includes(o)) return 0.9;
  var sWords = new Set(s.split(' ').filter(function (w) { return w.length > 1; }));
  var oWords = o.split(' ').filter(function (w) { return w.length > 1; });
  if (sWords.size === 0 || oWords.length === 0) return 0;
  var matched = 0;
  for (var i = 0; i < oWords.length; i++) {
    var w = oWords[i];
    if (sWords.has(w)) { matched++; continue; }
    var found = false;
    sWords.forEach(function (sw) { if (sw.includes(w) || w.includes(sw)) { matched += 0.5; found = true; } });
    if (found) continue;
  }
  return matched / Math.max(oWords.length, 1);
}

function extractLeafCategory(categoryPath) {
  if (!categoryPath) return '';
  var parts = categoryPath.split(/[>›]/).map(function (s) { return s.trim(); }).filter(Boolean);
  return parts[parts.length - 1] || '';
}

// Open a click-to-select dropdown and pick the best matching option
async function fillClickDropdown(inputSelector, menuSelector, searchText, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';

  var trigger = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : document.getElementById(inputSelector);
  if (!trigger) return { success: false, reason: 'trigger-not-found' };

  trigger.click();
  await sleep(800);

  var menu = typeof menuSelector === 'string' ? document.querySelector(menuSelector) : document.getElementById(menuSelector);
  if (!menu) {
    // Menu might not exist yet — try clicking trigger again
    trigger.click();
    await sleep(600);
    menu = typeof menuSelector === 'string' ? document.querySelector(menuSelector) : document.getElementById(menuSelector);
  }
  if (!menu) { document.body.click(); return { success: false, reason: 'menu-not-found' }; }

  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });

  if (options.length === 0) { document.body.click(); return { success: false, reason: 'no-options' }; }

  // Find best match
  var bestOption = null, bestScore = 0;
  for (var i = 0; i < options.length; i++) {
    var text = options[i].innerText.trim();
    var score = matchScore(searchText, text);
    if (score > bestScore) { bestScore = score; bestOption = options[i]; }
  }

  if (bestOption && bestScore >= 0.15) {
    // Click the <a> tag or inner clickable element
    var clickTarget = bestOption.querySelector('a, button') || bestOption;
    clickTarget.click();
    await sleep(500);
    return { success: true, matchedText: bestOption.innerText.trim(), score: bestScore };
  }

  document.body.click();
  return { success: false, reason: 'no-match' };
}

// Read options from a click-to-select dropdown (for AI batch collection)
async function readClickDropdownOptions(inputSelector, menuSelector, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var trigger = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : document.getElementById(inputSelector);
  if (!trigger) return [];
  trigger.click();
  await sleep(800);
  var menu = typeof menuSelector === 'string' ? document.querySelector(menuSelector) : document.getElementById(menuSelector);
  if (!menu) { document.body.click(); return []; }
  return Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); })
    .map(function (opt) { return opt.innerText.trim(); })
    .filter(Boolean);
}

// Click an option by index in a click-to-select dropdown
async function clickDropdownOption(inputSelector, menuSelector, index, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var trigger = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : document.getElementById(inputSelector);
  if (!trigger) return false;
  trigger.click();
  await sleep(800);
  var menu = typeof menuSelector === 'string' ? document.querySelector(menuSelector) : document.getElementById(menuSelector);
  if (!menu) { document.body.click(); return false; }
  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });
  if (index >= 0 && index < options.length) {
    var clickTarget = options[index].querySelector('a, button') || options[index];
    clickTarget.click();
    await sleep(500);
    return true;
  }
  document.body.click();
  return false;
}

// --- Type-to-filter combobox (unchanged from original) ---
async function fillCombobox(inputId, menuId, searchText, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var noOptionsSelector = config.noOptionsSelector || '';
  var sectionHeaderSelector = config.sectionHeaderSelector || '';
  var input = document.getElementById(inputId);
  if (!input) return { success: false, reason: 'input-not-found' };
  var simplified = extractLeafCategory(searchText) || searchText;
  var searchTerms = [simplified, simplified.split('&')[0].trim(), simplified.split(' ').slice(0, 2).join(' '), simplified.split(' ')[0]]
    .filter(function (t, i, arr) { return t && t !== arr[i - 1]; });
  for (var ti = 0; ti < searchTerms.length; ti++) {
    var term = searchTerms[ti];
    if (!term || term.length < 1) continue;
    input.focus();
    await sleep(100);
    setReactValue(input, term);
    await sleep(1000);
    var menu = document.getElementById(menuId);
    if (!menu) continue;
    var options = Array.from(menu.querySelectorAll(optionRole))
      .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
    if (options.length === 0) {
      if (noOptionsSelector && menu.querySelector(noOptionsSelector)) continue;
      input.click();
      await sleep(500);
      options = Array.from(menu.querySelectorAll(optionRole))
        .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
      if (options.length === 0) continue;
    }
    var bestOption = null, bestScore = 0;
    for (var oi = 0; oi < options.length; oi++) {
      var text = options[oi].innerText.trim();
      if (!text) continue;
      var sectionHeader = sectionHeaderSelector
        ? (options[oi].closest('div')?.querySelector(sectionHeaderSelector)?.innerText?.trim() || '')
        : '';
      var score = Math.max(matchScore(searchText, text), matchScore(term, text),
        sectionHeader ? matchScore(searchText, sectionHeader + ' > ' + text) : 0);
      if (score > bestScore) { bestScore = score; bestOption = options[oi]; }
    }
    if (bestOption && bestScore >= 0.2) { bestOption.click(); await sleep(400); return { success: true, matchedText: bestOption.innerText.trim(), score: bestScore }; }
  }
  document.body.click();
  return { success: false, reason: 'no-match' };
}

async function readComboboxOptions(inputId, menuId, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var input = document.getElementById(inputId);
  if (!input) return [];
  input.focus();
  await sleep(100);
  setReactValue(input, '');
  await sleep(300);
  input.click();
  await sleep(1000);
  var menu = document.getElementById(menuId);
  if (!menu) return [];
  return Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; })
    .map(function (opt) { return opt.innerText.trim(); })
    .filter(Boolean);
}

async function clickComboboxOption(inputId, menuId, index, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var input = document.getElementById(inputId);
  if (!input) return false;
  input.focus();
  await sleep(200);
  input.click();
  await sleep(800);
  var menu = document.getElementById(menuId);
  if (!menu) return false;
  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
  if (index >= 0 && index < options.length) { options[index].click(); await sleep(400); return true; }
  return false;
}
