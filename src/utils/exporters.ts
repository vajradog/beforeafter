/**
 * Export utilities for Before/After Pro.
 * Generates downloadable files entirely client-side.
 * Uses Web Share API on mobile to save images directly to the photo gallery.
 */

import { createSideBySide } from './imageProcessing';
import type { SideBySideOptions } from './imageProcessing';

/**
 * Convert a data URL to a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Check if the device supports sharing files via the Web Share API.
 */
function canShareFiles(): boolean {
  if (!navigator.canShare) return false;
  try {
    const testFile = new File([new Uint8Array(1)], 'test.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Share an image file via the native share sheet (saves to Photos on mobile).
 * Returns true if shared successfully, false if cancelled or unsupported.
 */
async function shareImageFile(blob: Blob, filename: string): Promise<boolean> {
  if (!canShareFiles()) return false;
  try {
    const file = new File([blob], filename, { type: blob.type });
    await navigator.share({ files: [file] });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return true;
    return false;
  }
}

/**
 * Trigger a browser download of a Blob (fallback for desktop).
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Small delay before revoking to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save an image: uses Web Share API on mobile (so it goes to Photos),
 * falls back to download on desktop.
 */
async function saveImage(blob: Blob, filename: string): Promise<void> {
  const shared = await shareImageFile(blob, filename);
  if (!shared) {
    downloadBlob(blob, filename);
  }
}

/**
 * Sanitize text for safe insertion into HTML attributes/content.
 * Prevents XSS when embedding user-provided watermark text.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Export a side-by-side JPEG comparison image.
 * Accepts optional watermark/date options.
 */
export async function exportSideBySide(
  beforeDataUrl: string,
  afterDataUrl: string,
  options?: SideBySideOptions
): Promise<void> {
  const result = await createSideBySide(beforeDataUrl, afterDataUrl, options);
  const blob = dataUrlToBlob(result);
  await saveImage(blob, 'before-after.jpg');
}

/**
 * Export a single image (before or after individually).
 */
export async function exportSingleImage(
  dataUrl: string,
  filename: string
): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  await saveImage(blob, filename);
}

/**
 * Export a self-contained HTML file with an interactive slider.
 * The HTML contains embedded base64 images and inline CSS/JS.
 * All user content is sanitized to prevent XSS.
 */
export async function exportHtmlSlider(
  beforeDataUrl: string,
  afterDataUrl: string
): Promise<void> {
  // Validate that inputs are actual data URLs (not arbitrary strings)
  if (!beforeDataUrl.startsWith('data:image/') || !afterDataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image data');
  }

  const beforeBase64 = escapeHtml(beforeDataUrl);
  const afterBase64 = escapeHtml(afterDataUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Before &amp; After Comparison</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .slider-container {
      position: relative;
      width: 100%;
      max-width: 1200px;
      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      line-height: 0;
    }
    .slider-img {
      display: block;
      width: 100%;
      height: auto;
    }
    .slider-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 100%;
      overflow: hidden;
    }
    .slider-overlay .slider-img {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      max-width: none;
    }
    .slider-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 4px;
      margin-left: -2px;
      background: #fff;
      cursor: ew-resize;
      z-index: 10;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
    }
    .slider-handle::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 44px;
      height: 44px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    }
    .slider-handle::after {
      content: '\\2194';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      color: #333;
      z-index: 1;
    }
    .label {
      position: absolute;
      top: 16px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font: bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border-radius: 6px;
      z-index: 5;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .label-before { left: 16px; }
    .label-after { right: 16px; }
    .credit {
      position: fixed;
      bottom: 8px;
      right: 12px;
      font-size: 11px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="slider-container" id="container" role="slider" aria-label="Before and after comparison" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0">
    <img class="slider-img" id="afterImg" src="${afterBase64}" alt="After" draggable="false">
    <div class="slider-overlay" id="overlay">
      <img class="slider-img" id="beforeImg" src="${beforeBase64}" alt="Before" draggable="false">
    </div>
    <div class="slider-handle" id="handle"></div>
    <div class="label label-before">Before</div>
    <div class="label label-after">After</div>
  </div>
  <div class="credit">Before/After Pro</div>
  <script>
    (function() {
      var handle = document.getElementById('handle');
      var overlay = document.getElementById('overlay');
      var container = document.getElementById('container');
      var beforeImg = document.getElementById('beforeImg');
      var afterImg = document.getElementById('afterImg');
      var isDragging = false;

      function matchSize() {
        beforeImg.style.width = afterImg.offsetWidth + 'px';
        beforeImg.style.height = afterImg.offsetHeight + 'px';
      }

      function updateSlider(clientX) {
        var rect = container.getBoundingClientRect();
        var x = clientX - rect.left;
        var pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
        handle.style.left = pct + '%';
        overlay.style.width = pct + '%';
        container.setAttribute('aria-valuenow', Math.round(pct));
      }

      afterImg.addEventListener('load', matchSize);
      window.addEventListener('resize', matchSize);
      matchSize();

      handle.addEventListener('mousedown', function(e) { isDragging = true; e.preventDefault(); });
      handle.addEventListener('touchstart', function() { isDragging = true; }, { passive: true });

      document.addEventListener('mousemove', function(e) {
        if (isDragging) updateSlider(e.clientX);
      });
      document.addEventListener('touchmove', function(e) {
        if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientX); }
      }, { passive: false });

      document.addEventListener('mouseup', function() { isDragging = false; });
      document.addEventListener('touchend', function() { isDragging = false; });

      container.addEventListener('click', function(e) { updateSlider(e.clientX); });

      container.addEventListener('keydown', function(e) {
        var currentPct = parseFloat(handle.style.left) || 50;
        var step = 2;
        if (e.key === 'ArrowLeft') { currentPct = Math.max(0, currentPct - step); }
        else if (e.key === 'ArrowRight') { currentPct = Math.min(100, currentPct + step); }
        else { return; }
        e.preventDefault();
        handle.style.left = currentPct + '%';
        overlay.style.width = currentPct + '%';
        container.setAttribute('aria-valuenow', Math.round(currentPct));
      });
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, 'before-after-slider.html');
}

// ---- Cleanup tracking for slider event listeners ----
// Stores cleanup functions so we can remove document-level listeners
// when re-initializing sliders (prevents memory leaks).
let inlineSliderCleanup: (() => void) | null = null;
let fullscreenSliderCleanup: (() => void) | null = null;

/**
 * Initialize the inline interactive slider on the export screen.
 * Cleans up previous listeners before re-initializing.
 */
export function initInlineSlider(container: HTMLElement, beforeSrc: string, afterSrc: string): void {
  // Clean up previous instance to prevent memory leaks
  if (inlineSliderCleanup) {
    inlineSliderCleanup();
    inlineSliderCleanup = null;
  }

  const afterImg = container.querySelector<HTMLImageElement>('.slider-after-img')!;
  const beforeImg = container.querySelector<HTMLImageElement>('.slider-before-img')!;
  const overlay = container.querySelector<HTMLElement>('.slider-overlay')!;
  const handle = container.querySelector<HTMLElement>('.slider-handle')!;

  afterImg.src = afterSrc;
  beforeImg.src = beforeSrc;

  let isDragging = false;

  // Allow vertical scrolling on the container, only capture horizontal drag on handle
  container.style.touchAction = 'pan-y';
  handle.style.touchAction = 'none';

  function matchSize() {
    if (!afterImg.naturalWidth || !afterImg.naturalHeight) return;

    container.style.width = '';
    const containerW = container.parentElement?.offsetWidth || container.offsetWidth;
    const maxH = window.innerHeight * 0.55;
    const aspect = afterImg.naturalWidth / afterImg.naturalHeight;

    let w = containerW;
    let h = w / aspect;

    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }

    afterImg.style.width = w + 'px';
    afterImg.style.height = h + 'px';
    beforeImg.style.width = w + 'px';
    beforeImg.style.height = h + 'px';
    overlay.style.height = h + 'px';
    container.style.height = h + 'px';
    container.style.width = w + 'px';
  }

  function updateSlider(clientX: number) {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    handle.style.left = pct + '%';
    overlay.style.width = pct + '%';
  }

  // Named handlers for proper cleanup
  const onLoad = () => matchSize();
  const onResize = () => matchSize();
  const onOrientationChange = () => setTimeout(matchSize, 150);
  const onMouseDown = (e: MouseEvent) => { isDragging = true; e.preventDefault(); };
  const onTouchStart = () => { isDragging = true; };
  const onMouseMove = (e: MouseEvent) => { if (isDragging) updateSlider(e.clientX); };
  const onTouchMove = (e: TouchEvent) => {
    if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientX); }
  };
  const onMouseUp = () => { isDragging = false; };
  const onTouchEnd = () => { isDragging = false; };
  const onClick = (e: MouseEvent) => { updateSlider(e.clientX); };

  afterImg.addEventListener('load', onLoad);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientationChange);

  handle.addEventListener('mousedown', onMouseDown);
  handle.addEventListener('touchstart', onTouchStart, { passive: true });

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchend', onTouchEnd);

  container.addEventListener('click', onClick);

  matchSize();

  // Store cleanup function to prevent memory leaks on re-init
  inlineSliderCleanup = () => {
    afterImg.removeEventListener('load', onLoad);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    handle.removeEventListener('mousedown', onMouseDown);
    handle.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('click', onClick);
    isDragging = false;
  };
}

/**
 * Clean up inline slider listeners. Called on "Start Over".
 */
export function destroyInlineSlider(): void {
  if (inlineSliderCleanup) {
    inlineSliderCleanup();
    inlineSliderCleanup = null;
  }
}

/**
 * Initialize the fullscreen slider overlay.
 * Cleans up previous listeners before re-initializing.
 */
export function initFullscreenSlider(
  container: HTMLElement,
  beforeSrc: string,
  afterSrc: string,
  onClose: () => void
): void {
  // Clean up previous instance to prevent memory leaks
  if (fullscreenSliderCleanup) {
    fullscreenSliderCleanup();
    fullscreenSliderCleanup = null;
  }

  const afterImg = container.querySelector<HTMLImageElement>('.fs-after-img')!;
  const beforeImg = container.querySelector<HTMLImageElement>('.fs-before-img')!;
  const overlay = container.querySelector<HTMLElement>('.fs-overlay')!;
  const handle = container.querySelector<HTMLElement>('.fs-handle')!;
  const labelBefore = container.querySelector<HTMLElement>('.fs-label-before')!;
  const labelAfter = container.querySelector<HTMLElement>('.fs-label-after')!;

  afterImg.src = afterSrc;
  beforeImg.src = beforeSrc;

  let isDragging = false;

  function matchSize() {
    if (!afterImg.naturalWidth || !afterImg.naturalHeight) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = afterImg.naturalWidth / afterImg.naturalHeight;

    let w = vw;
    let h = w / aspect;
    if (h > vh) {
      h = vh;
      w = h * aspect;
    }

    const left = (vw - w) / 2;
    const top = (vh - h) / 2;

    const wrapper = container.querySelector<HTMLElement>('.fs-wrapper')!;
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    wrapper.style.left = left + 'px';
    wrapper.style.top = top + 'px';

    afterImg.style.width = w + 'px';
    afterImg.style.height = h + 'px';
    beforeImg.style.width = w + 'px';
    beforeImg.style.height = h + 'px';
    overlay.style.height = h + 'px';
  }

  function updateSlider(clientX: number) {
    const wrapper = container.querySelector<HTMLElement>('.fs-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    handle.style.left = pct + '%';
    overlay.style.width = pct + '%';
  }

  let labelTimer: ReturnType<typeof setTimeout>;
  function showLabels() {
    labelBefore.style.opacity = '1';
    labelAfter.style.opacity = '1';
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => {
      labelBefore.style.opacity = '0';
      labelAfter.style.opacity = '0';
    }, 2000);
  }
  showLabels();

  // Named handlers for proper cleanup
  const onLoad = () => matchSize();
  const onResize = () => matchSize();
  const onOrientationChange = () => setTimeout(matchSize, 150);
  const onHandleMouseDown = (e: MouseEvent) => { isDragging = true; e.preventDefault(); };
  const onHandleTouchStart = () => { isDragging = true; };
  const onMove = (e: MouseEvent) => { if (isDragging) updateSlider(e.clientX); };
  const onDocTouchMove = (e: TouchEvent) => {
    if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientX); }
  };
  const onUp = () => { isDragging = false; };
  const onTouchEndDoc = () => { isDragging = false; };

  function cleanup() {
    afterImg.removeEventListener('load', onLoad);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    handle.removeEventListener('mousedown', onHandleMouseDown);
    handle.removeEventListener('touchstart', onHandleTouchStart);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onDocTouchMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchend', onTouchEndDoc);
    if (closeBtn) closeBtn.removeEventListener('click', onCloseClick);
    container.removeEventListener('click', onContainerClick);
    wrapper.removeEventListener('click', onWrapperClick);
    clearTimeout(labelTimer);
    isDragging = false;
    fullscreenSliderCleanup = null;
    onClose();
  }

  afterImg.addEventListener('load', onLoad);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientationChange);
  matchSize();

  handle.addEventListener('mousedown', onHandleMouseDown);
  handle.addEventListener('touchstart', onHandleTouchStart, { passive: true });

  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onDocTouchMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onTouchEndDoc);

  // Close button
  const closeBtn = container.querySelector<HTMLElement>('.fs-close-btn');
  const onCloseClick = (e: MouseEvent) => { e.stopPropagation(); cleanup(); };
  if (closeBtn) closeBtn.addEventListener('click', onCloseClick);

  // Tap black bars to close
  const onContainerClick = (e: MouseEvent) => {
    if (e.target === container) cleanup();
  };
  container.addEventListener('click', onContainerClick);

  // Click inside wrapper moves slider
  const wrapper = container.querySelector<HTMLElement>('.fs-wrapper')!;
  const onWrapperClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.fs-handle')) return;
    updateSlider(e.clientX);
    showLabels();
  };
  wrapper.addEventListener('click', onWrapperClick);

  // Store cleanup for external use
  fullscreenSliderCleanup = cleanup;
}

/**
 * Clean up fullscreen slider listeners.
 */
export function destroyFullscreenSlider(): void {
  if (fullscreenSliderCleanup) {
    fullscreenSliderCleanup();
    fullscreenSliderCleanup = null;
  }
}
