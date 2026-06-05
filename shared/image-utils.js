// shared/image-utils.js — image upload helpers

function fetchImageViaBackground(url) {
  return new Promise((resolve, reject) => {
    safeSendMessage({ action: 'FETCH_IMAGE_BLOB', url }, (response) => {
      if (!response || response.error) return reject(new Error(response?.error || 'Unknown'));
      if (response.dataUrl) {
        const arr = response.dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        resolve(new Blob([u8arr], { type: mime }));
      } else {
        reject(new Error('No dataUrl in response'));
      }
    });
  });
}

async function uploadImages(imageUrls, fileInput, maxImages) {
  maxImages = maxImages || 8;
  const files = [];
  for (const url of imageUrls.slice(0, maxImages)) {
    try {
      const blob = await fetchImageViaBackground(url);
      if (blob) {
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        files.push(new File([blob], `ebay-${files.length + 1}.${ext}`, { type: blob.type || 'image/jpeg' }));
      }
    } catch (_) { /* skip failed images */ }
  }
  if (files.length === 0) return 0;

  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  return files.length;
}
