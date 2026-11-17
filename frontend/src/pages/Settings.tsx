import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { soundEngine } from '../utils/audioAlerts';

export const Settings: React.FC = () => {
  const { user } = useAuth();

  const [buzzerActive, setBuzzerActive] = useState<boolean>(soundEngine.buzzerEnabled);
  const [voiceActive, setVoiceActive] = useState<boolean>(soundEngine.voiceEnabled);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const toggleBuzzer = (checked: boolean) => {
    setBuzzerActive(checked);
    soundEngine.setBuzzerEnabled(checked);
  };

  const toggleVoice = (checked: boolean) => {
    setVoiceActive(checked);
    soundEngine.setVoiceEnabled(checked);
  };

  const handleTestWarningBeep = () => {
    soundEngine.playBuzzer('warning');
    setTestStatus('Sounding: 440-580Hz Form Warning Beep');
    setTimeout(() => setTestStatus(null), 1500);
  };

  const handleTestDangerBuzzer = () => {
    soundEngine.playBuzzer('danger');
    soundEngine.speak('Stop! Critical form deviation detected.');
    setTestStatus('Sounding: 180Hz Critical Stop Buzzer + Speech Voice');
    setTimeout(() => setTestStatus(null), 2500);
  };

  const handleTestSuccessChime = () => {
    soundEngine.playSuccessChime();
    setTestStatus('Sounding: Melodic Repetition Complete Chime');
    setTimeout(() => setTestStatus(null), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            System Settings & Audio Calibrations
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure real-time auditory buzzer alarms, voice coaching frequency, and device controls
          </p>
        </div>
      </div>

      {/* Audio Calibrations & Buzzer Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl">
            🔊
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Multi-Sensory Auditory Warning Alarms
            </h3>
            <p className="text-xs text-slate-400">
              Web Audio API hardware-level synthesizer for defective posture feedback
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <p className="text-xs font-semibold text-white">Defective Form Buzzer</p>
              <p className="text-[11px] text-slate-400">
                Sounds harsh buzzer when patient exhibits torso swing, elbow flaring, or knee collapse
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={buzzerActive}
                onChange={(e) => toggleBuzzer(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <p className="text-xs font-semibold text-white">AI Spoken Voice Coaching</p>
              <p className="text-[11px] text-slate-400">
                Speaks immediate verbal cues ("Stop! You are swinging your lower back", "Lock elbows")
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={voiceActive}
                onChange={(e) => toggleVoice(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* Live Audio Test Suite */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            🧪 Examiner & Teacher Sound Test Suite:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleTestWarningBeep}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-amber-400 border border-amber-500/30 text-xs font-medium transition-all active:scale-[0.98]"
            >
              ⚠️ Test Form Warning Beep
            </button>
            <button
              type="button"
              onClick={handleTestDangerBuzzer}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-rose-400 border border-rose-500/30 text-xs font-medium transition-all active:scale-[0.98]"
            >
              🚨 Test Critical Stop Buzzer
            </button>
            <button
              type="button"
              onClick={handleTestSuccessChime}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all active:scale-[0.98]"
            >
              ✨ Test Clean Rep Chime
            </button>
          </div>
          {testStatus && (
            <p className="mt-3 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-center animate-fade-in">
              {testStatus}
            </p>
          )}
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h3 className="text-sm font-bold text-white mb-4">Patient Profile Information</h3>
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-14 h-14 rounded-2xl border border-emerald-500/30 object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'P'}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">{user?.name || 'Guest Patient'}</p>
            <p className="text-xs text-slate-400">{user?.email || 'N/A'}</p>
            <span className="mt-1 inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Authenticated Patient ID: {user?.id || 'Local'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
