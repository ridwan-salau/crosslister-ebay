// marketplaces/poshmark/config.js — Poshmark form configuration (stub)
// TODO: Update selectors after inspecting Poshmark's listing form

const poshmarkConfig = {
  key: 'poshmark',
  name: 'Poshmark',

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
  categoryDependentFields: ['brand', 'size'],

  fieldMapping: {
    title: { source: 'title' },
    description: { source: 'description', prependTitle: false, aiTransformable: true },
    price: { source: 'price', applyBuffer: true },
    category: { source: 'category', useLeaf: true, fuzzyMatch: true },
    brand: { source: 'brand', fuzzyMatch: true },
    size: { source: 'size', fuzzyMatch: true, aiBatchable: true },
    condition: { source: 'condition', useMap: 'conditionMap', fuzzyMatch: true },
    images: { source: 'images', maxImages: 16 },
  },
};
