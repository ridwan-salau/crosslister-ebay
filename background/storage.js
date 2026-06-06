// background/storage.js — state management for the extension

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
  if (listingHistory.length > 50) listingHistory = listingHistory.slice(-50);
  chrome.storage.local.set({ listingHistory });
}

// --- Public API ---

function getStaged() {
  return stagedItem;
}

function setStaged(data) {
  stagedItem = { ...data, stagedAt: Date.now() };
  // Persist for MV3 service worker safety (workers can be terminated anytime)
  chrome.storage.local.set({ stagedItem: stagedItem });
}

function consumeStaged() {
  stagedItem = null;
  chrome.storage.local.remove('stagedItem');
}

// Restore staged item on startup (service worker may have been restarted)
chrome.storage.local.get(['stagedItem'], function (result) {
  if (result.stagedItem) stagedItem = result.stagedItem;
});

function logListing(data) {
  listingHistory.unshift({
    ebayTitle: data.ebayTitle,
    ebayId: data.ebayId,
    price: data.price,
    timestamp: Date.now(),
    status: 'listed'
  });
  saveHistory();

  if (!signupDismissed) {
    signupCount++;
    if (signupCount >= signupThreshold) {
      signupCount = 0;
      signupThreshold = randomThreshold();
      saveSignupState();
      return true; // show signup prompt
    }
    saveSignupState();
  }
  return false;
}

function getHistory() {
  return listingHistory;
}

function dismissSignup() {
  signupCount = 0;
  signupThreshold = randomThreshold();
  signupDismissed = true;
  saveSignupState();
}

function completeSignup() {
  signupDismissed = true;
  signupCount = 0;
  saveSignupState();
}
