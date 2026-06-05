// marketplaces/depop/config.js — Depop-specific form configuration

const depopConfig = {
  key: 'depop',
  name: 'Depop',

  // Form field DOM selectors
  selectors: {
    text: {
      description: '#description',
    },
    input: {
      price: '#priceAmount__input',
    },
    combobox: {
      category:  { input: 'group-input', menu: 'group-menu' },
      brand:     { input: 'brand-input', menu: 'brand-menu' },
      size:      { input: 'variants-input', menu: 'variants-menu' },
      condition: { input: 'condition-input', menu: 'condition-menu' },
      shipping:  { input: 'shippingMethods-input', menu: 'shippingMethods-menu' },
    },
    imageUpload: {
      input: '#upload-input__input',
    },
  },

  // CSS selectors for Depop's combobox menu structure
  comboboxConfig: {
    optionRole: '[role="option"]',
    disabledAttr: 'aria-disabled',
    noOptionsSelector: '._noOptionText_yfvje_5',
    sectionHeaderSelector: '._sectionHeader_yfvje_68',
  },

  // eBay → Depop condition mapping
  conditionMap: {
    'new with tags': 'Brand new',
    'new without tags': 'Like new',
    'new with imperfections': 'Used - Good',
    'excellent': 'Like new',
    'good': 'Used - Good',
    'fair': 'Used - Fair',
  },

  // Field fill order (category before brand/size — they depend on it)
  fieldOrder: ['description', 'price', 'category', 'size', 'brand', 'condition', 'shipping', 'images'],
  categoryDependentFields: ['brand', 'size'],

  // How each form field maps to eBay data
  fieldMapping: {
    description: {
      source: 'description',
      prependTitle: true,
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
    size: {
      source: 'size',
      fuzzyMatch: true,
      aiBatchable: true,
    },
    condition: {
      source: 'condition',
      useMap: 'conditionMap',
      fuzzyMatch: true,
    },
    shipping: {
      source: null,
      fromSetting: 'shippingPreference',
      valueMap: {
        small: 'Small', medium: 'Medium', large: 'Large',
        xl: 'Extra Large', free: 'Free', manual: 'Arrange'
      },
    },
    images: {
      source: 'images',
      maxImages: 8,
    },
  },
};
