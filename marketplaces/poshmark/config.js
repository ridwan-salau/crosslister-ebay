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
      category:  { input: '.listing-editor__category-container .dropdown__selector', menu: '.listing-editor__category-container .dropdown__menu' },
      condition: { input: '.listing-editor__condition-container .dropdown__selector', menu: '.listing-editor__condition-container .dropdown__menu' },
      size:      { input: '[data-test="size"]', menu: '.listing-editor__dropdown--large' },
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

  fieldOrder: ['price', 'title', 'description', 'category', 'size', 'brand', 'condition', 'images'],
  categoryDependentFields: [],
  categoryWaitMs: 0,

  hooks: {
    prePrice: async function (value, settings) {
      var mainPrice = document.querySelector('[data-vv-name="listingPrice"]');
      if (mainPrice) { mainPrice.focus(); mainPrice.click(); await sleep(1000); }
      var modal = document.querySelector('[data-test="modal-container"]');
      if (!modal) return value;
      var toggleInput = modal.querySelector('[data-test="toggle-input"]');
      if (toggleInput && toggleInput.checked) {
        var toggleLabel = modal.querySelector('[data-test="toggle-switch"]');
        if (toggleLabel) toggleLabel.click();
        await sleep(500);
      }
      var start = Date.now();
      while (Date.now() - start < 1000) {
        var doneBtn = document.querySelector('[data-test="modal-footer"] .btn--primary');
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
                    document.querySelector('.listing-price-suggestion-modal .btn--primary');
      if (doneBtn) { doneBtn.click(); await sleep(500); }
      else { var closeBtn = document.querySelector('[data-test="modal-close-btn"]'); if (closeBtn) closeBtn.click(); }
    },
  },

  fieldMapping: {
    title:    { source: 'title' },
    description: { source: 'description', aiTransformable: true },
    price:    { source: 'price', applyBuffer: true, hasHooks: true },
    category: { source: 'category', useLeaf: false, fuzzyMatch: true },
    size:     { source: 'size', fuzzyMatch: true, aiBatchable: true },
    brand:    { source: 'brand', fuzzyMatch: true },
    condition:{ source: 'condition', useMap: 'conditionMap', fuzzyMatch: true },
    images:   { source: 'images', maxImages: 16, convertWebP: true },
  },
};
