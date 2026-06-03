// background.js — service worker for eBay → Depop crosslister

let stagedItem = null;
let listingHistory = [];
let signupCount = 0;
let signupThreshold = 0;
let signupDismissed = false;

// Restore state from storage on startup
chrome.storage.local.get(
  ['listingHistory', 'signupCount', 'signupThreshold', 'signupDismissed'],
  (result) => {
    if (result.listingHistory) listingHistory = result.listingHistory;
    if (result.signupCount !== undefined) signupCount = result.signupCount;
    if (result.signupThreshold !== undefined) signupThreshold = result.signupThreshold;
    else signupThreshold = randomThreshold();
    if (result.signupDismissed !== undefined) signupDismissed = result.signupDismissed;
  }
);

function randomThreshold() {
  return Math.floor(Math.random() * 5) + 3; // 3–7
}

function saveSignupState() {
  chrome.storage.local.set({ signupCount, signupThreshold, signupDismissed });
}

function saveHistory() {
  // Keep last 50 entries
  if (listingHistory.length > 50) {
    listingHistory = listingHistory.slice(-50);
  }
  chrome.storage.local.set({ listingHistory });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // --- eBay → staging ---
  if (request.action === 'STAGE_LISTING') {
    stagedItem = { ...request.data, stagedAt: Date.now() };
    sendResponse({ success: true });
  }

  // --- Depop requests staged item (peek, don't consume) ---
  if (request.action === 'GET_STAGED_LISTING') {
    sendResponse({ item: stagedItem });
  }

  // --- Consume after successful form fill ---
  if (request.action === 'CONSUME_STAGED') {
    stagedItem = null;
    sendResponse({ success: true });
  }

  // --- Image fetching (bypass CORS) ---
  if (request.action === 'FETCH_IMAGE_BLOB') {
    fetch(request.url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ dataUrl: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => sendResponse({ error: err.message }));
    return true; // async
  }

  // --- AI description transform (Google Gemini) ---
  if (request.action === 'TRANSFORM_DESCRIPTION') {
    chrome.storage.local.get(['geminiKey', 'aiPrompt'], (settings) => {
      if (!settings.geminiKey) {
        sendResponse({ error: 'No Gemini API key configured' });
        return;
      }
      const systemPrompt = settings.aiPrompt ||
        'Rewrite the following eBay listing description into a casual, trendy Depop style. Add relevant hashtags at the end. Keep it under 1000 characters.';
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are a Depop listing assistant. Write in a trendy, casual tone with relevant hashtags.' }]
          },
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nOriginal description:\n${request.description}` }]
          }],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7
          }
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            sendResponse({ error: data.error.message });
          } else {
            sendResponse({ transformed: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
          }
        })
        .catch(err => sendResponse({ error: err.message }));
    });
    return true; // async
  }

  // --- AI option matching (for size translation etc.) ---
  if (request.action === 'MATCH_OPTION') {
    chrome.storage.local.get(['geminiKey'], (settings) => {
      if (!settings.geminiKey) {
        sendResponse({ error: 'No Gemini API key configured' });
        return;
      }
      const { ebayValue, options, field, context } = request;
      const optionsList = options.map((o, i) => `${i}: ${o}`).join('\n');
      const contextLine = context ? `\nItem context: ${context}\n` : '';
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are a product listing assistant. Given a value from one marketplace and a list of options from another, return ONLY the index number of the best matching option. Consider sizing conventions (e.g., numeric vs letter, regional differences, category-specific sizing). Reply with just the number, nothing else.' }]
          },
          contents: [{
            parts: [{ text: `Field: ${field}\neBay value: ${ebayValue}${contextLine}\nDepop options:\n${optionsList}\n\nBest match index:` }]
          }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 }
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            sendResponse({ error: data.error.message });
          } else {
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            const idx = parseInt(text, 10);
            sendResponse({ index: isNaN(idx) ? -1 : idx });
          }
        })
        .catch(err => sendResponse({ error: err.message }));
    });
    return true; // async
  }

  // --- Record listing in history ---
  if (request.action === 'LOG_LISTING') {
    listingHistory.unshift({
      ebayTitle: request.data.ebayTitle,
      ebayId: request.data.ebayId,
      price: request.data.price,
      timestamp: Date.now(),
      status: 'listed'
    });
    saveHistory();

    // Signup prompt tracking
    if (!signupDismissed) {
      signupCount++;
      if (signupCount >= signupThreshold) {
        signupCount = 0;
        signupThreshold = randomThreshold();
        saveSignupState();
        sendResponse({ success: true, showSignup: true });
        return true;
      }
      saveSignupState();
    }

    sendResponse({ success: true });
  }

  // --- Signup prompt dismissed ---
  if (request.action === 'DISMISS_SIGNUP') {
    signupCount = 0;
    signupThreshold = randomThreshold();
    signupDismissed = true;
    saveSignupState();
    sendResponse({ success: true });
  }

  // --- Submit signup to webhook ---
  if (request.action === 'SUBMIT_SIGNUP') {
    chrome.storage.local.get(['webhookUrl'], (settings) => {
      if (!settings.webhookUrl) {
        sendResponse({ error: 'No webhook URL configured' });
        return;
      }
      fetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: request.data.name,
          email: request.data.email,
          source: 'ebay-depop-crosslister',
          timestamp: new Date().toISOString()
        })
      })
        .then(() => {
          signupDismissed = true;
          signupCount = 0;
          saveSignupState();
          sendResponse({ success: true });
        })
        .catch(err => sendResponse({ error: err.message }));
    });
    return true; // async
  }

  // --- Get history ---
  if (request.action === 'GET_HISTORY') {
    sendResponse({ history: listingHistory });
  }

  // --- Clear staged item ---
  if (request.action === 'CLEAR_STAGED') {
    stagedItem = null;
    sendResponse({ success: true });
  }

  return true;
});
