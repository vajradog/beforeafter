/**
 * Animated GIF export for Before/After Pro.
 * Renders the slider sweeping between before and after as a looping GIF.
 * Uses gifenc (dynamically imported) for encoding.
 */

import { loadImg } from './imageProcessing';

interface Frame {
  pct: number;  // 0 = full after, 1 = full before
  delay: number; // milliseconds
}

/**
 * Create an animated GIF of the before/after slider.
 * Returns a Blob of type image/gif.
 */
export async function createSliderGif(
  beforeDataUrl: string,
  afterDataUrl: string
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const [beforeImg, afterImg] = await Promise.all([
    loadImg(beforeDataUrl),
    loadImg(afterDataUrl),
  ]);

  // Scale down for reasonable GIF file size
  const maxW = 480;
  const srcW = Math.max(beforeImg.width, afterImg.width);
  const srcH = Math.max(beforeImg.height, afterImg.height);
  const scale = Math.min(1, maxW / srcW);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Build a global 256-color palette from both images
  ctx.drawImage(beforeImg, 0, 0, w, h);
  const beforePixels = ctx.getImageData(0, 0, w, h).data;
  ctx.drawImage(afterImg, 0, 0, w, h);
  const afterPixels = ctx.getImageData(0, 0, w, h).data;

  // Sub-sample every 4th pixel from each image to speed up quantization
  const totalPixels = w * h;
  const step = 4;
  const samplesPerImg = Math.ceil(totalPixels / step);
  const combined = new Uint8Array(samplesPerImg * 2 * 4);
  let ci = 0;
  for (let i = 0; i < totalPixels * 4; i += step * 4) {
    combined[ci++] = beforePixels[i];
    combined[ci++] = beforePixels[i + 1];
    combined[ci++] = beforePixels[i + 2];
    combined[ci++] = 255;
  }
  for (let i = 0; i < totalPixels * 4; i += step * 4) {
    combined[ci++] = afterPixels[i];
    combined[ci++] = afterPixels[i + 1];
    combined[ci++] = afterPixels[i + 2];
    combined[ci++] = 255;
  }
  const palette = quantize(combined.subarray(0, ci), 256);

  // Build animation frame sequence
  const slideCount = 14;
  const frames: Frame[] = [];

  // Hold on BEFORE
  frames.push({ pct: 1, delay: 1000 });

  // Ease to AFTER (skip endpoints — they match the hold frames)
  for (let i = 1; i < slideCount; i++) {
    const t = i / slideCount;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    frames.push({ pct: 1 - eased, delay: 80 });
  }

  // Hold on AFTER
  frames.push({ pct: 0, delay: 1000 });

  // Ease back to BEFORE
  for (let i = 1; i < slideCount; i++) {
    const t = i / slideCount;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    frames.push({ pct: eased, delay: 80 });
  }

  const gif = GIFEncoder();

  for (let f = 0; f < frames.length; f++) {
    const { pct, delay } = frames[f];
    renderSliderFrame(ctx, beforeImg, afterImg, w, h, pct);

    const rgba = new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
    const index = applyPalette(rgba, palette);

    // First frame sets the global color table; subsequent frames inherit it
    const opts: Record<string, unknown> = { delay };
    if (f === 0) opts.palette = palette;
    gif.writeFrame(index, w, h, opts);

    // Yield to the main thread every few frames so the UI stays responsive
    if (f % 5 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * Render a single slider frame onto the canvas.
 * pct: 0 = full after, 1 = full before.
 */
function renderSliderFrame(
  ctx: CanvasRenderingContext2D,
  beforeImg: HTMLImageElement,
  afterImg: HTMLImageElement,
  w: number,
  h: number,
  pct: number
) {
  const splitX = Math.round(w * pct);

  // After image (full canvas, underneath)
  ctx.drawImage(afterImg, 0, 0, w, h);

  // Before image (clipped to left portion)
  if (splitX > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, h);
    ctx.clip();
    ctx.drawImage(beforeImg, 0, 0, w, h);
    ctx.restore();
  }

  // Slider line & handle (skip when at edges)
  if (splitX > 2 && splitX < w - 2) {
    // White divider line
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(splitX - 1.5, 0, 3, h);
    ctx.restore();

    // Circular handle
    const cy = h / 2;
    const r = Math.max(12, Math.round(w * 0.04));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(splitX, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Arrow indicators inside handle
    const a = r * 0.35;
    ctx.fillStyle = '#666666';
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(splitX - a * 1.8, cy);
    ctx.lineTo(splitX - a * 0.4, cy - a);
    ctx.lineTo(splitX - a * 0.4, cy + a);
    ctx.closePath();
    ctx.fill();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(splitX + a * 1.8, cy);
    ctx.lineTo(splitX + a * 0.4, cy - a);
    ctx.lineTo(splitX + a * 0.4, cy + a);
    ctx.closePath();
    ctx.fill();
  }

  // BEFORE / AFTER labels
  const fontSize = Math.max(11, Math.round(h * 0.035));
  const pad = Math.round(fontSize * 0.5);
  ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
  const lh = fontSize + pad * 1.5;

  // BEFORE (top-left)
  const bt = 'BEFORE';
  const bw = ctx.measureText(bt).width + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(pad, pad, bw, lh, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(bt, pad + pad, pad + lh / 2);

  // AFTER (top-right)
  const at = 'AFTER';
  const aw = ctx.measureText(at).width + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(w - aw - pad, pad, aw, lh, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(at, w - aw - pad + pad, pad + lh / 2);
}
