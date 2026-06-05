// content/base-filler.js — platform-agnostic form-filling engine

// Debug logging — shows in console and as toast when verbose
var DEBUG_ENABLED = true;

function debugLog(platform, msg, data) {
  var prefix = '[Crosslister:' + platform + ']';
  console.log(prefix, msg, data || '');
  if (data instanceof Error || (data && data.stack)) {
    console.error(prefix, data);
  }
}

async function fillForm(platformConfig, item, settings) {
  const cfg = platformConfig;
  let filled = 0;
  const unmatched = []; // fields to batch-match via AI

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
      value = mapByKeyword(value, cfg[mapping.useMap]);
    }
    if (mapping.useLeaf) {
      value = extractLeafCategory(value) || value;
    }
    if (mapping.valueMap && mapping.valueMap[value]) {
      value = mapping.valueMap[value];
    }
    if (mapping.applyBuffer && settings.priceBuffer > 0) {
      value = (parseFloat(value) * (1 + settings.priceBuffer / 100)).toFixed(2);
    }

    // Determine field type from config selectors
    const isText = cfg.selectors.text && cfg.selectors.text[fieldName];
    const isInput = cfg.selectors.input && cfg.selectors.input[fieldName];
    const isCombobox = cfg.selectors.combobox && cfg.selectors.combobox[fieldName];
    const isImage = fieldName === 'images';

    if (isImage) {
      const maxImages = mapping.maxImages || 8;
      const fileInput = document.querySelector(cfg.selectors.imageUpload.input);
      if (fileInput && value && value.length > 0) {
        const count = await uploadImages(value, fileInput, maxImages, mapping.convertWebP);
        if (count > 0) filled++;
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
      const { input, menu, mode } = cfg.selectors.combobox[fieldName];
      debugLog(cfg.key, 'combobox ' + fieldName, { value: String(value), input: input, menu: menu, mode: mode });
      var useClick = (mode === 'click') || (!mode && cfg.comboboxConfig && cfg.comboboxConfig.mode === 'click');
      // For category matching, use the full path (not just leaf)
      var searchVal = (fieldName === 'category') ? (item['category'] || String(value)) : String(value);
      var result = useClick
        ? await fillClickDropdown(input, menu, searchVal, cfg.comboboxConfig)
        : await fillCombobox(input, menu, searchVal, cfg.comboboxConfig);
      debugLog(cfg.key, 'combobox result ' + fieldName, result);
      if (result.success) {
        filled++;
      } else if (mapping.aiBatchable && settings.geminiKey) {
        // Collect for batch AI matching — use click or type variant based on mode
        const options = useClick
          ? await readClickDropdownOptions(input, menu, cfg.comboboxConfig)
          : await readComboboxOptions(input, menu, cfg.comboboxConfig);
        if (options.length > 0) {
          unmatched.push({
            field: fieldName, sourceValue: String(value),
            context: [item.category, item.title].filter(Boolean).join(' — '),
            options, inputSelector: input, menuSelector: menu, useClick: useClick,
          });
        }
      } else if (mapping.aiBatchable) {
        showToast('⚠️ Size needs manual selection — set a Gemini API key for auto-conversion.');
      }
    }
  }

  // Batch AI match for all unmatched fields
  if (unmatched.length > 0) {
    const aiResults = await batchMatchViaBackground(unmatched, cfg.key);
    for (const r of aiResults) {
      const field = unmatched.find(u => u.field === r.field);
      if (field && r.matchedIndex >= 0) {
        var applied = field.useClick
          ? await clickDropdownOption(field.inputSelector, field.menuSelector, r.matchedIndex, cfg.comboboxConfig)
          : await clickComboboxOption(field.inputSelector, field.menuSelector, r.matchedIndex, cfg.comboboxConfig);
        if (applied) filled++;
      }
    }
  }

  // If category was filled and there are dependent fields, wait
  if (cfg.categoryDependentFields && cfg.categoryDependentFields.some(f => cfg.fieldOrder.indexOf(f) > cfg.fieldOrder.indexOf('category'))) {
    await sleep(1500);
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
      (response) => resolve(response?.results || [])
    );
  });
}
