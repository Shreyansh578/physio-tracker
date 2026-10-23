import React from 'react';

export interface ExerciseCardProps {
  name: string;
  description: string;
  icon: string;
  isSelected: boolean;
  onSelect: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  name,
  description,
  icon,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer rounded-xl p-6 border transition-all duration-200 select-none ${
        isSelected
          ? 'border-emerald-500 bg-slate-900/90 shadow-xl shadow-emerald-500/10 scale-102 ring-2 ring-emerald-500/50'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80 hover:-translate-y-1 hover:shadow-lg'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-3xl mb-4">
          <span role="img" aria-label={name}>
            {icon}
          </span>
        </div>
        {isSelected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-white tracking-wide">{name}</h3>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">{description}</p>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span>Real-time Form Feedback</span>
        <span className={isSelected ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
          {isSelected ? 'Selected' : 'Click to select'}
        </span>
      </div>
    </div>
  );
};
