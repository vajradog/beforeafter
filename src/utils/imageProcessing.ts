/**
 * Canvas-based image processing for Before/After Pro.
 * All operations are 100% client-side.
 */

/**
 * Create a side-by-side comparison image from two data URLs.
 * Adds BEFORE/AFTER labels.
 */
export async function createSideBySide(
  beforeDataUrl: string,
  afterDataUrl: string,
  quality: number = 0.9
): Promise<string> {
  const [beforeImg, afterImg] = await Promise.all([
    loadImg(beforeDataUrl),
    loadImg(afterDataUrl),
  ]);

  // Use the max dimensions to normalize
  const w = Math.max(beforeImg.width, afterImg.width);
  const h = Math.max(beforeImg.height, afterImg.height);

  const canvas = document.createElement('canvas');
  // 4px divider between images
  const divider = 4;
  canvas.width = w * 2 + divider;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;

  // Dark background for any gaps
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw before image (centered if smaller)
  const bx = (w - beforeImg.width) / 2;
  const by = (h - beforeImg.height) / 2;
  ctx.drawImage(beforeImg, bx, by);

  // Draw divider
  ctx.fillStyle = '#fff';
  ctx.fillRect(w, 0, divider, h);

  // Draw after image (centered if smaller)
  const ax = w + divider + (w - afterImg.width) / 2;
  const ay = (h - afterImg.height) / 2;
  ctx.drawImage(afterImg, ax, ay);

  // Add labels
  const fontSize = Math.max(24, Math.floor(h * 0.04));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  const padding = fontSize * 0.4;
  const labelH = fontSize + padding * 2;

  // BEFORE label
  const beforeText = 'BEFORE';
  const beforeMetrics = ctx.measureText(beforeText);
  const beforeLabelW = beforeMetrics.width + padding * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(padding, padding, beforeLabelW, labelH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(beforeText, padding * 2, padding + fontSize);

  // AFTER label
  const afterText = 'AFTER';
  const afterMetrics = ctx.measureText(afterText);
  const afterLabelW = afterMetrics.width + padding * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(w + divider + padding, padding, afterLabelW, labelH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(afterText, w + divider + padding * 2, padding + fontSize);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Resize a data URL image if it exceeds maxDimension on either side.
 * Returns the resized data URL.
 */
export async function resizeImage(
  dataUrl: string,
  maxDimension: number = 1920,
  quality: number = 0.85
): Promise<string> {
  const img = await loadImg(dataUrl);

  if (img.width <= maxDimension && img.height <= maxDimension) {
    return dataUrl;
  }

  const ratio = Math.min(maxDimension / img.width, maxDimension / img.height);
  const newW = Math.round(img.width * ratio);
  const newH = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, newW, newH);

  return canvas.toDataURL('image/jpeg', quality);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
