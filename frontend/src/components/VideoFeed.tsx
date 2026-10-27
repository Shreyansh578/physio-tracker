import React from 'react';

export interface VideoFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  frame: string | null;
  isConnected: boolean;
  isActive: boolean;
  cameraError: string | null;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  videoRef,
  frame,
  isConnected,
  isActive,
  cameraError,
}) => {
  const imageSrc = frame
    ? frame.startsWith('data:')
      ? frame
      : `data:image/jpeg;base64,${frame}`
    : null;

  return (
    <div className="relative w-full aspect-4/3 md:aspect-16/9 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
      {/* Live Webcam Video Element - always mounted and rendering to keep frames flowing */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-contain ${isActive ? 'block' : 'hidden'}`}
      />

      {/* Annotated Frame from Backend (Pose Skeleton Overlay) */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt="Live Pose Tracking Feed"
          className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
        />
      )}

      {/* Camera Inactive Placeholder */}
      {!isActive && !cameraError && (
        <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center z-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-slate-400 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-200">Initializing camera...</p>
          <p className="text-xs text-slate-400 mt-1">
            Please allow camera permissions if prompted
          </p>
        </div>
      )}

      {/* Camera Error Banner */}
      {cameraError && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-rose-300 p-8 text-center z-30">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-rose-400">⚠️</span>
          </div>
          <p className="text-base font-semibold text-rose-200">{cameraError}</p>
          <p className="text-xs text-slate-400 mt-2">
            Click the camera icon in your browser address bar to allow permissions, then reload.
          </p>
        </div>
      )}

      {/* WebSocket Connecting / Reconnecting Indicator */}
      {!isConnected && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
          <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Connecting to AI backend...</span>
        </div>
      )}
    </div>
  );
};
