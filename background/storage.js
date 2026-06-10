// background/storage.js — state management for the extension

const DEFAULT_SLOT = '_default';
const STAGED_TTL_MS = 5 * 60 * 1000; // 5 minutes

let stagedItems = new Map();
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

function getStaged(id) {
  var key = id || DEFAULT_SLOT;
  return stagedItems.get(key) || null;
}

function setStaged(data, id) {
  var key = id || DEFAULT_SLOT;
  stagedItems.set(key, { ...data, stagedAt: Date.now() });
  // Auto-expire after TTL to prevent stale data accumulation
  setTimeout(function () {
    var item = stagedItems.get(key);
    if (item && Date.now() - item.stagedAt >= STAGED_TTL_MS) {
      stagedItems.delete(key);
    }
  }, STAGED_TTL_MS);
}

function consumeStaged(id) {
  if (id) {
    stagedItems.delete(id);
  } else {
    // No ID: clear all staged items (used by popup "Clear Staged" button)
    stagedItems.clear();
  }
}

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
