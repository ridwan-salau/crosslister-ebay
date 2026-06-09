// marketplaces/poshmark/config.js — Poshmark listing form configuration

const poshmarkConfig = {
  key: 'poshmark',
  name: 'Poshmark',

  selectors: {
    text: {
      title: '[data-vv-name="title"]',
      description: '[data-vv-name="description"]',
    },
    input: {
      price: '#listing-price-modal-listing-price-input',
    },
    combobox: {
      category:  { input: '.listing-editor__category-container .dropdown__selector', menu: '.listing-editor__category-container .dropdown__menu', twoLevel: true, deferSub: true },
      condition: { input: '.listing-editor__condition-container .dropdown__selector', menu: '.listing-editor__condition-container .dropdown__menu' },
      size:      { input: '[data-test="size"]', menu: '.listing-editor__dropdown--large', optionRole: 'button.multi-size-selector__button' },
      color:     { input: '.dropdown:has([data-et-name="color"])', menu: '.dropdown:has([data-et-name="color"]) .dropdown__menu', optionRole: '.listing-editor__tile--color' },
      brand:     { input: 'input[placeholder*="Brand"]', menu: '.listing-editor__suggestions-list', mode: 'type' },
    },
    imageUpload: {
      input: '#img-file-input',
    },
  },

  comboboxConfig: {
    mode: 'click',
    optionRole: '.dropdown__link',
    disabledAttr: 'aria-disabled',
    noOptionsSelector: '',
    sectionHeaderSelector: '',
  },

  conditionMap: {
    'new with tags': 'New With Tags',
    'new without tags': 'Like New',
    'new with imperfections': 'Good',
    'excellent': 'Like New',
    'good': 'Good',
    'fair': 'Fair',
  },

  fieldOrder: ['price', 'title', 'description', 'category', 'color', 'brand', 'condition', 'images'],
  categoryDependentFields: ['color'],
  categoryWaitMs: 1000,

  hooks: {
    prePrice: async function (value, settings) {
      // The price modal may already be open (Poshmark shows it automatically
      // when no price is set), or may need to be triggered by clicking the
      // Listing Price field on the main form.
      var priceModal = document.querySelector('.listing-price-suggestion-modal');

      if (!priceModal) {
        var mainPrice = document.querySelector('[data-vv-name="listingPrice"]');
        console.log('[Crosslister:PM] prePrice: modal not open, mainPrice field=' + !!mainPrice);
        if (mainPrice) {
          mainPrice.focus();
          mainPrice.click();
          var waitStart = Date.now();
          while (Date.now() - waitStart < 3000) {
            await sleep(200);
            priceModal = document.querySelector('.listing-price-suggestion-modal');
            if (priceModal) break;
          }
        }
      } else {
        console.log('[Crosslister:PM] prePrice: modal already open');
      }

      // Fall back to generic modal selector, but log what we found
      if (!priceModal) {
        priceModal = document.querySelector('[data-test="modal-container"]');
        if (priceModal) {
          console.log('[Crosslister:PM] prePrice: fallback to generic modal, classes=' + priceModal.className);
        }
      }

      if (!priceModal) {
        console.log('[Crosslister:PM] prePrice: no price modal found, skipping');
        return value;
      }

      console.log('[Crosslister:PM] prePrice: modal found, class=' + priceModal.className + ' visible=' + (priceModal.offsetParent !== null));

      // Wait for modal content to render (React may not have populated it yet)
      var listingPriceInput = null;
      var smartSellToggle = null;
      var contentStart = Date.now();
      while (Date.now() - contentStart < 3000) {
        listingPriceInput = priceModal.querySelector('.listing-price-input');
        smartSellToggle = priceModal.querySelector('[data-test="toggle-input"]');
        if (listingPriceInput || smartSellToggle) break;
        await sleep(150);
      }

      console.log('[Crosslister:PM] prePrice: listingPriceInput=' + !!listingPriceInput + ' smartSellToggle=' + !!smartSellToggle);

      if (listingPriceInput) {
        // "Add Price" modal variant (with or without suggested prices)
        console.log('[Crosslister:PM] prePrice: Add Price modal, filling price=' + value);
        setReactValue(listingPriceInput, String(value));
        await sleep(300);
        console.log('[Crosslister:PM] prePrice: after setReactValue, input value=' + listingPriceInput.value);
      } else if (smartSellToggle) {
        // Old variant: Smart Sell modal
        console.log('[Crosslister:PM] prePrice: Smart Sell modal');
        if (smartSellToggle.checked) {
          var toggleLabel = priceModal.querySelector('[data-test="toggle-switch"]');
          if (toggleLabel) { toggleLabel.click(); console.log('[Crosslister:PM] Smart Sell toggled off'); }
          await sleep(300);
        }
      } else {
        console.log('[Crosslister:PM] prePrice: unknown modal variant');
      }

      // Wait for Done button to be enabled. Scope to this specific modal to
      // avoid matching buttons from other modals on the page.
      var start = Date.now();
      while (Date.now() - start < 3000) {
        var doneBtn = priceModal.querySelector('[data-test="modal-footer"] .btn--primary') ||
                      priceModal.querySelector('.modal__footer .btn--primary');
        if (doneBtn && !doneBtn.disabled) {
          console.log('[Crosslister:PM] prePrice: Done button ready after ' + (Date.now() - start) + 'ms');
          break;
        }
        await sleep(200);
      }
      if (!doneBtn || doneBtn.disabled) {
        console.log('[Crosslister:PM] prePrice: Done button still disabled after timeout');
      }
      return value;
    },

    postPrice: async function (value, settings) {
      await sleep(150);
      var modal = document.querySelector('[data-test="modal-container"]');
      // Original price: try old ID first, then look for input after "Original Price" label
      var origPriceInput = document.getElementById('listing-price-modal-original-price-input') ||
                           (modal && modal.querySelector('.listing-editor__field-description__text + input'));
      // Fallback: find input in modal body that isn't the listing price input
      if (!origPriceInput && modal) {
        var bodyInputs = modal.querySelectorAll('[data-test="modal-body"] input[type="number"]');
        // The original price input is typically the second number input (after listing price)
        if (bodyInputs.length >= 2) origPriceInput = bodyInputs[1];
      }
      if (origPriceInput && settings.priceBuffer > 0) {
        var orig = (parseFloat(value) / (1 + settings.priceBuffer / 100)).toFixed(2);
        setReactValue(origPriceInput, orig);
        await sleep(200);
      }
      var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary') ||
                    document.querySelector('.modal__footer .btn--primary') ||
                    (modal && modal.querySelector('.btn--primary'));
      if (doneBtn) { doneBtn.click(); await sleep(300); }
      else { var closeBtn = document.querySelector('[data-test="modal-close-btn"]'); if (closeBtn) closeBtn.click(); }
    },

    postCategory: async function (value, settings, item) {
      // Build context from already-filled form fields
      var context = '';

      // --- Phase 1: twoLevel sub-category ---
      // The category dropdown is still open after fillClickDropdown clicked the
      // top-level but deferred the sub. Read sub-options and AI-match them.
      var catMenu = document.querySelector('.listing-editor__category-container .dropdown__menu');
      if (catMenu) {
        var subLists = catMenu.querySelectorAll('ul');
        var twoLevelOpts = [];
        for (var sl = 1; sl < subLists.length; sl++) {
          var items = subLists[sl].querySelectorAll('.dropdown__link');
          for (var sj = 0; sj < items.length; sj++) {
            if (items[sj].getAttribute('aria-disabled') !== 'true' && items[sj].innerText.trim()) {
              twoLevelOpts.push(items[sj]);
            }
          }
        }
        if (twoLevelOpts.length > 0) {
          console.log('[Crosslister:PM] postCategory: twoLevel sub-options=' + twoLevelOpts.map(function(o) { return o.innerText.trim(); }));
          var twoLevelField = {
            field: 'twoLevelSub',
            sourceValue: value,
            context: context,
            options: twoLevelOpts.map(function(o) { return o.innerText.trim(); }),
            _elements: twoLevelOpts
          };

          var twoLevelIdx = -1;
          if (settings.preferAi && settings.geminiKey) {
            var tlResults = await batchMatchViaBackground([twoLevelField], 'poshmark');
            console.log('[Crosslister:PM] postCategory: twoLevel AI results=' + JSON.stringify(tlResults));
            if (tlResults.length > 0 && tlResults[0].matchedIndex >= 0) {
              twoLevelIdx = tlResults[0].matchedIndex;
            }
          }
          if (twoLevelIdx < 0) {
            var leaf = extractLeafCategory(value) || '';
            var bestScore = 0;
            for (var tli = 0; tli < twoLevelOpts.length; tli++) {
              var s = matchScore(leaf, twoLevelOpts[tli].innerText.trim());
              if (s > bestScore) { bestScore = s; twoLevelIdx = tli; }
            }
            if (bestScore < 0.15) twoLevelIdx = -1;
          }

          if (twoLevelIdx >= 0) {
            var tlEl = twoLevelOpts[twoLevelIdx];
            console.log('[Crosslister:PM] postCategory: clicking twoLevel sub "' + tlEl.innerText.trim() + '"');
            var tlLink = tlEl.querySelector('a') || tlEl;
            tlLink.click();
            await sleep(400);
          }
        }
        document.body.click();
        await sleep(200);
      }

      // --- Phase 2: subcategory + size + color (available after twoLevel is set) ---
      var aiFields = [];

      // 2a. Subcategory dropdown
      var subcatDropdowns = document.querySelectorAll('[data-test="dropdown"].form__text--select');
      for (var si = 0; si < subcatDropdowns.length; si++) {
        var trigger = subcatDropdowns[si].querySelector('.dropdown__selector');
        if (trigger && trigger.innerText.indexOf('Subcategory') !== -1) {
          trigger.click();
          await sleep(400);
          var menu = subcatDropdowns[si].querySelector('.dropdown__menu');
          if (menu) {
            var subcatOpts = Array.from(menu.querySelectorAll('.dropdown__link'))
              .filter(function (o) { return o.innerText.trim(); });
            console.log('[Crosslister:PM] postCategory: subcategory options=' + subcatOpts.map(function(o) { return o.innerText.trim(); }));
            aiFields.push({ field: 'subcategory', sourceValue: value, context: context, options: subcatOpts.map(function(o) { return o.innerText.trim(); }), _trigger: trigger, _menu: subcatDropdowns[si], _optRole: '.dropdown__link', _clickDone: false });
          }
          break;
        }
      }

      // 2b. Size — exact match across size-category tabs (Standard, Plus,
      //      Petite, Juniors, Maternity). Fall back to Custom + type value.
      var sizeValue = item && item.size ? String(item.size).trim() : '';
      if (sizeValue) {
        var sizeTrigger = document.querySelector('[data-test="size"]');
        if (sizeTrigger) {
          sizeTrigger.click();
          await sleep(500);
          var sizeMenu = document.querySelector('.listing-editor__dropdown--large');
          if (sizeMenu) {
            var sizeTabs = sizeMenu.querySelectorAll('a[data-test^="horizontal-nav-"]');
            var sizeFound = false;
            console.log('[Crosslister:PM] postCategory: searching size="' + sizeValue + '" across ' + sizeTabs.length + ' tabs');
            for (var ti = 0; ti < sizeTabs.length && !sizeFound; ti++) {
              var tabText = (sizeTabs[ti].querySelector('span') || sizeTabs[ti]).innerText.trim();
              // Skip Custom tab for exact-match search
              if (tabText === 'Custom') continue;
              sizeTabs[ti].click();
              await sleep(300);
              var sizeBtns = sizeMenu.querySelectorAll('button.multi-size-selector__button');
              for (var bi = 0; bi < sizeBtns.length; bi++) {
                if (sizeBtns[bi].offsetParent !== null && sizeBtns[bi].innerText.trim() === sizeValue) {
                  console.log('[Crosslister:PM] postCategory: exact size match "' + sizeValue + '" in tab "' + tabText + '"');
                  sizeBtns[bi].click();
                  sizeFound = true;
                  break;
                }
              }
            }
            // Custom fallback
            if (!sizeFound) {
              console.log('[Crosslister:PM] postCategory: size not found in tabs, using Custom');
              var customTab = sizeMenu.querySelector('a[data-test="horizontal-nav-5"]');
              if (customTab) { customTab.click(); await sleep(300); }
              var customInput = document.getElementById('customSizeInput0');
              if (customInput) {
                setReactValue(customInput, sizeValue);
                await sleep(200);
                var saveBtn = document.querySelector('.listing-editor__custom_sizes .btn--secondary');
                if (saveBtn) { saveBtn.click(); await sleep(300); }
              }
            }
            // Click Done
            var sizeDoneBtn = sizeMenu.querySelector('.btn--primary');
            if (sizeDoneBtn) { sizeDoneBtn.click(); console.log('[Crosslister:PM] postCategory: size Done clicked'); await sleep(300); }
            document.body.click();
            await sleep(200);
          }
        }
      }

      // 2c. Color dropdown
      var colorTrigger = document.querySelector('.dropdown:has([data-et-name="color"]) .dropdown__selector');
      if (colorTrigger) {
        colorTrigger.click();
        await sleep(400);
        var colorMenu = document.querySelector('.dropdown:has([data-et-name="color"]) .dropdown__menu');
        if (colorMenu) {
          var colorOpts = Array.from(colorMenu.querySelectorAll('.dropdown__link'))
            .filter(function (o) { return o.innerText.trim(); });
          if (colorOpts.length > 0) {
            console.log('[Crosslister:PM] postCategory: color options=' + colorOpts.map(function(o) { return o.innerText.trim(); }));
            aiFields.push({ field: 'color', sourceValue: item && item.color ? String(item.color) : '', context: context, options: colorOpts.map(function(o) { return o.innerText.trim(); }), _trigger: colorTrigger, _menu: colorMenu, _menuSel: '.dropdown:has([data-et-name="color"]) .dropdown__menu', _optRole: '.dropdown__link', _clickDone: true });
          }
          document.body.click();
          await sleep(200);
        }
      }

      // 2d. Batch AI for subcategory + color (size handled above with exact match)
      if (aiFields.length > 0 && settings.preferAi && settings.geminiKey) {
        console.log('[Crosslister:PM] postCategory: batching ' + aiFields.length + ' fields to AI');
        var aiResults = await batchMatchViaBackground(aiFields, 'poshmark');
        console.log('[Crosslister:PM] postCategory: AI batch results=' + JSON.stringify(aiResults));
        for (var ri = 0; ri < aiResults.length; ri++) {
          var r = aiResults[ri];
          var f = aiFields.find(function(af) { return af.field === r.field; });
          if (!f || r.matchedIndex < 0 || !f._trigger) continue;

          // Re-open the dropdown via its trigger, then click the option at the
          // matched index. Re-query the menu fresh from the page — the cached
          // element may be stale if Poshmark recreates dropdown DOM each open.
          f._trigger.click();
          await sleep(f._optRole === 'button.multi-size-selector__button' ? 500 : 400);
          var fmenu = (f._menuSel && document.querySelector(f._menuSel)) || f._menu;
          fmenu = (fmenu && fmenu.querySelector('.dropdown__menu')) || fmenu;
          var fopts = Array.from(fmenu.querySelectorAll(f._optRole))
            .filter(function(o) { return o.getAttribute('aria-disabled') !== 'true' && o.innerText.trim(); });
          if (r.matchedIndex < fopts.length) {
            var flink = fopts[r.matchedIndex].querySelector('a') || fopts[r.matchedIndex];
            console.log('[Crosslister:PM] postCategory: AI clicking ' + f.field + ' "' + fopts[r.matchedIndex].innerText.trim() + '"');
            flink.click();
            await sleep(300);
          }

          // Click "Done" for fields that need confirmation (size, color)
          if (f._clickDone) {
            await sleep(300);
            var doneBtn = fmenu.querySelector('.btn--primary');
            if (doneBtn) { console.log('[Crosslister:PM] postCategory: clicking ' + f.field + ' Done button'); doneBtn.click(); await sleep(200); }
          }

          // Close the dropdown after applying
          document.body.click();
          await sleep(200);
        }
      } else if (aiFields.length > 0) {
        // No AI — fuzzy fallback
        for (var ai = 0; ai < aiFields.length; ai++) {
          var af = aiFields[ai];
          if (!af._trigger) continue;
          af._trigger.click();
          await sleep(400);
          var fmenu2 = (af._menuSel && document.querySelector(af._menuSel)) || af._menu;
          fmenu2 = (fmenu2 && fmenu2.querySelector('.dropdown__menu')) || fmenu2;
          var fopts2 = Array.from(fmenu2.querySelectorAll(af._optRole))
            .filter(function(o) { return o.getAttribute('aria-disabled') !== 'true' && o.innerText.trim(); });
          var leaf2 = extractLeafCategory(af.sourceValue) || af.sourceValue;
          var bestIdx = -1, bestScore2 = 0;
          for (var oi = 0; oi < fopts2.length; oi++) {
            var score = matchScore(leaf2, fopts2[oi].innerText.trim());
            if (score > bestScore2) { bestScore2 = score; bestIdx = oi; }
          }
          if (bestIdx >= 0 && bestScore2 >= 0.15) {
            var flink2 = fopts2[bestIdx].querySelector('a') || fopts2[bestIdx];
            console.log('[Crosslister:PM] postCategory: fuzzy clicking ' + af.field + ' "' + fopts2[bestIdx].innerText.trim() + '" score=' + bestScore2);
            flink2.click();
            await sleep(400);
          }
          document.body.click();
          await sleep(200);
        }
      }
    },

    postSize: async function (value, settings) {
      // Click "Done" button inside the size dropdown to confirm selection
      await sleep(100);
      var doneBtn = document.querySelector('.listing-editor__dropdown--large .btn--primary') ||
                    document.querySelector('[data-et-name="apply"]');
      if (doneBtn) {
        console.log('[Crosslister:PM] clicking size Done button');
        doneBtn.click();
        await sleep(300);
      } else {
        console.log('[Crosslister:PM] size Done button not found');
      }
    },

    postColor: async function (value, settings) {
      // Click "Done" button inside the color dropdown to confirm selection
      await sleep(100);
      var doneBtn = document.querySelector('.dropdown:has([data-et-name="color"]) .btn--primary');
      if (doneBtn) {
        console.log('[Crosslister:PM] clicking color Done button');
        doneBtn.click();
        await sleep(300);
      } else {
        console.log('[Crosslister:PM] color Done button not found');
      }
    },

    postImages: async function (value, settings) {
      // After uploading images, Poshmark shows a "Select a Covershot" modal.
      // The first image is pre-selected with max zoom — set to minimum zoom, then Apply.
      var deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        var applyBtn = document.querySelector('[data-test="modal-container"].modal--large [data-test="modal-footer"] .btn--primary') ||
                       document.querySelector('[data-test="modal-container"] [data-et-name="apply"]');
        if (applyBtn && applyBtn.offsetParent !== null) {
          // Set zoom slider to minimum
          var slider = document.querySelector('[data-test="modal-container"] .cr-slider');
          if (slider) {
            var nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(slider, slider.min);
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(200);
          }
          console.log('[Crosslister:PM] clicking covershot Apply');
          applyBtn.click();
          await sleep(500);
          return;
        }
        await sleep(300);
      }
      console.log('[Crosslister:PM] covershot Apply not found after timeout');
    },
  },

  fieldMapping: {
    title:    { source: 'title' },
    description: { source: 'description', aiTransformable: true },
    price:    { source: 'price', applyBuffer: true, hasHooks: true },
    category: { source: 'category', useLeaf: false },
    size:     { source: 'size' },
    color:    { source: 'color' },
    brand:    { source: 'brand' },
    condition:{ source: 'condition', useMap: 'conditionMap' },
    images:   { source: 'images', maxImages: 16, convertWebP: true },
  },
};
