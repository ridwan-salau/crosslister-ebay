// marketplaces/poshmark/config.js — Poshmark listing form configuration

const poshmarkConfig = {
  key: 'poshmark',
  name: 'Poshmark',

  // Form field DOM selectors
  // Poshmark uses data-vv-name for form validation, not id/name
  selectors: {
    text: {
      title: '[data-vv-name="title"]',
      description: '[data-vv-name="description"]',
    },
    input: {
      price: '[data-vv-name="listingPrice"]',
      originalPrice: '[data-vv-name="originalPrice"]',
    },
    combobox: {
      // Category is a multi-level dropdown using data-et-name attributes
      category:  { input: '[data-et-prop-location="create_listing"]', menu: '.dropdown__menu' },
      // Brand is a typeahead autocomplete
      brand:     { input: '[data-et-name="listingEditorBrandSection"] input, [data-et-name="listingEditorBrandSection"] .type-ahead__input input', menu: '.dropdown__menu' },
      // Condition is a dropdown with data-et-prop-content values (nwt, nwot, etc.)
      condition: { input: '[data-et-name="listing_condition"]', menu: '.dropdown__menu' },
    },
    imageUpload: {
      input: '#img-file-input',
    },
  },

  // Poshmark combobox structure
  comboboxConfig: {
    optionRole: '.dropdown__menu__item, .dropdown__link',
    disabledAttr: 'aria-disabled',
    noOptionsSelector: '',
    sectionHeaderSelector: '',
    // Options identified by data-et-prop-content or inner text
    optionTextSelector: '[data-et-prop-content], .dropdown__link',
  },

  // eBay → Poshmark condition mapping
  conditionMap: {
    'new with tags': 'New With Tags',
    'new without tags': 'New Without Tags',
    'new with imperfections': 'Good',
    'excellent': 'Like New',
    'good': 'Good',
    'fair': 'Fair',
  },

  // Field fill order (Poshmark has no shipping; size is in style tags)
  fieldOrder: ['title', 'description', 'price', 'category', 'brand', 'condition', 'images'],
  categoryDependentFields: [],

  // How each form field maps to eBay data
  fieldMapping: {
    title: {
      source: 'title',
    },
    description: {
      source: 'description',
      aiTransformable: true,
    },
    price: {
      source: 'price',
      applyBuffer: true,
    },
    category: {
      source: 'category',
      useLeaf: true,
      fuzzyMatch: true,
    },
    brand: {
      source: 'brand',
      fuzzyMatch: true,
    },
    condition: {
      source: 'condition',
      useMap: 'conditionMap',
      fuzzyMatch: true,
    },
    images: {
      source: 'images',
      maxImages: 16,
    },
  },
};
