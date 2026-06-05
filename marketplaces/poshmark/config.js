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
      // Modal price input — main form price is focused to trigger the modal
      price: '#listing-price-modal-listing-price-input',
    },
    combobox: {
      category:  { input: '[data-et-prop-location="create_listing"]', menu: '.dropdown__menu' },
      brand:     { input: '[data-et-name="listingEditorBrandSection"] input', menu: '.dropdown__menu' },
      condition: { input: '[data-et-name="listing_condition"]', menu: '.dropdown__menu' },
    },
    imageUpload: {
      input: '#img-file-input',
    },
  },

  comboboxConfig: {
    optionRole: '.dropdown__menu__item, .dropdown__link',
    disabledAttr: 'aria-disabled',
    noOptionsSelector: '',
    sectionHeaderSelector: '',
  },

  conditionMap: {
    'new with tags': 'New With Tags',
    'new without tags': 'New Without Tags',
    'new with imperfections': 'Good',
    'excellent': 'Like New',
    'good': 'Good',
    'fair': 'Fair',
  },

  // Price first — triggers modal that must be dismissed before other fields
  fieldOrder: ['price', 'title', 'description', 'category', 'brand', 'condition', 'images'],
  categoryDependentFields: [],
  categoryWaitMs: 0,

  // Hooks for Poshmark's price suggestion modal
  hooks: {
    // Focus main price field → wait for modal → disable Smart Sell → wait for Done
    prePrice: async function (value, settings) {
      var mainPrice = document.querySelector('[data-vv-name="listingPrice"]');
      if (mainPrice) {
        mainPrice.focus();
        mainPrice.click();
        await sleep(1000);
      }
      var modal = document.querySelector('[data-test="modal-container"]');
      if (!modal) { debugLog('poshmark', 'prePrice: modal not found'); return value; }

      var toggleInput = modal.querySelector('[data-test="toggle-input"]');
      if (toggleInput && toggleInput.checked) {
        debugLog('poshmark', 'prePrice: disabling Smart Sell');
        var toggleLabel = modal.querySelector('[data-test="toggle-switch"]');
        if (toggleLabel) toggleLabel.click();
        // Wait for Done button to become visible (it's hidden until Smart Sell is off)
        await sleep(500);
      }
      debugLog('poshmark', 'prePrice: waiting for Done button');
      // Wait for Done button to appear
      var start = Date.now();
      while (Date.now() - start < 1000) {
        var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary') ||
                      document.querySelector('.modal__footer .btn--primary');
        if (doneBtn && doneBtn.offsetParent !== null) {
          debugLog('poshmark', 'prePrice: Done button visible');
          break;
        }
        await sleep(200);
      }
      return value;
    },

    // After price: fill original price, click Done to close modal
    postPrice: async function (value, settings) {
      await sleep(300);
      var origPriceInput = document.getElementById('listing-price-modal-original-price-input');
      if (origPriceInput && settings.priceBuffer > 0) {
        var orig = (parseFloat(value) / (1 + settings.priceBuffer / 100)).toFixed(2);
        setReactValue(origPriceInput, orig);
        await sleep(200);
      }
      // Click Done — search globally in case modal DOM shifted
      var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary') ||
                    document.querySelector('.modal__footer .btn--primary') ||
                    document.querySelector('.listing-price-suggestion-modal .btn--primary') ||
                    document.querySelector('[data-test="modal-container"] .btn--primary');
      if (doneBtn) {
        debugLog('poshmark', 'postPrice: clicking Done');
        doneBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        doneBtn.click();
        await sleep(500);
      } else {
        debugLog('poshmark', 'postPrice: Done button not found — trying close button');
        var closeBtn = document.querySelector('[data-test="modal-close-btn"]');
        if (closeBtn) { closeBtn.click(); await sleep(300); }
      }
    },
  },

  fieldMapping: {
    title:    { source: 'title' },
    description: { source: 'description', aiTransformable: true },
    price:    { source: 'price', applyBuffer: true, hasHooks: true },
    category: { source: 'category', useLeaf: true, fuzzyMatch: true },
    brand:    { source: 'brand', fuzzyMatch: true },
    condition:{ source: 'condition', useMap: 'conditionMap', fuzzyMatch: true },
    images:   { source: 'images', maxImages: 16 },
  },
};
