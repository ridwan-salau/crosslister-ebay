// background/index.js — message router (delegates to modules)

// Signup form config
const SIGNUP_FORM_TEMPLATE = 'https://docs.google.com/forms/d/e/1FAIpQLScZCVPNG0GXUarTaHXAcK-CCl3K7GzN1SUQMzDia7KyFZTFEw/viewform?usp=pp_url&entry.2005620554=NAME_PLACEHOLDER&entry.1045781291=EMAIL_PLACEHOLDER@email.com';
const SIGNUP_NAME_TOKEN = 'NAME_PLACEHOLDER';
const SIGNUP_EMAIL_TOKEN = 'EMAIL_PLACEHOLDER@email.com';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // --- eBay staging ---
  if (request.action === 'STAGE_LISTING') {
    setStaged(request.data, request.id);
    sendResponse({ success: true });
  }

  if (request.action === 'GET_STAGED_LISTING') {
    sendResponse({ item: getStaged(request.id) });
  }

  if (request.action === 'CONSUME_STAGED') {
    consumeStaged(request.id);
    sendResponse({ success: true });
  }

  // --- CORS proxy ---
  if (request.action === 'FETCH_IMAGE_BLOB') {
    fetchImageAsDataUrl(request.url)
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'FETCH_TEXT') {
    fetchPageText(request.url)
      .then(text => sendResponse({ text }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // --- Gemini AI ---
  if (request.action === 'TRANSFORM_DESCRIPTION') {
    transformDescription(request.description, request.platform || 'depop')
      .then(transformed => sendResponse({ transformed }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'BATCH_MATCH') {
    batchMatch(request.fields, request.platform || 'depop')
      .then(results => sendResponse({ results }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // --- Listing history ---
  if (request.action === 'LOG_LISTING') {
    const showSignup = logListing(request.data);
    sendResponse({ success: true, showSignup });
  }

  if (request.action === 'GET_HISTORY') {
    sendResponse({ history: getHistory() });
  }

  // --- Signup ---
  if (request.action === 'DISMISS_SIGNUP') {
    dismissSignup();
    sendResponse({ success: true });
  }

  if (request.action === 'SUBMIT_SIGNUP') {
    const url = SIGNUP_FORM_TEMPLATE
      .replace(SIGNUP_NAME_TOKEN, encodeURIComponent(request.data.name || ''))
      .replace(SIGNUP_EMAIL_TOKEN, encodeURIComponent(request.data.email || ''));
    completeSignup();
    sendResponse({ success: true, url });
  }

  return true;
});
