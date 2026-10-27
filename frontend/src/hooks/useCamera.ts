import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  cameraError: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
}

export function useCamera(): UseCameraReturn {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch {
        // Fallback to basic video constraint if ideal constraints fail
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Video play warning:', e));
        };
        try {
          await videoRef.current.play();
        } catch {
          // Play might be handled by autoPlay
        }
      }
      setIsActive(true);
    } catch (err: any) {
      console.error('Failed to access camera:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera permissions in your browser address bar.'
        : err?.name === 'NotFoundError'
        ? 'No camera found. Please connect a webcam.'
        : 'Failed to access camera: ' + (err?.message || 'Unknown error');
      setCameraError(msg);
      setIsActive(false);
      throw err;
    }
  }, [stopCamera]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return null;
    }

    if (video.readyState < 2 || video.videoWidth === 0) {
      if (video.paused && video.srcObject) {
        video.play().catch(() => {});
      }
      return null;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Get JPEG at 0.6 quality and strip data URI scheme
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex !== -1) {
      return dataUrl.slice(commaIndex + 1);
    }
    return dataUrl;
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isActive,
    cameraError,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
