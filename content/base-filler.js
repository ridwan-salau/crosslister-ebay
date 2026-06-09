// content/base-filler.js — platform-agnostic form-filling engine

function debugLog(platform, msg, data) {
  var prefix = '[Crosslister:' + platform + ']';
  if (data !== undefined) {
    console.log(prefix + ' ' + msg, JSON.stringify(data));
  } else {
    console.log(prefix + ' ' + msg);
  }
}

async function fillForm(platformConfig, item, settings) {
  const cfg = platformConfig;
  let filled = 0;
  const unmatched = []; // fields to batch-match via AI
  var imageUploadPromise = null; // kicked off early, awaited when loop reaches images

  // Kick off image upload immediately — it runs concurrently with field filling
  var imageMapping = cfg.fieldMapping['images'];
  if (imageMapping && imageMapping.source && item[imageMapping.source]) {
    var imageValues = item[imageMapping.source];
    if (imageValues && imageValues.length > 0) {
      var imageInput = document.querySelector(cfg.selectors.imageUpload.input);
      if (imageInput) {
        var maxImg = imageMapping.maxImages || 8;
        imageUploadPromise = uploadImages(imageValues, imageInput, maxImg, imageMapping.convertWebP);
      }
    }
  }

  // Dismiss Poshmark error modal before filling starts
  var errModals = document.querySelectorAll('[data-test="modal-container"]');
  debugLog(cfg.key, 'checking ' + errModals.length + ' modals for errors');
  for (var ei = 0; ei < errModals.length; ei++) {
    var text = errModals[ei].innerText.substring(0, 80);
    debugLog(cfg.key, 'modal[' + ei + '] text=' + text);
    if (text.indexOf('Sorry') !== -1 || text.indexOf('Error') !== -1) {
      var okBtn = errModals[ei].querySelector('.btn--primary');
      debugLog(cfg.key, 'modal OK button found=' + !!okBtn + ' visible=' + (okBtn ? okBtn.offsetParent !== null : false));
      if (okBtn && okBtn.offsetParent !== null) { okBtn.click(); debugLog(cfg.key, 'modal OK clicked'); await sleep(400); }
      else if (okBtn) { okBtn.click(); debugLog(cfg.key, 'modal OK clicked (hidden)'); await sleep(400); }
    }
  }

  for (const fieldName of cfg.fieldOrder) {
    const mapping = cfg.fieldMapping[fieldName];
    if (!mapping) continue;

    // Resolve the value
    let value = null;
    if (mapping.source && item[mapping.source] != null) {
      value = item[mapping.source];
    } else if (mapping.fromSetting && settings[mapping.fromSetting]) {
      value = settings[mapping.fromSetting];
    }
    if (value == null || value === '') continue;

    // Apply transformations
    if (mapping.useMap && cfg[mapping.useMap]) {
      var mapped = mapByKeyword(value, cfg[mapping.useMap]);
      if (mapped) value = mapped; // keep original if no keyword match
    }
    if (mapping.useLeaf) {
      value = extractLeafCategory(value) || value;
    }
    if (mapping.valueMap && mapping.valueMap[value]) {
      value = mapping.valueMap[value];
    }
    if (mapping.applyBuffer && settings.priceBuffer !== 0) {
      var num = parseFloat(value);
      if (!isNaN(num)) value = (num * (1 + settings.priceBuffer / 100)).toFixed(2);
    }

    // Determine field type from config selectors
    const isText = cfg.selectors.text && cfg.selectors.text[fieldName];
    const isInput = cfg.selectors.input && cfg.selectors.input[fieldName];
    const isCombobox = cfg.selectors.combobox && cfg.selectors.combobox[fieldName];
    const isImage = fieldName === 'images';

    if (isImage) {
      // Await the pre-started image upload (kicked off at the start of fillForm
      // to run concurrently with field filling), or start now if it wasn't
      // pre-started (e.g. fileInput wasn't available yet).
      if (imageUploadPromise) {
        var imgCount = await imageUploadPromise;
        if (imgCount > 0) filled++;
      } else {
        const maxImages = mapping.maxImages || 8;
        const fileInput = document.querySelector(cfg.selectors.imageUpload.input);
        if (fileInput && value && value.length > 0) {
          const count = await uploadImages(value, fileInput, maxImages, mapping.convertWebP);
          if (count > 0) filled++;
        }
      }
      // Post-images hook (e.g., dismiss covershot modal)
      if (cfg.hooks && cfg.hooks.postImages) {
        try { await cfg.hooks.postImages(value, settings, item); } catch (e) { debugLog(cfg.key, 'postImages hook failed', e); }
      }
      continue;
    }

    if (isText) {
      const el = document.querySelector(cfg.selectors.text[fieldName]);
      if (el) {
        let text = String(value);
        if (mapping.prependTitle && item.title) {
          text = item.title + '\n\n' + (mapping.source && item[mapping.source] ? text : '');
        }
        if (mapping.aiTransformable && settings.aiEnabled && settings.geminiKey) {
          text = await transformDescriptionViaBackground(text, cfg.key);
        }
        setReactTextarea(el, text);
        filled++;
        debugLog(cfg.key, 'filled text field', fieldName);
      } else {
        debugLog(cfg.key, 'text element not found', { field: fieldName, selector: cfg.selectors.text[fieldName] });
      }
      continue;
    }

    if (isInput) {
      // Pre-fill hook (e.g., Poshmark price modal)
      try {
        if (mapping.hasHooks && cfg.hooks && cfg.hooks['pre' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)]) {
          value = await cfg.hooks['pre' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)](value, settings);
        }
      } catch (e) {
        debugLog(cfg.key, 'pre' + fieldName + ' hook failed', e);
        showToast('⚠️ Error preparing ' + fieldName + ' field — see console for details');
      }
      const el = document.querySelector(cfg.selectors.input[fieldName]);
      if (el) {
        setReactValue(el, String(value));
        filled++;
      } else {
        debugLog(cfg.key, 'input not found for ' + fieldName, cfg.selectors.input[fieldName]);
      }
      // Post-fill hook (e.g., close modal, fill related fields)
      try {
        if (mapping.hasHooks && cfg.hooks && cfg.hooks['post' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)]) {
          await cfg.hooks['post' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)](value, settings);
        }
      } catch (e) {
        debugLog(cfg.key, 'post' + fieldName + ' hook failed', e);
        showToast('⚠️ Error after ' + fieldName + ' field — see console for details');
      }
      continue;
    }

    if (isCombobox) {
      const fieldCfg = cfg.selectors.combobox[fieldName];
      const { input, menu, mode } = fieldCfg;
      debugLog(cfg.key, 'combobox ' + fieldName, { value: String(value), input: input, menu: menu, mode: mode });

      // Merge field-level overrides into comboboxConfig
      var comboConfig = Object.assign({}, cfg.comboboxConfig || {});
      if (fieldCfg.optionRole) comboConfig.optionRole = fieldCfg.optionRole;
      if (fieldCfg.disabledAttr) comboConfig.disabledAttr = fieldCfg.disabledAttr;
      if (fieldCfg.twoLevel) comboConfig.twoLevel = true;
      if (fieldCfg.deferSub) comboConfig.deferSub = true;

      // Pre-combobox hook (e.g., select tab / country before reading options)
      var prehook = 'pre' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      if (cfg.hooks && cfg.hooks[prehook]) {
        try { await cfg.hooks[prehook](value, settings); } catch (e) { debugLog(cfg.key, prehook + ' hook failed', e); }
      }

      var useClick = (mode === 'click') || (!mode && cfg.comboboxConfig && cfg.comboboxConfig.mode === 'click');
      // For category matching, use the full path (not just leaf)
      var searchVal = (fieldName === 'category') ? (item['category'] || String(value)) : String(value);

      // When preferAi is on, skip fuzzy matching for AI-batchable fields —
      // collect all options and batch them in a single LLM call at the end.
      if (mapping.aiBatchable && settings.preferAi && settings.geminiKey) {
        const options = useClick
          ? await readClickDropdownOptions(input, menu, comboConfig)
          : await readComboboxOptions(input, menu, comboConfig);
        if (options.length > 0) {
          unmatched.push({
            field: fieldName, sourceValue: String(value),
            context: [item.itemSpecifics].filter(Boolean).join(' | '),
            options, inputSelector: input, menuSelector: menu, useClick: useClick,
            optionRole: comboConfig.optionRole, disabledAttr: comboConfig.disabledAttr,
          });
          debugLog(cfg.key, 'AI prefer: queued ' + fieldName + ' with ' + options.length + ' options');
        } else {
          // Couldn't read options. For category comboboxes that require typing
          // to show options (e.g. Depop), retry with the audience/gender as the
          // search term to ensure we only see options from the correct section.
          var retryOpts = [];
          if (!useClick && fieldName === 'category') {
            var retryTerm = extractAudience(searchVal) || extractLeafCategory(searchVal) || searchVal;
            retryOpts = await readComboboxOptionsWithSearch(input, menu, retryTerm, comboConfig);
            debugLog(cfg.key, 'AI prefer: retry search "' + retryTerm + '" → ' + retryOpts.length + ' options');
          }
          if (retryOpts.length > 0) {
            unmatched.push({
              field: fieldName, sourceValue: String(value),
              context: [item.itemSpecifics].filter(Boolean).join(' | '),
              options: retryOpts, inputSelector: input, menuSelector: menu, useClick: useClick,
              optionRole: comboConfig.optionRole, disabledAttr: comboConfig.disabledAttr,
            });
            debugLog(cfg.key, 'AI prefer: retry queued ' + fieldName + ' with ' + retryOpts.length + ' options');
          } else {
            // Still nothing — fall back to fuzzy matching
            debugLog(cfg.key, 'AI prefer: no options for ' + fieldName + ', falling back to fuzzy');
            var result = useClick
              ? await fillClickDropdown(input, menu, searchVal, comboConfig)
              : await fillCombobox(input, menu, searchVal, comboConfig);
            debugLog(cfg.key, 'combobox result ' + fieldName, result);
            if (result.success) {
              filled++;
              var chook2 = 'post' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
              if (cfg.hooks && cfg.hooks[chook2]) {
                try { await cfg.hooks[chook2](searchVal, settings); } catch (e) { debugLog(cfg.key, chook2 + ' hook failed', e); }
              }
            } else if (result.reason === 'no-match') {
            // Still no match — collect whatever options we have for AI fallback
            if (options.length === 0) {
              // Re-read options with a different approach
              debugLog(cfg.key, 'AI prefer: retrying option read for ' + fieldName);
            }
          }
        }
      }
      } else {
        var result = useClick
          ? await fillClickDropdown(input, menu, searchVal, comboConfig)
          : await fillCombobox(input, menu, searchVal, comboConfig);
        debugLog(cfg.key, 'combobox result ' + fieldName, result);
        if (result.success) {
          filled++;
          // Post-fill hook for comboboxes (e.g., wait for dependent dropdown)
          var chook = 'post' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
          if (cfg.hooks && cfg.hooks[chook]) {
            try { await cfg.hooks[chook](searchVal, settings, item); } catch (e) { debugLog(cfg.key, chook + ' hook failed', e); }
          }
        } else if (mapping.aiBatchable && settings.geminiKey) {
          // Fallback: collect for batch AI matching
          const options = useClick
            ? await readClickDropdownOptions(input, menu, comboConfig)
            : await readComboboxOptions(input, menu, comboConfig);
          if (options.length > 0) {
            unmatched.push({
              field: fieldName, sourceValue: String(value),
              context: [item.itemSpecifics].filter(Boolean).join(' | '),
              options, inputSelector: input, menuSelector: menu, useClick: useClick,
              optionRole: comboConfig.optionRole, disabledAttr: comboConfig.disabledAttr,
            });
          }
        } else if (mapping.aiBatchable) {
          showToast('⚠️ ' + fieldName + ' needs manual selection — set a Gemini API key for matching.');
        }
      }
    }
  }

  // Batch AI match for all unmatched fields
  if (unmatched.length > 0) {
    var batchSummary = unmatched.map(function(u) { return u.field + '="' + u.sourceValue + '" (' + u.options.length + ' opts)'; }).join(', ');
    console.log('[Crosslister:' + cfg.key + '] AI batch sending ' + unmatched.length + ' fields: ' + batchSummary);
    unmatched.forEach(function(u) {
      console.log('[Crosslister:' + cfg.key + ']   ' + u.field + ' options: ' + JSON.stringify(u.options.slice(0, 30)));
    });
    const aiResults = await batchMatchViaBackground(unmatched, cfg.key);
    console.log('[Crosslister:' + cfg.key + '] AI batch results: ' + JSON.stringify(aiResults));
    for (const r of aiResults) {
      const field = unmatched.find(u => u.field === r.field);
      if (field && r.matchedIndex >= 0) {
        var fieldComboConfig = { optionRole: field.optionRole || cfg.comboboxConfig?.optionRole, disabledAttr: field.disabledAttr || cfg.comboboxConfig?.disabledAttr };
        var applied = field.useClick
          ? await clickDropdownOption(field.inputSelector, field.menuSelector, r.matchedIndex, fieldComboConfig)
          : await clickComboboxOption(field.inputSelector, field.menuSelector, r.matchedIndex, fieldComboConfig);
        if (applied) {
          filled++;
          debugLog(cfg.key, 'AI applied ' + r.field + ' index ' + r.matchedIndex);
          // Handle twoLevel sub-option: after clicking top-level, select sub-option
          if (field.useClick && field.optionRole && field.inputSelector && field.menuSelector) {
            var fieldCfg = cfg.selectors.combobox[r.field];
            if (fieldCfg && fieldCfg.twoLevel) {
              await sleep(500);
              var subMenu = resolveEl(field.menuSelector);
              if (subMenu) {
                var subRole = field.optionRole || '.dropdown__link';
                var subLists = subMenu.querySelectorAll('ul');
                var subOptions = [];
                for (var sxi = 1; sxi < subLists.length; sxi++) {
                  var items = subLists[sxi].querySelectorAll(subRole);
                  for (var sxj = 0; sxj < items.length; sxj++) {
                    if (items[sxj].getAttribute('aria-disabled') !== 'true' && items[sxj].innerText.trim()) {
                      subOptions.push(items[sxj]);
                    }
                  }
                }
                if (subOptions.length > 0) {
                  var subOptionTexts = subOptions.map(function(o) { return o.innerText.trim(); });
                  var matchedSubIdx = -1;

                  // Use AI to pick the best subcategory when available
                  if (settings.preferAi && settings.geminiKey) {
                    var subField = {
                      field: r.field + '_sub',
                      sourceValue: field.sourceValue,
                      context: [item.itemSpecifics].filter(Boolean).join(' | '),
                      options: subOptionTexts
                    };
                    var subResults = await batchMatchViaBackground([subField], cfg.key);
                    console.log('[Crosslister:' + cfg.key + '] AI twoLevel sub results: ' + JSON.stringify(subResults));
                    if (subResults.length > 0 && subResults[0].matchedIndex >= 0) {
                      matchedSubIdx = subResults[0].matchedIndex;
                    }
                  }

                  // Fall back to fuzzy matching if AI not available or didn't match
                  if (matchedSubIdx < 0) {
                    var leaf = extractLeafCategory(field.sourceValue) || field.sourceValue;
                    var bestSubScore = 0;
                    for (var ssi = 0; ssi < subOptions.length; ssi++) {
                      var subScore = matchScore(leaf, subOptions[ssi].innerText.trim());
                      if (subScore > bestSubScore) { bestSubScore = subScore; matchedSubIdx = ssi; }
                    }
                    if (bestSubScore < 0.15) matchedSubIdx = -1;
                    if (matchedSubIdx >= 0) {
                      console.log('[Crosslister:' + cfg.key + '] AI twoLevel sub (fuzzy): "' + subOptionTexts[matchedSubIdx] + '" score=' + bestSubScore);
                    }
                  }

                  if (matchedSubIdx >= 0 && matchedSubIdx < subOptions.length) {
                    console.log('[Crosslister:' + cfg.key + '] AI twoLevel sub: clicking "' + subOptionTexts[matchedSubIdx] + '"');
                    var subLink = subOptions[matchedSubIdx].querySelector('a') || subOptions[matchedSubIdx];
                    subLink.click();
                    await sleep(400);
                  }
                }
              }
            }
          }
          // Run post-hook for AI-applied fields (e.g. Poshmark postSize clicks Done)
          var postHookName = 'post' + r.field.charAt(0).toUpperCase() + r.field.slice(1);
          if (cfg.hooks && cfg.hooks[postHookName]) {
            try { await cfg.hooks[postHookName](field.sourceValue, settings, item); } catch (e) { debugLog(cfg.key, postHookName + ' hook failed', e); }
          }
        } else { debugLog(cfg.key, 'AI failed to apply ' + r.field); }
      }

      // Fuzzy fallback: for any unmatched field that AI didn't match, try fuzzy
      var aiMatchedFields = aiResults.filter(function(r) { return r.matchedIndex >= 0; }).map(function(r) { return r.field; });
      for (var fi = 0; fi < unmatched.length; fi++) {
        var uf = unmatched[fi];
        if (aiMatchedFields.indexOf(uf.field) !== -1) continue; // AI already handled
        console.log('[Crosslister:' + cfg.key + '] AI missed ' + uf.field + ', falling back to fuzzy');
        var ufComboConfig = { optionRole: uf.optionRole || cfg.comboboxConfig?.optionRole, disabledAttr: uf.disabledAttr || cfg.comboboxConfig?.disabledAttr };
        var fbResult = uf.useClick
          ? await fillClickDropdown(uf.inputSelector, uf.menuSelector, uf.sourceValue, ufComboConfig)
          : await fillCombobox(uf.inputSelector, uf.menuSelector, uf.sourceValue, ufComboConfig);
        if (fbResult.success) {
          filled++;
          debugLog(cfg.key, 'fuzzy fallback matched ' + uf.field + ': ' + fbResult.matchedText);
          // TwoLevel handling for fuzzy fallback is already in fillClickDropdown
        }
      }
    }

    // After applying category from AI, run post-hook and re-collect dependent
    // fields that now have different options (e.g., size changes based on category).
    var categoryApplied = unmatched.some(function(u) {
      return u.field === 'category' && aiResults.some(function(r) { return r.field === 'category' && r.matchedIndex >= 0; });
    });
    if (categoryApplied) {
      var chook = 'postCategory';
      if (cfg.hooks && cfg.hooks[chook]) {
        var catVal = item['category'] || '';
        try { await cfg.hooks[chook](catVal, settings, item); } catch (e) { debugLog(cfg.key, chook + ' hook failed', e); }
      }
      await sleep(cfg.categoryWaitMs || 1500);

      // Re-read options for category-dependent aiBatchable fields
      var secondPass = [];
      var depFields = cfg.categoryDependentFields || [];
      for (var di = 0; di < depFields.length; di++) {
        var dfName = depFields[di];
        var dfMapping = cfg.fieldMapping[dfName];
        if (!dfMapping || !dfMapping.aiBatchable) continue;
        var dfCfg = cfg.selectors.combobox[dfName];
        if (!dfCfg) continue;
        // Re-read this field — options may have changed after category was set
        if (dfCfg.twoLevel) continue; // twoLevel fields are handled by fillClickDropdown
        var dfComboConfig = Object.assign({}, cfg.comboboxConfig || {});
        if (dfCfg.optionRole) dfComboConfig.optionRole = dfCfg.optionRole;
        if (dfCfg.disabledAttr) dfComboConfig.disabledAttr = dfCfg.disabledAttr;
        var dfUseClick = (dfCfg.mode === 'click') || (!dfCfg.mode && cfg.comboboxConfig && cfg.comboboxConfig.mode === 'click');
        var dfOptions = dfUseClick
          ? await readClickDropdownOptions(dfCfg.input, dfCfg.menu, dfComboConfig)
          : await readComboboxOptions(dfCfg.input, dfCfg.menu, dfComboConfig);
        if (dfOptions.length > 0) {
          var dfSourceVal = item[dfMapping.source] || '';
          if (!dfSourceVal && dfMapping.fromSetting) dfSourceVal = settings[dfMapping.fromSetting] || '';
          if (dfSourceVal) {
            secondPass.push({
              field: dfName, sourceValue: String(dfSourceVal),
              context: [item.itemSpecifics].filter(Boolean).join(' | '),
              options: dfOptions, inputSelector: dfCfg.input, menuSelector: dfCfg.menu,
              useClick: dfUseClick, optionRole: dfComboConfig.optionRole, disabledAttr: dfComboConfig.disabledAttr,
            });
            debugLog(cfg.key, 'AI second pass: re-reading ' + dfName + ' with ' + dfOptions.length + ' options');
          }
        }
      }
      if (secondPass.length > 0) {
        var batch2Summary = secondPass.map(function(u) { return u.field + '="' + u.sourceValue + '" (' + u.options.length + ' opts)'; }).join(', ');
        console.log('[Crosslister:' + cfg.key + '] AI second batch: ' + batch2Summary);
        secondPass.forEach(function(u) {
          console.log('[Crosslister:' + cfg.key + ']   ' + u.field + ' options: ' + JSON.stringify(u.options.slice(0, 30)));
        });
        var aiResults2 = await batchMatchViaBackground(secondPass, cfg.key);
        console.log('[Crosslister:' + cfg.key + '] AI second batch results: ' + JSON.stringify(aiResults2));
        for (var ri = 0; ri < aiResults2.length; ri++) {
          var r2 = aiResults2[ri];
          var f2 = secondPass.find(function(u) { return u.field === r2.field; });
          if (f2 && r2.matchedIndex >= 0) {
            var fc2 = { optionRole: f2.optionRole || cfg.comboboxConfig?.optionRole, disabledAttr: f2.disabledAttr || cfg.comboboxConfig?.disabledAttr };
            var app2 = f2.useClick
              ? await clickDropdownOption(f2.inputSelector, f2.menuSelector, r2.matchedIndex, fc2)
              : await clickComboboxOption(f2.inputSelector, f2.menuSelector, r2.matchedIndex, fc2);
            if (app2) {
              filled++;
              debugLog(cfg.key, 'AI second pass applied ' + r2.field + ' index ' + r2.matchedIndex);
              // Run post-hook (e.g. Poshmark postSize clicks Done)
              var postHook2 = 'post' + r2.field.charAt(0).toUpperCase() + r2.field.slice(1);
              if (cfg.hooks && cfg.hooks[postHook2]) {
                try { await cfg.hooks[postHook2](f2.sourceValue, settings, item); } catch (e) { debugLog(cfg.key, postHook2 + ' hook failed', e); }
              }
            }
          }
        }
      }
    }
  }

  debugLog(cfg.key, 'fillForm complete', { filled: filled, unmatched: unmatched.length, fields: cfg.fieldOrder });
  return { filledCount: filled, unmatchedFields: unmatched.length };
}

// --- Helpers ---

function mapByKeyword(value, map) {
  if (!value) return '';
  const c = value.toLowerCase().replace(/[–—‒―]/g, '-').replace(/\s+/g, ' ').trim();
  for (const [keyword, mapped] of Object.entries(map)) {
    if (c.includes(keyword)) return mapped;
  }
  return ''; // no match — caller should use the original value via fuzzy matching
}

async function transformDescriptionViaBackground(text, platform) {
  return new Promise(resolve => {
    safeSendMessage(
      { action: 'TRANSFORM_DESCRIPTION', description: text, platform },
      (response) => resolve(response?.transformed || text)
    );
  });
}

async function batchMatchViaBackground(fields, platform) {
  return new Promise(resolve => {
    safeSendMessage(
      { action: 'BATCH_MATCH', fields, platform },
      (response) => {
        if (response && response.error) {
          debugLog(platform, 'AI batch error: ' + response.error);
        }
        resolve(response?.results || []);
      }
    );
  });
}
