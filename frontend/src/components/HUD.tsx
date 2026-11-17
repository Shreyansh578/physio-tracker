import React from 'react';

export interface HUDProps {
  repCount: number;
  exercise: string;
  formStatus: 'good' | 'warning' | 'error';
  feedback: string[];
  state?: string;
  angle?: number;
  romPct?: number;
  formScore?: number;
  checkpoints?: Record<string, string>;
}

export const HUD: React.FC<HUDProps> = ({
  repCount,
  exercise,
  formStatus,
  feedback,
  state,
  angle,
  romPct = 0,
  formScore = 1.0,
  checkpoints = {},
}) => {
  const formatExerciseName = (name: string) => {
    if (!name) return 'EXERCISE';
    return name.replace(/_/g, ' ').toUpperCase();
  };

  const formatState = (s?: string) => {
    if (!s) return 'READY';
    switch (s) {
      case 'READY_DOWN':
        return '⬇️ READY TO CURL';
      case 'CURLING_UP':
        return '⚡ CURLING UP';
      case 'PEAK':
        return '🔥 PEAK CONTRACTION';
      case 'LOWERING':
        return '⬇️ LOWERING DOWN';
      case 'START':
        return '⏳ EXTEND ARM DOWN';
      case 'READY_STAND':
        return '🧍 STANDING READY';
      case 'SQUATTING_DOWN':
        return '⬇️ SQUATTING DOWN';
      case 'SQUAT_DEPTH':
        return '🔥 TARGET DEPTH';
      case 'DRIVING_UP':
        return '⬆️ DRIVING UP';
      default:
        return s.replace(/_/g, ' ').toUpperCase();
    }
  };

  const primaryFeedback = feedback && feedback.length > 0 ? feedback[0] : null;
  const secondaryFeedback = feedback && feedback.length > 1 ? feedback[1] : null;
  const scorePercent = Math.round(formScore * 100);

  const getStatusBadge = () => {
    switch (formStatus) {
      case 'good':
        return (
          <div className="flex items-center gap-2 bg-emerald-950/85 backdrop-blur-md border border-emerald-500/50 px-3.5 py-2 rounded-xl text-emerald-200 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex items-center justify-center text-[9px] text-slate-950 font-bold">
              ✓
            </span>
            <span className="text-xs font-semibold tracking-wide">
              {primaryFeedback || 'Good Posture'}
            </span>
          </div>
        );

      case 'warning':
        return (
          <div className="flex items-center gap-2 bg-amber-950/90 backdrop-blur-md border border-amber-500/60 px-3.5 py-2 rounded-xl text-amber-200 shadow-lg animate-pulse max-w-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex items-center justify-center text-[9px] text-slate-950 font-bold">
              !
            </span>
            <span className="text-xs font-semibold tracking-wide">
              {primaryFeedback || 'Form Caution'}
            </span>
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-2 bg-rose-950/90 backdrop-blur-md border border-rose-500/60 px-3.5 py-2 rounded-xl text-rose-200 shadow-lg animate-pulse max-w-sm">
            <span className="w-3 h-3 rounded-full bg-rose-500 flex items-center justify-center text-[10px] text-white font-bold animate-ping">
              ✕
            </span>
            <span className="text-xs font-semibold tracking-wide">
              {primaryFeedback || 'Form Correction Needed'}
            </span>
          </div>
        );
    }
  };

  const getCheckpointColor = (val: string) => {
    const v = val.toLowerCase();
    if (v.includes('aligned') || v.includes('stable') || v.includes('upright') || v.includes('parallel') || v.includes('good') || v.includes('peak')) {
      return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
    }
    if (v.includes('curling') || v.includes('descending') || v.includes('ascending') || v.includes('standing')) {
      return 'text-cyan-300 bg-cyan-950/60 border-cyan-500/40';
    }
    if (v.includes('waiting') || v.includes('pending')) {
      return 'text-slate-400 bg-slate-800/60 border-slate-700/40';
    }
    return 'text-rose-400 bg-rose-950/60 border-rose-500/40 animate-pulse';
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-5 flex flex-col justify-between z-10 select-none">
      {/* Top Bar */}
      <div className="flex items-start justify-between w-full gap-3">
        {/* Top-left: Exercise badge & Form score */}
        <div className="flex flex-col gap-1.5">
          <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/60 shadow-lg flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-white font-bold text-xs tracking-wider uppercase">
              {formatExerciseName(exercise)}
            </span>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-2">
            <span>Accuracy:</span>
            <span
              className={`font-bold font-mono ${
                scorePercent >= 80
                  ? 'text-emerald-400'
                  : scorePercent >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {scorePercent}%
            </span>
          </div>
        </div>

        {/* Top-right: Dynamic Form Feedback Badge */}
        <div className="flex flex-col items-end gap-1.5">
          {getStatusBadge()}
          {secondaryFeedback && (
            <div className="bg-slate-950/75 backdrop-blur-sm border border-slate-800 px-3 py-1 rounded-lg text-[11px] text-slate-300 max-w-xs text-right">
              {secondaryFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Middle-Right: Clinical Posture Checkpoints Panel */}
      {checkpoints && Object.keys(checkpoints).length > 0 && (
        <div className="self-end my-auto hidden sm:flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-800/80 shadow-xl max-w-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 px-1 flex items-center justify-between">
            <span>Posture Checkpoints</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
          {Object.entries(checkpoints).map(([key, val]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 text-xs px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800/50"
            >
              <span className="text-slate-300 text-[11px] font-medium">{key}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getCheckpointColor(
                  val
                )}`}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Center: Rep Counter, Motion Phase & ROM Progress Bar */}
      <div className="flex flex-col items-center justify-center mb-1 gap-2.5">
        {/* Range of Motion (ROM) Progress Bar */}
        <div className="w-56 sm:w-64 bg-slate-950/80 backdrop-blur-md p-2 rounded-xl border border-slate-800/80 shadow-lg flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 px-1">
            <span>Range of Motion</span>
            <span className="font-mono text-emerald-400">{romPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-100 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, romPct))}%` }}
            />
          </div>
        </div>

        {/* Phase Badge & Live Angle */}
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/60 shadow-lg flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {formatState(state)}
          </span>
          {angle !== undefined && angle > 0 && (
            <span className="text-xs font-mono font-semibold text-slate-300 border-l border-slate-700 pl-3">
              {Math.round(angle)}°
            </span>
          )}
        </div>

        {/* Main Repetition Counter */}
        <div className="bg-slate-900/90 backdrop-blur-md px-9 py-3 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col items-center min-w-36">
          <span className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
            {repCount}
          </span>
          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">
            Completed Reps
          </span>
        </div>
      </div>
    </div>
  );
};
