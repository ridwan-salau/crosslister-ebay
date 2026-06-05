// content/base-filler.js — platform-agnostic form-filling engine

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
        const count = await uploadImages(value, fileInput, maxImages);
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
      }
      continue;
    }

    if (isInput) {
      const el = document.querySelector(cfg.selectors.input[fieldName]);
      if (el) {
        setReactValue(el, String(value));
        filled++;
      }
      continue;
    }

    if (isCombobox) {
      const { input, menu } = cfg.selectors.combobox[fieldName];
      const result = await fillCombobox(input, menu, String(value), cfg.comboboxConfig);
      if (result.success) {
        filled++;
      } else if (mapping.aiBatchable && settings.geminiKey) {
        // Collect for batch AI matching
        const options = await readComboboxOptions(input, menu, cfg.comboboxConfig);
        if (options.length > 0) {
          unmatched.push({
            field: fieldName,
            sourceValue: String(value),
            context: [item.category, item.title].filter(Boolean).join(' — '),
            options,
            inputId: input,
            menuId: menu,
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
        await clickComboboxOption(field.inputId, field.menuId, r.matchedIndex, cfg.comboboxConfig);
        filled++;
      }
    }
  }

  // If category was filled and there are dependent fields, wait
  if (cfg.categoryDependentFields && cfg.categoryDependentFields.some(f => cfg.fieldOrder.indexOf(f) > cfg.fieldOrder.indexOf('category'))) {
    await sleep(1500);
  }

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
