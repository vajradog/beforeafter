/**
 * Canvas-based image processing for Before/After Pro.
 * All operations are 100% client-side.
 */

export interface SideBySideOptions {
  quality?: number;
  watermark?: string;
  beforeDate?: Date | null;
  afterDate?: Date | null;
  showDates?: boolean;
}

/**
 * Format a date for display on labels.
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Create a side-by-side comparison image from two data URLs.
 * Adds BEFORE/AFTER labels with optional date stamps and watermark.
 */
export async function createSideBySide(
  beforeDataUrl: string,
  afterDataUrl: string,
  options: SideBySideOptions = {}
): Promise<string> {
  const {
    quality = 0.9,
    watermark = '',
    beforeDate = null,
    afterDate = null,
    showDates = true,
  } = options;

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
  // Extra height for watermark strip if needed
  const watermarkH = watermark.trim() ? Math.max(36, Math.floor(h * 0.04)) : 0;
  canvas.width = w * 2 + divider;
  canvas.height = h + watermarkH;

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

  // Build label text with optional dates
  const fontSize = Math.max(24, Math.floor(h * 0.04));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  const padding = fontSize * 0.4;
  const labelH = fontSize + padding * 2;

  let beforeText = 'BEFORE';
  let afterText = 'AFTER';

  if (showDates && beforeDate) {
    beforeText += ' \u2022 ' + formatDate(beforeDate);
  }
  if (showDates && afterDate) {
    afterText += ' \u2022 ' + formatDate(afterDate);
  }

  // BEFORE label
  const beforeMetrics = ctx.measureText(beforeText);
  const beforeLabelW = beforeMetrics.width + padding * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(padding, padding, beforeLabelW, labelH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(beforeText, padding * 2, padding + fontSize);

  // AFTER label
  const afterMetrics = ctx.measureText(afterText);
  const afterLabelW = afterMetrics.width + padding * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(w + divider + padding, padding, afterLabelW, labelH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(afterText, w + divider + padding * 2, padding + fontSize);

  // Watermark strip at bottom
  if (watermark.trim()) {
    const wmFontSize = Math.max(16, Math.floor(watermarkH * 0.55));
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, h, canvas.width, watermarkH);

    ctx.font = `${wmFontSize}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(watermark.trim(), canvas.width / 2, h + watermarkH / 2);
    // Reset alignment
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

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
