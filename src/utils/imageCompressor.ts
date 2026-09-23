/**
 * Utility to compress images taken on phones or uploaded by citizens.
 * Prevents HTML5 localStorage QuotaExceededError by resizing images to reasonable
 * emergency review dimensions (max 900px) and compressing with JPEG at ~0.65 quality.
 * Shrinks 5MB-15MB phone camera photos down to 35KB-70KB.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 900,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve('');
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      compressDataUrl(dataUrl, maxDimension, quality)
        .then(resolve)
        .catch(() => resolve(dataUrl));
    };
    reader.readAsDataURL(file);
  });
}

export async function compressDataUrl(
  dataUrl: string,
  maxDimension = 900,
  quality = 0.65
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  // If already small (< 60KB), don't re-compress
  if (dataUrl.length < 60000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(dataUrl);
    }, 4000);

    img.onerror = () => {
      clearTimeout(timer);
      resolve(dataUrl);
    };

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          resolve(dataUrl);
          return;
        }

        // Calculate scaling
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Draw image directly onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to jpeg for optimal size vs quality
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };

    img.src = dataUrl;
  });
}
