// shared/message-client.js — safe wrapper around chrome.runtime.sendMessage

function safeSendMessage(msg, cb) {
  try {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Crosslister] Runtime error:', chrome.runtime.lastError.message);
        if (cb) cb(null);
        return;
      }
      if (cb) cb(response);
    });
  } catch (e) {
    console.warn('[Crosslister] Extension context invalidated — please refresh this page.');
    if (cb) cb(null);
  }
}
