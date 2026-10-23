import React from 'react';

export interface VideoFeedProps {
  frame: string | null;
  isConnected: boolean;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({ frame, isConnected }) => {
  const imageSrc = frame
    ? frame.startsWith('data:')
      ? frame
      : `data:image/jpeg;base64,${frame}`
    : null;

  return (
    <div className="relative w-full aspect-4/3 md:aspect-16/9 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Live Pose Tracking Feed"
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-slate-400"
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
          <p className="text-base font-medium text-slate-300">Camera feed will appear here</p>
          <p className="text-xs text-slate-400 mt-1">
            Ensure your webcam is enabled and you are visible in frame
          </p>
        </div>
      )}

      {/* Disconnected / Connecting Overlay */}
      {!isConnected && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-white font-semibold text-lg tracking-wide">Connecting...</p>
          <p className="text-slate-400 text-xs mt-1">Establishing real-time session link</p>
        </div>
      )}
    </div>
  );
};
