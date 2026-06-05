// content/mercari.js — Mercari listing form bootstrap (stub)
// TODO: Wire up after mercariConfig.js is populated with real selectors

(async function init() {
  const url = window.location.href;
  const platform = getPlatformForUrl(url);
  if (!platform || platform.key !== 'mercari') return;

  safeSendMessage({ action: 'GET_STAGED_LISTING' }, async (response) => {
    if (!response || !response.item) return;

    const bannerObj = makeBanner({
      text: `📦 eBay listing ready — click to paste into ${platform.name}`,
      color: platform.colorGradient,
    });
    bannerObj.el.onclick = async () => {
      bannerObj.update('⏳ Filling form...');
      const settings = await new Promise(r => {
        chrome.storage.local.get(['priceBuffer', 'aiEnabled', 'geminiKey'], r);
      });
      const result = await fillForm(mercariConfig, response.item, settings);
      safeSendMessage({ action: 'CONSUME_STAGED' }, () => {});
      bannerObj.update(`✓ Done! ${result.filledCount} fields filled.`);
    };
  });
})();
