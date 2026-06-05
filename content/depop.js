// content/depop.js — Depop listing form bootstrap

(async function init() {
  const url = window.location.href;
  const platform = getPlatformForUrl(url);
  if (!platform || platform.key !== 'depop') return;

  const bannerObj = makeBanner({
    text: '📦 Loading...',
    color: platform.colorGradient,
    onClick: null,
  });

  safeSendMessage({ action: 'GET_STAGED_LISTING' }, async (response) => {
    if (!response || !response.item) {
      bannerObj.remove();
      return;
    }

    const item = response.item;
    bannerObj.update(`📦 eBay listing ready: <strong>${escapeHtml(item.title.slice(0, 60))}${item.title.length > 60 ? '…' : ''}</strong> <span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:4px;">Click to paste into form</span>`);
    bannerObj.el && (bannerObj.el.onclick = () => doFill(item, bannerObj));

    // Auto-fill if form is already visible
    setTimeout(() => {
      const descEl = document.querySelector(depopConfig.selectors.text.description);
      const priceEl = document.querySelector(depopConfig.selectors.input.price);
      if (descEl || priceEl) doFill(item, bannerObj);
    }, 3000);
  });

  async function doFill(item, bannerObj) {
    bannerObj.update('⏳ Filling form...');
    const settings = await new Promise(r => {
      chrome.storage.local.get(['priceBuffer', 'aiEnabled', 'shippingPreference', 'geminiKey'], r);
    });
    const result = await fillForm(depopConfig, item, settings);
    safeSendMessage({ action: 'CONSUME_STAGED' }, () => {});
    safeSendMessage({
      action: 'LOG_LISTING',
      data: { ebayTitle: item.title, ebayId: item.itemId, price: item.price }
    }, (response) => {
      if (response && response.showSignup) setTimeout(() => showSignupModal(), 2000);
    });
    bannerObj.update(`✓ Done! ${result.filledCount} fields filled. Review and publish.`);
    showToast(`✓ ${result.filledCount} fields pasted — review and publish on Depop.`);
    setTimeout(() => bannerObj.remove(), 4000);
  }
})();
