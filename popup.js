// popup.js — settings and history for the extension toolbar popup

document.addEventListener('DOMContentLoaded', () => {
  const geminiKeyInput = document.getElementById('geminiKey');
  const priceBufferInput = document.getElementById('priceBuffer');
  const shippingSelect = document.getElementById('shippingPreference');
  const aiToggle = document.getElementById('aiEnabled');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const historyEl = document.getElementById('history');

  // Load saved settings
  chrome.storage.local.get(
    ['geminiKey', 'priceBuffer', 'shippingPreference', 'aiEnabled'],
    (result) => {
      if (result.geminiKey) geminiKeyInput.value = result.geminiKey;
      if (result.priceBuffer !== undefined) priceBufferInput.value = result.priceBuffer;
      else priceBufferInput.value = 10; // default
      if (result.shippingPreference) shippingSelect.value = result.shippingPreference;
      aiToggle.checked = result.aiEnabled === true; // default false — user must opt in
    }
  );

  // Load history
  loadHistory();

  // Save
  saveBtn.addEventListener('click', () => {
    const settings = {
      geminiKey: geminiKeyInput.value.trim(),
      priceBuffer: parseInt(priceBufferInput.value, 10) || 0,
      shippingPreference: shippingSelect.value,
      aiEnabled: aiToggle.checked
    };

    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Settings saved!', 'success');
      }
    });
  });

  // Clear staged item
  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_STAGED' }, (response) => {
      if (response && response.success) {
        showStatus('Staged listing cleared.', 'success');
      }
    });
  });

  function showStatus(msg, type) {
    statusEl.innerText = msg;
    statusEl.className = 'status ' + type;
    setTimeout(() => {
      statusEl.className = 'status';
      statusEl.style.display = 'none';
    }, 3000);
  }

  function loadHistory() {
    chrome.runtime.sendMessage({ action: 'GET_HISTORY' }, (response) => {
      if (response && response.history && response.history.length > 0) {
        historyEl.innerHTML = response.history.slice(0, 20).map(item => {
          const date = new Date(item.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return `
            <div class="history-item">
              <div class="title">${escapeHtml(item.ebayTitle)}</div>
              <div class="meta">$${item.price} · ${date} · ${item.status}</div>
            </div>
          `;
        }).join('');
      } else {
        historyEl.innerHTML = '<div class="history-empty">No listings yet. Cross-list your first item!</div>';
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
