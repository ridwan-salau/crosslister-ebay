// marketplaces/mercari/config.js — Mercari form configuration (stub)
// TODO: Update selectors after inspecting Mercari's listing form

const mercariConfig = {
  key: 'mercari',
  name: 'Mercari',

  selectors: {
    text: {
      title: '',        // TODO
      description: '',  // TODO
    },
    input: {
      price: '',        // TODO
    },
    combobox: {
      category:  { input: '', menu: '' },
      brand:     { input: '', menu: '' },
      size:      { input: '', menu: '' },
      condition: { input: '', menu: '' },
    },
    imageUpload: {
      input: '',        // TODO
    },
  },

  comboboxConfig: {
    optionRole: '[role="option"]',
    disabledAttr: 'aria-disabled',
    noOptionsSelector: '',
    sectionHeaderSelector: '',
  },

  conditionMap: {},

  fieldOrder: ['title', 'description', 'price', 'category', 'size', 'brand', 'condition', 'images'],
  categoryDependentFields: ['size'],

  fieldMapping: {
    title: { source: 'title' },
    description: { source: 'description', prependTitle: false, aiTransformable: true },
    price: { source: 'price', applyBuffer: true },
    category: { source: 'category', useLeaf: true },
    brand: { source: 'brand' },
    size: { source: 'size', aiBatchable: true },
    condition: { source: 'condition', useMap: 'conditionMap' },
    images: { source: 'images', maxImages: 12, convertWebP: true },
  },
};
