// popup.js — per-platform settings with tabbed UI

(function () {
  var PLATFORM_KEYS = ['depop', 'poshmark', 'mercari'];
  var activeTab = 'depop';

  // Element refs
  var tabs = document.querySelectorAll('.tab');
  var tabPanes = document.querySelectorAll('.tab-content');
  var geminiKeyInput = document.getElementById('geminiKey');
  var geminiModelSelect = document.getElementById('geminiModel');
  var aiToggle = document.getElementById('aiEnabled');
  var saveBtn = document.getElementById('saveBtn');
  var clearBtn = document.getElementById('clearBtn');
  var statusEl = document.getElementById('status');
  var historyEl = document.getElementById('history');
  var signupName = document.getElementById('signupName');
  var signupEmail = document.getElementById('signupEmail');
  var signupBtn = document.getElementById('signupBtn');
  var signupStatusEl = document.getElementById('signupStatus');

  // Per-platform fields indexed by platform key
  var platformFields = {
    depop: {
      priceBuffer: document.getElementById('depopPriceBuffer'),
      shipping: document.getElementById('depopShipping'),
      worldwide: document.getElementById('depopWorldwide'),
      preferAi: document.getElementById('depopPreferAi'),
      address: {
        fullName: document.getElementById('depopAddrName'),
        address1: document.getElementById('depopAddr1'),
        address2: document.getElementById('depopAddr2'),
        city: document.getElementById('depopAddrCity'),
        state: document.getElementById('depopAddrState'),
        zip: document.getElementById('depopAddrZip'),
        phone: document.getElementById('depopAddrPhone'),
      },
    },
    poshmark: {
      priceBuffer: document.getElementById('poshPriceBuffer'),
      preferAi: document.getElementById('poshPreferAi'),
    },
    mercari: {
      priceBuffer: document.getElementById('mercariPriceBuffer'),
      preferAi: document.getElementById('mercariPreferAi'),
    },
  };

  // --- Tab switching ---
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeTab = tab.dataset.tab;
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      tabPanes.forEach(function (tc) {
        tc.classList.remove('active');
        tc.style.display = 'none';
      });
      var pane = document.getElementById('tab-' + activeTab);
      if (pane) { pane.classList.add('active'); pane.style.display = 'block'; }
    });
  });

  // --- Load settings ---
  chrome.storage.local.get(
    ['platformSettings', 'geminiKey', 'geminiModel', 'aiEnabled', 'priceBuffer', 'shippingPreference'],
    function (result) {
      // Global
      if (result.geminiKey) geminiKeyInput.value = result.geminiKey;
      if (result.geminiModel) geminiModelSelect.value = result.geminiModel;
      aiToggle.checked = result.aiEnabled === true;

      // Per-platform — migrate legacy global settings into platformSettings if needed
      var ps = result.platformSettings || {};
      var migrated = false;
      PLATFORM_KEYS.forEach(function (key) {
        if (!ps[key]) ps[key] = {};
        // Migrate global priceBuffer into depop if no platformSettings exist
        if (!result.platformSettings && key === 'depop' && result.priceBuffer !== undefined && ps[key].priceBuffer === undefined) {
          ps[key].priceBuffer = result.priceBuffer;
          migrated = true;
        }
        if (!result.platformSettings && key === 'depop' && result.shippingPreference !== undefined && ps[key].shipping === undefined) {
          ps[key].shipping = result.shippingPreference;
          migrated = true;
        }
        // Populate fields from platformSettings
        var fields = platformFields[key];
        if (fields) {
          if (fields.priceBuffer) fields.priceBuffer.value = ps[key].priceBuffer ?? 0;
          if (fields.shipping) fields.shipping.value = ps[key].shipping || '';
          if (fields.worldwide) fields.worldwide.checked = !!ps[key].worldwide;
          if (fields.preferAi) fields.preferAi.checked = ps[key].preferAi !== undefined ? !!ps[key].preferAi : true;
          if (fields.address) {
            var addr = ps[key].address || {};
            var af = fields.address;
            Object.keys(af).forEach(function (k) { if (af[k]) af[k].value = addr[k] || ''; });
          }
        }
      });
      // Save migrated settings back
      if (migrated) {
        chrome.storage.local.set({ platformSettings: ps });
        // Clear legacy keys
        chrome.storage.local.remove(['priceBuffer', 'shippingPreference']);
      }
    }
  );

  // --- Save ---
  saveBtn.addEventListener('click', function () {
    // Collect per-platform settings
    var ps = {};
    PLATFORM_KEYS.forEach(function (key) {
      ps[key] = {};
      var fields = platformFields[key];
      if (fields) {
        if (fields.priceBuffer) ps[key].priceBuffer = parseInt(fields.priceBuffer.value, 10) || 0;
        if (fields.shipping) ps[key].shipping = fields.shipping.value;
        if (fields.worldwide) ps[key].worldwide = fields.worldwide.checked;
        if (fields.preferAi) ps[key].preferAi = fields.preferAi.checked;
        if (fields.address) {
          ps[key].address = {};
          var af = fields.address;
          Object.keys(af).forEach(function (k) { ps[key].address[k] = af[k].value.trim(); });
        }
      }
    });

    var settings = {
      platformSettings: ps,
      geminiKey: geminiKeyInput.value.trim(),
      geminiModel: geminiModelSelect.value,
      aiEnabled: aiToggle.checked,
    };

    chrome.storage.local.set(settings, function () {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Settings saved!', 'success');
      }
    });
  });

  // --- Clear staged ---
  clearBtn.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'CONSUME_STAGED' }, function (response) {
      if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, 'error'); return; }
      if (response && response.success) showStatus('Staged listing cleared.', 'success');
    });
  });

  // --- Signup ---
  signupBtn.addEventListener('click', function () {
    var name = signupName.value.trim();
    var email = signupEmail.value.trim();
    if (!email || !email.includes('@')) {
      signupStatusEl.innerText = 'Enter a valid email address.';
      signupStatusEl.className = 'status error';
      setTimeout(function () { signupStatusEl.className = 'status'; signupStatusEl.style.display = 'none'; }, 3000);
      return;
    }
    signupBtn.disabled = true;
    signupBtn.innerText = 'Submitting...';
    chrome.runtime.sendMessage({ action: 'SUBMIT_SIGNUP', data: { name: name, email: email } }, function (response) {
      if (chrome.runtime.lastError) { signupStatusEl.innerText = 'Error: ' + chrome.runtime.lastError.message; signupStatusEl.className = 'status error'; signupBtn.disabled = false; signupBtn.innerText = 'Get notified of updates'; return; }
      if (response && response.success) {
        signupStatusEl.innerText = 'Done — opening form...';
        signupStatusEl.className = 'status success';
        if (response.url) window.open(response.url, '_blank');
        signupName.value = '';
        signupEmail.value = '';
      } else {
        signupStatusEl.innerText = 'Signup form not configured yet.';
        signupStatusEl.className = 'status error';
      }
      signupBtn.disabled = false;
      signupBtn.innerText = 'Get notified of updates';
    });
  });

  // --- History ---
  loadHistory();

  function showStatus(msg, type) {
    statusEl.innerText = msg;
    statusEl.className = 'status ' + type;
    setTimeout(function () { statusEl.className = 'status'; statusEl.style.display = 'none'; }, 3000);
  }

  function loadHistory() {
    chrome.runtime.sendMessage({ action: 'GET_HISTORY' }, function (response) {
      if (chrome.runtime.lastError) { console.warn('loadHistory:', chrome.runtime.lastError.message); return; }
      if (response && response.history && response.history.length > 0) {
        historyEl.innerHTML = response.history.slice(0, 20).map(function (item) {
          var date = new Date(item.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return '<div class="history-item">' +
            '<div class="title">' + escapeHtml(item.ebayTitle) + '</div>' +
            '<div class="meta">$' + item.price + ' · ' + date + ' · ' + item.status + '</div></div>';
        }).join('');
      } else {
        historyEl.innerHTML = '<div class="history-empty">No listings yet. Cross-list your first item!</div>';
      }
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
