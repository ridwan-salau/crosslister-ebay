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
      chrome.storage.local.get(['platformSettings', 'aiEnabled', 'geminiKey', 'geminiModel'], r);
    });
    var ps = (settings.platformSettings && settings.platformSettings.depop) || {};
    settings.priceBuffer = ps.priceBuffer ?? 0;
    settings.shippingPreference = ps.shipping || '';
    settings.address = ps.address || null;
    settings.worldwide = !!ps.worldwide;
    settings.preferAi = ps.preferAi !== undefined ? !!ps.preferAi : true;
    const result = await fillForm(depopConfig, item, settings);
    await fillShippingAddress(settings);
    await applyWorldwideShipping(settings);
    await clickContinue();
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

  async function applyWorldwideShipping(settings) {
    if (!settings.worldwide) return;
    var cb = document.getElementById('checkbox-Offer worldwide shipping') ||
             document.querySelector('input[name="isInternationalShippingEnabled"]');
    if (cb && !cb.checked) {
      console.log('[Crosslister:DP] enabling worldwide shipping');
      cb.click();
      await sleep(400);
    }
  }

  async function clickContinue() {
    // Wait for address modal to close if it was open
    var deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      var modal = document.getElementById('add-address-modal');
      if (!modal || modal.offsetParent === null) break;
      await sleep(400);
    }
    // Poll for the Continue button — it may render late or be disabled initially
    deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      var btn = document.querySelector('button[type="submit"]');
      if (btn && btn.innerText.indexOf('Continue') !== -1) {
        if (btn.disabled) {
          console.log('[Crosslister:DP] Continue button disabled, waiting...');
          await sleep(500);
          continue;
        }
        console.log('[Crosslister:DP] clicking Continue');
        btn.scrollIntoView({ block: 'center' });
        await sleep(200);
        btn.click();
        await sleep(1500);
        return;
      }
      await sleep(500);
    }
    console.log('[Crosslister:DP] Continue button not found or still disabled after timeout');
  }

  async function fillShippingAddress(settings) {
    var addr = settings.address;
    if (!addr) return;
    var hasAddr = addr.address1 || addr.city || addr.zip || addr.state || addr.phone;
    if (!hasAddr) return;

    // Click "Add new shipping address"
    var addBtn = null;
    var allDialogs = document.querySelectorAll('[aria-haspopup="dialog"]');
    for (var i = 0; i < allDialogs.length; i++) {
      if (allDialogs[i].innerText.indexOf('Add new shipping address') !== -1) {
        addBtn = allDialogs[i];
        break;
      }
    }
    if (!addBtn) { console.log('[Crosslister:DP] Add shipping address button not found'); return; }
    console.log('[Crosslister:DP] clicking Add new shipping address');
    addBtn.click();
    await sleep(1200);

    var modal = document.getElementById('add-address-modal') ||
                document.querySelector('aside[aria-label="Add new shipping address"]');
    if (!modal) { console.log('[Crosslister:DP] address modal not found'); return; }
    console.log('[Crosslister:DP] filling address fields');

    // Override name if provided
    if (addr.fullName) {
      var nameInput = modal.querySelector('#name__input') || modal.querySelector('[data-testid="name__input"]');
      if (nameInput) { setReactValue(nameInput, addr.fullName); await sleep(200); }
    }

    if (addr.address1) {
      var a1 = modal.querySelector('[data-testid="addressInput__searchInput__input"]') ||
               modal.querySelector('#addressInput__searchInput__input');
      if (a1) { setReactValue(a1, addr.address1); await sleep(200); }
    }
    if (addr.address2) {
      var a2 = modal.querySelector('[data-testid="address2__input"]') || modal.querySelector('#address2__input');
      if (a2) { setReactValue(a2, addr.address2); await sleep(200); }
    }
    if (addr.city) {
      var city = modal.querySelector('[data-testid="city__input"]') || modal.querySelector('#city__input');
      if (city) { setReactValue(city, addr.city); await sleep(200); }
    }
    if (addr.zip) {
      var zip = modal.querySelector('[data-testid="postal_code__input"]') ||
                modal.querySelector('[data-testid="address-form_input_postal-code"]') ||
                modal.querySelector('#postal_code__input');
      if (zip) { setReactValue(zip, addr.zip); await sleep(200); }
    }
    if (addr.phone) {
      var phone = modal.querySelector('[data-testid="phone_number__input"]') || modal.querySelector('#phone_number__input');
      if (phone) { setReactValue(phone, addr.phone); await sleep(200); }
    }
    if (addr.state) {
      var stateInput = modal.querySelector('#state-input');
      if (stateInput) {
        // Depop shows full state names, but popup stores 2-letter abbreviations
        var stateFull = addr.state;
        if (stateFull.length === 2) {
          var STATE_MAP = {
            AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
            CT:'Connecticut',DE:'Delaware',DC:'District Of Columbia (Washington, D.C.)',
            FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',
            IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
            MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
            MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
            NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
            OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
            SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
            VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
          };
          stateFull = STATE_MAP[addr.state] || addr.state;
        }
        // Type the state name to filter the combobox
        setReactValue(stateInput, stateFull);
        await sleep(300);
        var stateMenu = document.getElementById('state-menu');
        if (stateMenu) {
          var stateOptions = Array.from(stateMenu.querySelectorAll('[role="option"]'))
            .filter(function (o) { return o.getAttribute('aria-disabled') !== 'true'; });
          for (var si = 0; si < stateOptions.length; si++) {
            var optText = stateOptions[si].innerText.trim();
            if (optText === stateFull || optText.indexOf(stateFull) !== -1) {
              stateOptions[si].click();
              await sleep(300);
              break;
            }
          }
        }
      }
    }

    await sleep(400);
    var submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
      console.log('[Crosslister:DP] submitting address');
      submitBtn.click();
      await sleep(1000);
    }
  }
})();
