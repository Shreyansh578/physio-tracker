import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ExerciseDetail {
  id: string;
  name: string;
  category: string;
  targetJoints: string;
  minAngle: string;
  maxAngle: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  checkpoints: string[];
  commonFaults: string[];
}

export const ExerciseLibrary: React.FC = () => {
  const navigate = useNavigate();

  const exercises: ExerciseDetail[] = [
    {
      id: 'bicep_curl',
      name: 'Bicep Curl (Standing / Seated)',
      category: 'Upper Extremity / Elbow Joint',
      targetJoints: 'Biceps Brachii, Brachialis, Brachioradialis',
      minAngle: '50° – 65° (Peak Flexion)',
      maxAngle: '160° – 175° (Full Extension)',
      difficulty: 'Beginner',
      description:
        'Standard elbow flexion exercise designed to isolate the biceps while maintaining strict humeral-torso stabilization.',
      checkpoints: [
        'Elbows anchored adjacent to mid-axillary line',
        'Torso sway deviation strictly under 15°',
        'Controlled 3-second eccentric release',
      ],
      commonFaults: [
        'Anterior elbow drift (deltoid compensation)',
        'Lumbar hyperextension swing momentum',
        'Incomplete bottom extension (< 150°)',
      ],
    },
    {
      id: 'squat',
      name: 'Bodyweight / Goblet Squat',
      category: 'Lower Kinetic Chain / Knee & Hip',
      targetJoints: 'Quadriceps, Gluteus Maximus, Hamstrings, Core',
      minAngle: '80° – 95° (Parallel Depth)',
      maxAngle: '170° – 180° (Standing Lockout)',
      difficulty: 'Intermediate',
      description:
        'Compound closed-chain kinetic movement strengthening knee extensors and hip musculature with vertical torso control.',
      checkpoints: [
        'Knees track parallel with second/third toe',
        'Torso upright angle maintained above 45°',
        'Femur reaches parallel horizontal plane',
      ],
      commonFaults: [
        'Knee valgus collapse (inward caving)',
        'Heels lifting off the ground (excessive ankle stiffness)',
        'Lumbar rounding (butt wink)',
      ],
    },
    {
      id: 'shoulder_abduction',
      name: 'Lateral Arm Abduction',
      category: 'Shoulder Complex / Glenohumeral',
      targetJoints: 'Middle Deltoid, Supraspinatus, Trapezius',
      minAngle: '0° – 15° (Rest at Hip)',
      maxAngle: '85° – 90° (Parallel to Ground)',
      difficulty: 'Beginner',
      description:
        'Therapeutic movement for shoulder stability and supraspinatus activation without subacromial impingement.',
      checkpoints: [
        'Arms raised in scapular plane (30° forward)',
        'Shoulder blades depressed and retracted',
        'Wrists maintain neutral alignment with forearm',
      ],
      commonFaults: [
        'Raising arms above 90° into impingement zone',
        'Shrugging shoulders upward using upper traps',
        'Excessive torso backward tilt',
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Rehabilitation Exercise Encyclopedia
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Clinical kinematic specifications, target angle envelopes, and compensatory fault analysis
          </p>
        </div>
        <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 font-medium">
          3 Exercises Calibrated
        </div>
      </div>

      {/* Grid of Exercises */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {ex.difficulty}
                </span>
                <span className="text-xs text-slate-400">{ex.category}</span>
              </div>

              <h3 className="text-base font-bold text-white mb-2">{ex.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{ex.description}</p>

              {/* Kinematic Angles Box */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Peak Angle:</span>
                  <span className="font-mono text-emerald-400 font-bold">{ex.minAngle}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Rest Angle:</span>
                  <span className="font-mono text-blue-400 font-bold">{ex.maxAngle}</span>
                </div>
              </div>

              {/* Clinical Checkpoints */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  ✅ Clinical Checkpoints:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {ex.checkpoints.map((cp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{cp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common Faults */}
              <div className="mb-6">
                <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-2">
                  ⚠️ Common Defective Motions:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {ex.commonFaults.map((cf, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span>{cf}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => navigate(`/session?exercise=${ex.id}`)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Start Workout with AI Vision</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
