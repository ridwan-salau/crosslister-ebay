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
      // Click-to-select dropdowns — Poshmark doesn't use type-to-filter
      category:  { input: '.listing-editor__category-container .dropdown__selector', menu: '.listing-editor__category-container .dropdown__menu' },
      condition: { input: '.listing-editor__condition-container .dropdown__selector', menu: '.listing-editor__condition-container .dropdown__menu' },
      size:      { input: '[data-test="size"]', menu: '.listing-editor__dropdown--large' },
      color:     { input: '[data-et-name="color"]', menu: '.dropdown__menu--dark' },
      brand:     { input: '[data-et-name="listingEditorBrandSection"] .dropdown__selector', menu: '.listing-editor__suggestions-list' },
    },
    imageUpload: {
      input: '#img-file-input',
    },
  },

  // Click-to-select mode — Poshmark dropdowns open on click, not typing
  comboboxConfig: {
    mode: 'click',
    optionRole: '.dropdown__menu__item, .dropdown__link, li',
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
  categoryDependentFields: ['size'],
  categoryWaitMs: 0,

  hooks: {
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
        await sleep(500);
      }
      debugLog('poshmark', 'prePrice: waiting for Done button');
      var start = Date.now();
      while (Date.now() - start < 1000) {
        var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary') ||
                      document.querySelector('.modal__footer .btn--primary');
        if (doneBtn && doneBtn.offsetParent !== null) break;
        await sleep(200);
      }
      return value;
    },

    postPrice: async function (value, settings) {
      await sleep(300);
      var origPriceInput = document.getElementById('listing-price-modal-original-price-input');
      if (origPriceInput && settings.priceBuffer > 0) {
        var orig = (parseFloat(value) / (1 + settings.priceBuffer / 100)).toFixed(2);
        setReactValue(origPriceInput, orig);
        await sleep(200);
      }
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
    size:     { source: 'size', fuzzyMatch: true, aiBatchable: true },
    color:    { source: null }, // Will be set from eBay color if available, or skipped
    brand:    { source: 'brand', fuzzyMatch: true },
    condition:{ source: 'condition', useMap: 'conditionMap', fuzzyMatch: true },
    images:   { source: 'images', maxImages: 16, convertWebP: true },
  },
};
