import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export interface PostureCorrectionModalProps {
  isOpen: boolean;
  exercise: string;
  faultArea: string;
  faultDescription: string;
  incorrectRepsCount: number;
  onDismiss: () => void;
}

export const PostureCorrectionModal: React.FC<PostureCorrectionModalProps> = ({
  isOpen,
  exercise,
  faultArea,
  faultDescription,
  incorrectRepsCount,
  onDismiss,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const isBicep = exercise === 'bicep_curl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 flex flex-col gap-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Alert Banner */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-2xl shadow-lg shadow-rose-500/20">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-400 uppercase tracking-widest bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/40">
                  {t('fault_alert_title')}
                </span>
                <span className="text-xs text-slate-400">
                  ({incorrectRepsCount} Defective Reps Detected)
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                {t('video_modal_title')}
              </h3>
            </div>
          </div>
        </div>

        {/* Fault Diagnosis & Anatomical Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-slate-950/80 border border-rose-500/30 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
              🎯 {t('fault_area_label')}
            </span>
            <p className="text-sm font-bold text-white">{faultArea}</p>
            <p className="text-xs text-rose-300 mt-1">
              Biomechanical tolerance exceeded. Immediate correction required.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              ⚠️ Specific Motion Defect
            </span>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {faultDescription}
            </p>
          </div>
        </div>

        {/* Interactive Visual Kinematics Guide / Animation */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t('video_demonstration')}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Slow-Motion Kinematics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* INCORRECT POSTURE CARD */}
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-400">{t('video_incorrect_posture')}</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">❌ Fault</span>
                </div>
                {/* SVG Visual Demo */}
                <div className="h-28 bg-slate-900/80 rounded-lg flex items-center justify-center relative overflow-hidden border border-rose-500/20">
                  {isBicep ? (
                    <svg viewBox="0 0 160 120" className="w-full h-full p-2">
                      {/* Leaning torso (Wrong) */}
                      <line x1="80" y1="30" x2="65" y2="90" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      {/* Head */}
                      <circle cx="83" cy="22" r="9" fill="#f43f5e" opacity="0.6" />
                      {/* Elbow drifting forward */}
                      <line x1="77" y1="42" x2="105" y2="60" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      <line x1="105" y1="60" x2="115" y2="35" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="105" cy="60" r="5" fill="#f43f5e" className="animate-ping" />
                      <text x="10" y="112" fill="#f43f5e" fontSize="9" fontWeight="bold">Elbow drifting 25° forward</text>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 160 120" className="w-full h-full p-2">
                      {/* Knees caving in */}
                      <line x1="80" y1="30" x2="80" y2="60" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      <line x1="80" y1="60" x2="72" y2="85" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      <line x1="80" y1="60" x2="88" y2="85" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="72" cy="85" r="5" fill="#f43f5e" className="animate-ping" />
                      <circle cx="88" cy="85" r="5" fill="#f43f5e" className="animate-ping" />
                      <text x="25" y="112" fill="#f43f5e" fontSize="9" fontWeight="bold">Knee Valgus (Inward collapse)</text>
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-rose-300 mt-2 font-medium">
                {isBicep
                  ? 'Moving elbow forward uses shoulder swing and strains tendons.'
                  : 'Knees collapsing inward damages the ACL and patella.'}
              </p>
            </div>

            {/* CORRECT POSTURE CARD */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">{t('video_correct_posture')}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">✓ Ideal</span>
                </div>
                {/* SVG Visual Demo */}
                <div className="h-28 bg-slate-900/80 rounded-lg flex items-center justify-center relative overflow-hidden border border-emerald-500/20">
                  {isBicep ? (
                    <svg viewBox="0 0 160 120" className="w-full h-full p-2">
                      {/* Straight vertical torso */}
                      <line x1="80" y1="30" x2="80" y2="90" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      {/* Head */}
                      <circle cx="80" cy="20" r="9" fill="#10b981" opacity="0.6" />
                      {/* Elbow pinned straight at side */}
                      <line x1="80" y1="42" x2="82" y2="65" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <line x1="82" y1="65" x2="95" y2="40" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="82" cy="65" r="4" fill="#10b981" />
                      <text x="15" y="112" fill="#10b981" fontSize="9" fontWeight="bold">Elbow anchored strictly to ribs</text>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 160 120" className="w-full h-full p-2">
                      {/* Knees tracking outward */}
                      <line x1="80" y1="30" x2="80" y2="60" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <line x1="80" y1="60" x2="60" y2="85" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <line x1="80" y1="60" x2="100" y2="85" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="60" cy="85" r="4" fill="#10b981" />
                      <circle cx="100" cy="85" r="4" fill="#10b981" />
                      <text x="25" y="112" fill="#10b981" fontSize="9" fontWeight="bold">Knees tracking over toes (90°)</text>
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-emerald-300 mt-2 font-medium">
                {isBicep
                  ? 'Keep humerus pinned vertically. Squeeze bicep at 55° peak.'
                  : 'Push knees outward over second toe. Keep chest upright.'}
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1">
            {t('video_key_takeaways')}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>
              {isBicep
                ? '1. Stand tall, brace your core, and anchor your upper arms firmly.'
                : '1. Initiate movement by breaking at the hips, not knees.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>
              {isBicep
                ? '2. Lower slowly over 3 seconds down to full 160° extension.'
                : '2. Keep heels flat on the floor; do not allow knees to cave in.'}
            </span>
          </div>
        </div>

        {/* Dismiss / Resume CTA */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
        >
          <span>{t('video_resume_btn')}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
};
