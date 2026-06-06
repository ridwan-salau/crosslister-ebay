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

function resolveEl(ref) {
  return (typeof ref === 'string' ? (document.getElementById(ref) || document.querySelector(ref)) : document.getElementById(ref));
}

// --- Click-to-select dropdown ---

async function fillClickDropdown(inputSelector, menuSelector, searchText, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';

  var trigger = resolveEl(inputSelector);
  if (!trigger) { console.log('[Crosslister] fillClickDropdown: trigger not found ' + inputSelector); return { success: false, reason: 'trigger-not-found' }; }

  trigger.click();
  await sleep(800);

  var menu = resolveEl(menuSelector);
  if (!menu) {
    trigger.click();
    await sleep(600);
    menu = resolveEl(menuSelector);
  }
  if (!menu) { document.body.click(); console.log('[Crosslister] fillClickDropdown: menu not found ' + menuSelector); return { success: false, reason: 'menu-not-found' }; }

  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });

  if (options.length === 0) {
    document.body.click();
    console.log('[Crosslister] fillClickDropdown: 0 options with role=' + optionRole);
    return { success: false, reason: 'no-options' };
  }

  var bestOption = null, bestScore = 0;
  var allScores = [];
  for (var i = 0; i < options.length; i++) {
    var text = options[i].innerText.trim();
    var score = matchScore(searchText, text);
    if (score >= 0.15) allScores.push({ text: text.slice(0, 40), score: Math.round(score * 100) / 100 });
    if (score > bestScore) { bestScore = score; bestOption = options[i]; }
  }
  console.log('[Crosslister] fillClickDropdown: search="' + searchText.slice(0, 50) + '" options=' + options.length + ' topScores=' + JSON.stringify(allScores));

  if (bestOption && bestScore >= 0.15) {
    var matchText = bestOption.innerText.trim();
    console.log('[Crosslister] fillClickDropdown: matched "' + matchText.slice(0, 30) + '" score=' + bestScore);

    var currentOptions = Array.from(menu.querySelectorAll(optionRole))
      .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });
    for (var oi = 0; oi < currentOptions.length; oi++) {
      if (currentOptions[oi].innerText.trim() === matchText) {
        currentOptions[oi].click();
        break;
      }
    }

    await sleep(800);

    if (config.twoLevel) {
      menu = resolveEl(menuSelector);
      if (menu) {
        var subLists = menu.querySelectorAll('ul');
        var subOptions = [];
        for (var si = 1; si < subLists.length; si++) {
          var items = subLists[si].querySelectorAll(optionRole);
          for (var sj = 0; sj < items.length; sj++) {
            if (items[sj].getAttribute(disabledAttr) !== 'true' && items[sj].innerText.trim()) {
              subOptions.push(items[sj]);
            }
          }
        }
        if (subOptions.length > 0) {
          console.log('[Crosslister] fillClickDropdown: twoLevel found ' + subOptions.length + ' sub-options');
          var leaf = extractLeafCategory(searchText) || searchText;
          var bestSub = null, bestSubScore = 0;
          for (var ssi = 0; ssi < subOptions.length; ssi++) {
            var subText = subOptions[ssi].innerText.trim();
            var subScore = matchScore(leaf, subText);
            if (subScore > bestSubScore) { bestSubScore = subScore; bestSub = subOptions[ssi]; }
          }
          if (bestSub && bestSubScore >= 0.15) {
            console.log('[Crosslister] fillClickDropdown: clicking sub-option "' + bestSub.innerText.trim() + '" score=' + bestSubScore);
            bestSub.click();
            await sleep(600);
          }
        }
      }
    }

    console.log('[Crosslister] fillClickDropdown: done');
    return { success: true, matchedText: matchText, score: bestScore };
  }

  document.body.click();
  console.log('[Crosslister] fillClickDropdown: no match, bestScore=' + bestScore + ' < 0.15');
  return { success: false, reason: 'no-match' };
}

async function readClickDropdownOptions(inputSelector, menuSelector, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var trigger = resolveEl(inputSelector);
  if (!trigger) { console.log('[Crosslister] readClickDropdownOptions: trigger not found ' + inputSelector); return []; }
  trigger.click();
  await sleep(800);
  var menu = resolveEl(menuSelector);
  if (!menu) { document.body.click(); console.log('[Crosslister] readClickDropdownOptions: menu not found ' + menuSelector); return []; }
  var result = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); })
    .map(function (opt) { return opt.innerText.trim(); })
    .filter(Boolean);
  document.body.click();
  console.log('[Crosslister] readClickDropdownOptions: ' + result.length + ' options, preview=' + JSON.stringify(result.slice(0, 20)));
  return result;
}

async function clickDropdownOption(inputSelector, menuSelector, index, config) {
  config = config || {};
  var optionRole = config.optionRole || '.dropdown__menu__item, .dropdown__link';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var trigger = resolveEl(inputSelector);
  if (!trigger) { console.log('[Crosslister] clickDropdownOption: trigger not found'); return false; }
  trigger.click();
  await sleep(800);
  var menu = resolveEl(menuSelector);
  if (!menu) { document.body.click(); console.log('[Crosslister] clickDropdownOption: menu not found'); return false; }
  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true' && opt.innerText.trim(); });
  if (index >= 0 && index < options.length) {
    var clickTarget = options[index].querySelector('a, button') || options[index];
    console.log('[Crosslister] clickDropdownOption: index=' + index + ' text="' + options[index].innerText.trim().slice(0, 40) + '"');
    clickTarget.click();
    await sleep(500);
    return true;
  }
  console.log('[Crosslister] clickDropdownOption: index=' + index + ' out of range (0-' + (options.length - 1) + ')');
  document.body.click();
  return false;
}

// --- Type-to-filter combobox ---

async function fillCombobox(inputId, menuId, searchText, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var noOptionsSelector = config.noOptionsSelector || '';
  var sectionHeaderSelector = config.sectionHeaderSelector || '';
  var input = resolveEl(inputId);
  if (!input) { console.log('[Crosslister] fillCombobox: input not found ' + inputId); return { success: false, reason: 'input-not-found' }; }
  var simplified = extractLeafCategory(searchText) || searchText;
  var searchTerms = [simplified, simplified.split('&')[0].trim(), simplified.split(' ').slice(0, 2).join(' '), simplified.split(' ')[0]]
    .filter(function (t, i, arr) { return t && t !== arr[i - 1]; });
  console.log('[Crosslister] fillCombobox: search="' + searchText.slice(0, 50) + '" terms=' + JSON.stringify(searchTerms));
  for (var ti = 0; ti < searchTerms.length; ti++) {
    var term = searchTerms[ti];
    if (!term || term.length < 1) continue;
    input.focus();
    await sleep(100);
    setReactValue(input, term);
    await sleep(1000);
    var menu = resolveEl(menuId);
    if (!menu) continue;
    var options = Array.from(menu.querySelectorAll(optionRole))
      .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
    if (options.length === 0) {
      if (noOptionsSelector && menu.querySelector(noOptionsSelector)) continue;
      input.click();
      await sleep(500);
      menu = resolveEl(menuId);
      if (!menu) continue;
      options = Array.from(menu.querySelectorAll(optionRole))
        .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
      if (options.length === 0) continue;
    }
    var bestOption = null, bestScore = 0;
    var topScores = [];
    for (var oi = 0; oi < options.length; oi++) {
      var text = options[oi].innerText.trim();
      if (!text) continue;
      var sectionHeader = sectionHeaderSelector
        ? (options[oi].closest('div')?.querySelector(sectionHeaderSelector)?.innerText?.trim() || '')
        : '';
      var score = Math.max(matchScore(searchText, text), matchScore(term, text),
        sectionHeader ? matchScore(searchText, sectionHeader + ' > ' + text) : 0);
      if (score >= 0.2) topScores.push({ text: text.slice(0, 40), score: Math.round(score * 100) / 100 });
      if (score > bestScore) { bestScore = score; bestOption = options[oi]; }
    }
    console.log('[Crosslister] fillCombobox: term="' + term + '" found=' + options.length + ' topMatches=' + JSON.stringify(topScores));
    if (bestOption && bestScore >= 0.2) {
      console.log('[Crosslister] fillCombobox: matched "' + bestOption.innerText.trim() + '" score=' + bestScore);
      bestOption.click();
      await sleep(400);
      return { success: true, matchedText: bestOption.innerText.trim(), score: bestScore };
    }
  }

  // Fallback: look for "Other", "None", etc.
  var menu = resolveEl(menuId);
  if (menu) {
    var fbOptions = Array.from(menu.querySelectorAll(optionRole))
      .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
    var fallbackKeywords = ['other', 'none', 'not listed', 'unbranded', 'no brand', 'does not apply', 'n/a', 'unlisted', 'unrecognized'];
    for (var fi = 0; fi < fbOptions.length; fi++) {
      var ft = (fbOptions[fi].innerText || '').trim().toLowerCase();
      for (var fk = 0; fk < fallbackKeywords.length; fk++) {
        if (ft === fallbackKeywords[fk] || ft.indexOf(fallbackKeywords[fk]) !== -1) {
          console.log('[Crosslister] fillCombobox fallback: ' + fbOptions.length + ' visible, clicked "' + fbOptions[fi].innerText.trim() + '"');
          fbOptions[fi].click();
          await sleep(400);
          return { success: true, matchedText: fbOptions[fi].innerText.trim(), score: 0, fallback: true };
        }
      }
    }
    console.log('[Crosslister] fillCombobox: no match, ' + fbOptions.length + ' options visible, preview=' + JSON.stringify(fbOptions.slice(0, 15).map(function(o) { return o.innerText.trim().slice(0, 40); })));
  }
  document.body.click();
  return { success: false, reason: 'no-match' };
}

async function readComboboxOptions(inputId, menuId, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var input = resolveEl(inputId);
  if (!input) { console.log('[Crosslister] readComboboxOptions: input not found ' + inputId); return []; }
  input.focus();
  await sleep(100);
  setReactValue(input, ' ');
  await sleep(500);
  input.click();
  await sleep(1000);
  var menu = resolveEl(menuId);
  if (!menu) { document.body.click(); console.log('[Crosslister] readComboboxOptions: menu not found ' + menuId); return []; }
  var result = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; })
    .map(function (opt) { return opt.innerText.trim(); })
    .filter(Boolean);
  if (result.length === 0) {
    document.body.click();
    await sleep(300);
    input.click();
    await sleep(1000);
    menu = resolveEl(menuId);
    if (menu) {
      result = Array.from(menu.querySelectorAll(optionRole))
        .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; })
        .map(function (opt) { return opt.innerText.trim(); })
        .filter(Boolean);
    }
  }
  document.body.click();
  console.log('[Crosslister] readComboboxOptions: ' + result.length + ' options, preview=' + JSON.stringify(result.slice(0, 20)));
  return result;
}

async function clickComboboxOption(inputId, menuId, index, config) {
  config = config || {};
  var optionRole = config.optionRole || '[role="option"]';
  var disabledAttr = config.disabledAttr || 'aria-disabled';
  var input = resolveEl(inputId);
  if (!input) { console.log('[Crosslister] clickComboboxOption: input not found'); return false; }
  input.focus();
  await sleep(200);
  input.click();
  await sleep(800);
  var menu = resolveEl(menuId);
  if (!menu) { console.log('[Crosslister] clickComboboxOption: menu not found'); return false; }
  var options = Array.from(menu.querySelectorAll(optionRole))
    .filter(function (opt) { return opt.getAttribute(disabledAttr) !== 'true'; });
  if (index >= 0 && index < options.length) {
    console.log('[Crosslister] clickComboboxOption: index=' + index + ' text="' + options[index].innerText.trim().slice(0, 40) + '"');
    options[index].click();
    await sleep(400);
    return true;
  }
  console.log('[Crosslister] clickComboboxOption: index=' + index + ' out of range (0-' + (options.length - 1) + ')');
  return false;
}
