// content/poshmark.js — Poshmark listing form bootstrap

(function () {
  console.log('PM init start');
  var url = window.location.href;
  var platform = getPlatformForUrl(url);
  if (!platform || platform.key !== 'poshmark') return;

  var bannerObj = makeBanner({
    text: '📦 Loading...',
    color: platform.colorGradient,
    onClick: null,
  });
  console.log('PM banner created');

  safeSendMessage({ action: 'GET_STAGED_LISTING' }, function (response) {
    console.log('PM staged response:', !!response, !!(response && response.item));
    if (!response || !response.item) { bannerObj.remove(); return; }

    var item = response.item;
    bannerObj.update('📦 eBay listing ready: <strong>' + escapeHtml(item.title.slice(0, 60)) + (item.title.length > 60 ? '…' : '') + '</strong> <span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:4px;">Click to paste into form</span>');
    bannerObj.el.onclick = function () { doFill(item, bannerObj); };

    // Retry auto-fill: Poshmark form renders asynchronously
    var retries = 0;
    function tryAutoFill() {
      var titleEl = document.querySelector(poshmarkConfig.selectors.text.title);
      if (titleEl) {
        console.log('PM form ready after ' + (retries * 500) + 'ms');
        doFill(item, bannerObj);
      } else if (++retries < 20) {
        setTimeout(tryAutoFill, 500);
      } else {
        console.log('PM form not found after 10s — waiting for manual click');
      }
    }
    tryAutoFill();
  });

  function doFill(item, bannerObj) {
    console.log('PM doFill start');
    bannerObj.update('⏳ Filling form...');

    // Dismiss error modals
    var modal = document.querySelector('[data-test="modal-container"]');
    if (modal && modal.innerText.indexOf('Sorry') !== -1) {
      var okBtn = modal.querySelector('.btn--primary');
      if (okBtn) { okBtn.click(); console.log('PM dismissed error modal'); }
    }

    chrome.storage.local.get(['priceBuffer', 'aiEnabled', 'geminiKey'], function (settings) {
      console.log('PM got settings, calling fillForm');
      fillForm(poshmarkConfig, item, settings).then(function (result) {
        console.log('PM fillForm done', result);
        safeSendMessage({ action: 'CONSUME_STAGED' }, function () {});
        safeSendMessage({
          action: 'LOG_LISTING',
          data: { ebayTitle: item.title, ebayId: item.itemId, price: item.price }
        }, function (response) {
          if (response && response.showSignup) { setTimeout(function () { showSignupModal(); }, 2000); }
        });
        bannerObj.update('✓ Done! ' + result.filledCount + ' fields filled.');
        showToast('✓ ' + result.filledCount + ' fields pasted.');
        setTimeout(function () { bannerObj.remove(); }, 4000);
      }).catch(function (e) {
        console.log('PM fillForm error:', e);
        bannerObj.setError('Error: ' + e.message);
      });
    });
  }
})();
