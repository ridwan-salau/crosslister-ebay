// background-wrapper.js — loads background modules via importScripts
try {
  importScripts(
    'background/storage.js',
    'background/image-proxy.js',
    'background/gemini.js',
    'background/index.js'
  );
} catch (e) {
  console.error('[Crosslister] Failed to load background modules:', e);
}
