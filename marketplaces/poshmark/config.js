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
      category:  { input: '.listing-editor__category-container .dropdown__selector', menu: '.listing-editor__category-container .dropdown__menu', twoLevel: true },
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

  fieldOrder: ['price', 'title', 'description', 'category', 'size', 'color', 'brand', 'condition', 'images'],
  categoryDependentFields: ['size', 'color'],
  categoryWaitMs: 1500,

  hooks: {
    prePrice: async function (value, settings) {
      var mainPrice = document.querySelector('[data-vv-name="listingPrice"]');
      if (mainPrice) { mainPrice.focus(); mainPrice.click(); await sleep(1000); }
      var modal = document.querySelector('[data-test="modal-container"]');
      if (!modal) { console.log('[Crosslister:PM] prePrice: no price modal found, skipping'); return value; }

      // Detect modal variant: new "Add Price" modal vs old Smart Sell modal
      var listingPriceInput = modal.querySelector('.listing-price-input');
      var smartSellToggle = modal.querySelector('[data-test="toggle-input"]');

      if (listingPriceInput) {
        // New variant: "Add Price" modal with suggested prices, no Smart Sell toggle
        console.log('[Crosslister:PM] prePrice: new variant price modal');
        // Fill the listing price to enable the Done button
        setReactValue(listingPriceInput, String(value));
        await sleep(500);
      } else if (smartSellToggle) {
        // Old variant: Smart Sell modal
        if (smartSellToggle.checked) {
          var toggleLabel = modal.querySelector('[data-test="toggle-switch"]');
          if (toggleLabel) { toggleLabel.click(); console.log('[Crosslister:PM] Smart Sell toggled off'); }
          await sleep(500);
        }
      } else {
        console.log('[Crosslister:PM] prePrice: unknown modal variant, continuing');
      }

      // Wait for Done button to be enabled (new variant starts disabled until price is filled)
      var start = Date.now();
      while (Date.now() - start < 3000) {
        var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary');
        if (doneBtn && doneBtn.offsetParent !== null && !doneBtn.disabled) {
          console.log('[Crosslister:PM] prePrice: Done button ready after ' + (Date.now() - start) + 'ms');
          break;
        }
        await sleep(200);
      }
      return value;
    },

    postPrice: async function (value, settings) {
      await sleep(300);
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
      if (doneBtn) { doneBtn.click(); await sleep(500); }
      else { var closeBtn = document.querySelector('[data-test="modal-close-btn"]'); if (closeBtn) closeBtn.click(); }
    },

    postCategory: async function (value, settings) {
      // Wait for brand input and size dropdown to appear after category is set
      var deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        var brandInput = document.querySelector('input[placeholder*="Brand"]');
        var sizeTrigger = document.querySelector('[data-test="size"]');
        if (brandInput && sizeTrigger) break;
        await sleep(500);
      }
      console.log('[Crosslister:PM] postCategory: waited ' + (5000 - (deadline - Date.now())) + 'ms');

      // Handle subcategory dropdown (appears after category is set)
      // Find the subcategory dropdown — it's a [data-test="dropdown"] containing "Select Subcategory"
      var subcatDropdowns = document.querySelectorAll('[data-test="dropdown"].form__text--select');
      for (var si = 0; si < subcatDropdowns.length; si++) {
        var trigger = subcatDropdowns[si].querySelector('.dropdown__selector');
        if (trigger && trigger.innerText.indexOf('Subcategory') !== -1) {
          trigger.click();
          await sleep(600);
          var menu = subcatDropdowns[si].querySelector('.dropdown__menu');
          if (menu) {
            var options = Array.from(menu.querySelectorAll('.dropdown__link'))
              .filter(function (o) { return o.innerText.trim(); });
            var leaf = extractLeafCategory(value) || '';
            console.log('[Crosslister:PM] subcategory options:', options.map(function(o) { return o.innerText.trim(); }), 'leaf=' + leaf);
            var best = null, bestScore = 0;
            for (var oi = 0; oi < options.length; oi++) {
              var score = matchScore(leaf, options[oi].innerText.trim());
              if (score > bestScore) { bestScore = score; best = options[oi]; }
            }
            if (best && bestScore >= 0.15) {
              console.log('[Crosslister:PM] clicking subcategory: ' + best.innerText.trim() + ' score=' + bestScore);
              // Click the <a> inside the option
              var link = best.querySelector('a') || best;
              link.click();
              await sleep(400);
            } else if (options.length > 0) {
              // Click "None" if no match
              var noneOpt = options.find(function(o) { return o.innerText.trim() === 'None'; });
              if (noneOpt) { var noneLink = noneOpt.querySelector('a') || noneOpt; noneLink.click(); await sleep(400); }
            }
          }
          break;
        }
      }
    },

    postSize: async function (value, settings) {
      // Click "Done" button inside the size dropdown to confirm selection
      await sleep(400);
      var doneBtn = document.querySelector('.listing-editor__dropdown--large .btn--primary') ||
                    document.querySelector('[data-et-name="apply"]');
      if (doneBtn) {
        console.log('[Crosslister:PM] clicking size Done button');
        doneBtn.click();
        await sleep(500);
      } else {
        console.log('[Crosslister:PM] size Done button not found');
      }
    },

    postColor: async function (value, settings) {
      // Click "Done" button inside the color dropdown to confirm selection
      await sleep(400);
      var doneBtn = document.querySelector('.dropdown:has([data-et-name="color"]) .btn--primary');
      if (doneBtn) {
        console.log('[Crosslister:PM] clicking color Done button');
        doneBtn.click();
        await sleep(500);
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
            await sleep(300);
          }
          console.log('[Crosslister:PM] clicking covershot Apply');
          applyBtn.click();
          await sleep(800);
          return;
        }
        await sleep(500);
      }
      console.log('[Crosslister:PM] covershot Apply not found after timeout');
    },
  },

  fieldMapping: {
    title:    { source: 'title' },
    description: { source: 'description', aiTransformable: true },
    price:    { source: 'price', applyBuffer: true, hasHooks: true },
    category: { source: 'category', useLeaf: false, aiBatchable: true },
    size:     { source: 'size', aiBatchable: true },
    color:    { source: 'color', aiBatchable: true },
    brand:    { source: 'brand' },
    condition:{ source: 'condition', useMap: 'conditionMap' },
    images:   { source: 'images', maxImages: 16, convertWebP: true },
  },
};
