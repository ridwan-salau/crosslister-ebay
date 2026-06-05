// marketplaces/registry.js — platform definitions and lookup

// Default platform if none selected
const DEFAULT_PLATFORM = 'depop';

const PLATFORMS = {
  depop: {
    key: 'depop',
    name: 'Depop',
    color: '#ff0050',
    colorGradient: 'linear-gradient(135deg,#ff0050,#ff4d6d)',
    createUrl: 'https://www.depop.com/products/create/',
    contentScriptMatches: [
      'https://www.depop.com/products/create/*',
      'https://www.depop.com/products/*/edit*',
      'https://www.depop.com/sell*',
      'https://www.depop.com/listing*',
    ],
    hostPermissions: ['https://*.depop.com/*'],
  },
  poshmark: {
    key: 'poshmark',
    name: 'Poshmark',
    color: '#ce377b',
    colorGradient: 'linear-gradient(135deg,#ce377b,#e85d9e)',
    createUrl: 'https://poshmark.com/create-listing',
    contentScriptMatches: [
      'https://poshmark.com/create-listing*',
      'https://poshmark.com/closet/*',
      'https://poshmark.com/listing/*',
    ],
    hostPermissions: ['https://*.poshmark.com/*'],
  },
  mercari: {
    key: 'mercari',
    name: 'Mercari',
    color: '#2a8bf2',
    colorGradient: 'linear-gradient(135deg,#2a8bf2,#5ba8f7)',
    createUrl: 'https://www.mercari.com/sell/',
    contentScriptMatches: [
      'https://www.mercari.com/sell*',
      'https://www.mercari.com/listing*',
    ],
    hostPermissions: ['https://*.mercari.com/*'],
  },
};

function getPlatform(key) {
  return PLATFORMS[key] || PLATFORMS[DEFAULT_PLATFORM];
}

function getPlatformForUrl(url) {
  for (const platform of Object.values(PLATFORMS)) {
    for (const pattern of platform.contentScriptMatches) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(url)) return platform;
    }
  }
  return null;
}

function getAllPlatforms() {
  return Object.values(PLATFORMS);
}
