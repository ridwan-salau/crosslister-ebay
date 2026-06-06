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
    'pre-owned - excellent': 'Used - Excellent',
    'excellent': 'Used - Excellent',
    'pre-owned - good': 'Used - Good',
    'good': 'Used - Good',
    'pre-owned - fair': 'Used - Fair',
    'fair': 'Used - Fair',
  },

  // Field fill order (category before brand/size — they depend on it)
  fieldOrder: ['description', 'price', 'category', 'size', 'brand', 'condition', 'shipping', 'images'],
  categoryDependentFields: ['size'],

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
      aiBatchable: true,
    },
    brand: {
      source: 'brand',
    },
    size: {
      source: 'size',
      aiBatchable: true,
    },
    condition: {
      source: 'condition',
      useMap: 'conditionMap',
    },
    shipping: {
      source: null,
      fromSetting: 'shippingPreference',
      valueMap: {
        xxs: 'Extra extra small',
        xs: 'Extra small',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        xl: 'Extra large',
      },
    },
    images: {
      source: 'images',
      maxImages: 8,
    },
  },
};
