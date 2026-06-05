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
    // Focus main price field → wait for modal → disable Smart Sell
    prePrice: async function (value, settings) {
      var mainPrice = document.querySelector('[data-vv-name="listingPrice"]');
      if (mainPrice) {
        mainPrice.focus();
        mainPrice.click();
        await sleep(1000);
      }
      var modal = document.querySelector('[data-test="modal-container"]');
      if (!modal) return value;
      var toggleInput = modal.querySelector('[data-test="toggle-input"]');
      if (toggleInput && toggleInput.checked) {
        var toggleLabel = modal.querySelector('[data-test="toggle-switch"]');
        if (toggleLabel) toggleLabel.click();
        await sleep(300);
      }
      return value;
    },

    // After price: fill original price, click Done to close modal
    postPrice: async function (value, settings) {
      var modal = document.querySelector('[data-test="modal-container"]');
      if (!modal) return;
      var origPriceInput = document.getElementById('listing-price-modal-original-price-input');
      if (origPriceInput && settings.priceBuffer > 0) {
        var orig = (parseFloat(value) / (1 + settings.priceBuffer / 100)).toFixed(2);
        setReactValue(origPriceInput, orig);
        await sleep(200);
      }
      var doneBtn = modal.querySelector('.btn--primary');
      if (doneBtn) { doneBtn.click(); await sleep(500); }
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
