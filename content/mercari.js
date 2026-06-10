// content/mercari.js — Mercari listing form bootstrap (stub)
// TODO: Wire up after mercariConfig.js is populated with real selectors

(async function init() {
  const url = window.location.href;
  const platform = getPlatformForUrl(url);
  if (!platform || platform.key !== 'mercari') return;

  var stagingId = (window.location.hash || '').match(/xlister=([^&]*)/);
  stagingId = stagingId ? stagingId[1] : undefined;

  safeSendMessage({ action: 'GET_STAGED_LISTING', id: stagingId }, async (response) => {
    if (!response || !response.item) return;

    const bannerObj = makeBanner({
      text: `📦 eBay listing ready — click to paste into ${platform.name}`,
      color: platform.colorGradient,
    });
    bannerObj.el.onclick = async () => {
      bannerObj.update('⏳ Filling form...');
      const settings = await new Promise(r => {
        chrome.storage.local.get(['platformSettings', 'aiEnabled', 'geminiKey', 'geminiModel'], r);
      });
      var ps = (settings.platformSettings && settings.platformSettings.mercari) || {};
      settings.priceBuffer = ps.priceBuffer ?? 0;
      settings.preferAi = ps.preferAi !== undefined ? !!ps.preferAi : true;
      const result = await fillForm(mercariConfig, response.item, settings);
      safeSendMessage({ action: 'CONSUME_STAGED', id: stagingId }, () => {});
      bannerObj.update(`✓ Done! ${result.filledCount} fields filled.`);
    };
  });
})();
