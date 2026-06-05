// shared/ui-utils.js — reusable UI widgets (banner, toast, signup modal)

function showToast(message, duration) {
  duration = duration || 5000;
  const existing = document.querySelector('.xlister-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'xlister-toast';
  toast.innerText = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999999;
    background:#1a1a1a;color:#fff;padding:12px 20px;
    border-radius:8px;font-size:14px;font-family:-apple-system,sans-serif;
    box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:360px;
    transition:opacity 0.3s;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, duration);
}

function makeBanner(config) {
  if (document.getElementById('xlister-banner')) {
    document.getElementById('xlister-banner').remove();
  }

  const banner = document.createElement('div');
  banner.id = 'xlister-banner';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999999;
    background:${config.color || 'linear-gradient(135deg,#ff0050,#ff4d6d)'};
    color:#fff;padding:10px 20px;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:14px;font-weight:600;
    display:flex;align-items:center;justify-content:center;gap:12px;
    box-shadow:0 2px 12px rgba(255,0,80,0.3);
    cursor:${config.onClick ? 'pointer' : 'default'};
  `;
  if (config.onClick) banner.onclick = config.onClick;
  banner.innerHTML = `<span>${config.text || ''}</span>`;
  document.body.appendChild(banner);
  document.documentElement.style.marginTop = '46px';

  return {
    el: banner,
    update(text) {
      banner.innerHTML = `<span>${text}</span>`;
    },
    remove() {
      banner.remove();
      document.documentElement.style.marginTop = '';
    },
    setError(text) {
      banner.style.background = '#e74c3c';
      banner.innerHTML = `<span>${text}</span>`;
      setTimeout(() => {
        banner.remove();
        document.documentElement.style.marginTop = '';
      }, 5000);
    }
  };
}

function showSignupModal() {
  if (document.getElementById('xlister-signup-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'xlister-signup-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999999;
    background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:#fff;border-radius:12px;padding:28px 24px 20px;max-width:380px;width:90%;
    box-shadow:0 8px 32px rgba(0,0,0,.25);text-align:center;
  `;
  modal.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#1a1a1a;">Stay updated</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#888;">Get notified about new features and improvements.</p>
    <input id="xlister-signup-name" type="text" placeholder="Full name" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:8px;box-sizing:border-box;">
    <input id="xlister-signup-email" type="email" placeholder="Email address" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:16px;box-sizing:border-box;">
    <div style="display:flex;gap:8px;">
      <button id="xlister-signup-submit" style="flex:1;padding:10px;background:#ff0050;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Notify me</button>
      <button id="xlister-signup-dismiss" style="flex:1;padding:10px;background:#f0f0f0;color:#555;border:none;border-radius:6px;font-size:14px;cursor:pointer;">No thanks</button>
    </div>
    <p id="xlister-signup-error" style="margin:8px 0 0;font-size:12px;color:#c62828;display:none;"></p>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const nameInput = document.getElementById('xlister-signup-name');
  const emailInput = document.getElementById('xlister-signup-email');
  const errorEl = document.getElementById('xlister-signup-error');

  document.getElementById('xlister-signup-submit').onclick = () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      return;
    }
    safeSendMessage(
      { action: 'SUBMIT_SIGNUP', data: { name, email } },
      (response) => {
        if (response && response.success) {
          overlay.remove();
          showToast('✓ Thanks! Opening signup form...');
          if (response.url) window.open(response.url, '_blank');
        } else {
          errorEl.textContent = 'Signup form is not yet configured.';
          errorEl.style.display = 'block';
        }
      }
    );
  };

  document.getElementById('xlister-signup-dismiss').onclick = () => {
    safeSendMessage({ action: 'DISMISS_SIGNUP' }, () => {});
    overlay.remove();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      safeSendMessage({ action: 'DISMISS_SIGNUP' }, () => {});
      overlay.remove();
    }
  };
}
