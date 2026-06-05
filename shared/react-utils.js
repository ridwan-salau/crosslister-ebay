// shared/react-utils.js — React-compatible value setters

// React 17+ listens on the document root via event delegation.
// To set a value that React picks up:
// 1. Use the native property setter (bypasses React's override)
// 2. Dispatch 'input' with bubbles:true

function setReactValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, String(value));
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  if (el._valueTracker) el._valueTracker.setValue(el.value);
}

function setReactTextarea(el, value) {
  setReactValue(el, value);
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 80) + 'px';
}
