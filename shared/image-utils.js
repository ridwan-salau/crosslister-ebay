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

// Convert an image blob/dataUrl to a JPEG blob via Canvas
async function convertToJpeg(sourceBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(function (blob) {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, 'image/jpeg', 0.95);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for conversion'));
    };
    img.src = url;
  });
}

// Check if a URL points to a webp image
function isWebP(url) {
  return /\.webp(\?|$)/i.test(url);
}

async function uploadImages(imageUrls, fileInput, maxImages, convertWebP) {
  maxImages = maxImages || 8;
  var files = [];
  for (var i = 0; i < Math.min(imageUrls.length, maxImages); i++) {
    try {
      var blob = await fetchImageViaBackground(imageUrls[i]);
      if (!blob) continue;
      // Convert .webp to .jpeg if requested (Poshmark doesn't accept webp)
      if (convertWebP !== false && isWebP(imageUrls[i])) {
        blob = await convertToJpeg(blob);
      }
      var ext = isWebP(imageUrls[i]) ? 'jpg' : (imageUrls[i].split('.').pop()?.split('?')[0] || 'jpg');
      files.push(new File([blob], 'ebay-' + (files.length + 1) + '.' + ext, { type: blob.type || 'image/jpeg' }));
    } catch (e) { console.warn('[Crosslister] image upload failed: ' + imageUrls[i] + ' - ' + (e && e.message)); }
  }
  if (files.length === 0) return 0;

  var dt = new DataTransfer();
  files.forEach(function (f) { dt.items.add(f); });
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  return files.length;
}
