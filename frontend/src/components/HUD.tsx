import React from 'react';

export interface HUDProps {
  repCount: number;
  exercise: string;
  formStatus: 'good' | 'warning' | 'error';
  feedback: string[];
}

export const HUD: React.FC<HUDProps> = ({
  repCount,
  exercise,
  formStatus,
  feedback,
}) => {
  const formatExerciseName = (name: string) => {
    if (!name) return 'EXERCISE';
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusBadge = () => {
    const primaryFeedback = feedback && feedback.length > 0 ? feedback[0] : null;

    switch (formStatus) {
      case 'good':
        return (
          <div className="flex items-center gap-2.5 bg-emerald-950/80 backdrop-blur-md border border-emerald-500/50 px-4 py-2 rounded-xl text-emerald-200 shadow-lg">
            <span className="w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center text-[10px] text-slate-950 font-bold">
              ✓
            </span>
            <span className="text-sm font-semibold tracking-wide">Good Form</span>
          </div>
        );

      case 'warning':
        return (
          <div className="flex items-center gap-2.5 bg-amber-950/80 backdrop-blur-md border border-amber-500/50 px-4 py-2 rounded-xl text-amber-200 shadow-lg animate-pulse max-w-xs">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-slate-950 font-bold">
              !
            </span>
            <span className="text-sm font-semibold tracking-wide truncate">
              {primaryFeedback || 'Form Caution'}
            </span>
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-2.5 bg-rose-950/80 backdrop-blur-md border border-rose-500/50 px-4 py-2 rounded-xl text-rose-200 shadow-lg animate-pulse max-w-xs">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center text-[10px] text-white font-bold animate-ping">
              ✕
            </span>
            <span className="text-sm font-semibold tracking-wide truncate">
              {primaryFeedback || 'Form Correction Needed'}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-5 flex flex-col justify-between z-10">
      {/* Top Bar */}
      <div className="flex items-start justify-between w-full gap-4">
        {/* Top-left: Exercise badge */}
        <div className="bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/60 shadow-lg flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-white font-bold text-sm tracking-wider uppercase">
            {formatExerciseName(exercise)}
          </span>
        </div>

        {/* Top-right: Form status indicator */}
        <div>{getStatusBadge()}</div>
      </div>

      {/* Bottom-center: Rep counter */}
      <div className="flex justify-center mb-2">
        <div className="bg-slate-900/85 backdrop-blur-md px-8 py-3.5 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col items-center min-w-36">
          <span className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
            {repCount}
          </span>
          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">
            Reps
          </span>
        </div>
      </div>
    </div>
  );
};
