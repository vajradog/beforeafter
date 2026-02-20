/**
 * Camera access utilities for Before/After Pro.
 * Handles getUserMedia, camera switching, and photo capture.
 */

export interface CameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

const DEFAULT_OPTIONS: CameraOptions = {
  facingMode: 'environment',
  width: 1920,
  height: 1080,
};

/**
 * Request camera access and return a MediaStream.
 */
export async function startCamera(
  videoEl: HTMLVideoElement,
  options: CameraOptions = {}
): Promise<MediaStream> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: opts.facingMode,
      width: { ideal: opts.width },
      height: { ideal: opts.height },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

/**
 * Stop all tracks on a media stream.
 */
export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

/**
 * Capture a frame from a video element and return as a data URL.
 * Respects the video's natural dimensions for quality.
 */
export function captureFrame(
  videoEl: HTMLVideoElement,
  quality: number = 0.85
): string {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Load a data URL into an Image element.
 */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Check if the device has camera support.
 */
export function hasCameraSupport(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
