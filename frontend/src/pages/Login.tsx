import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { loginAsDemo, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Redirect destination after login
  const from = (location.state as any)?.from?.pathname || '/';

  const handleDemoLogin = async () => {
    try {
      setError(null);
      setSubmitting(true);
      await loginAsDemo('Alex Mercer (Rehab Patient)', 'alex.rehab@gmail.com');
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify the backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExaminerLogin = async () => {
    try {
      setError(null);
      setSubmitting(true);
      await loginAsDemo('Professor / Examiner', 'evaluator.physio@university.edu');
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify the backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-4 shadow-lg shadow-emerald-500/10">
            <span className="text-3xl" role="img" aria-label="dumbbell">🏋️</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Welcome to PhysioTrack
          </h1>
          <p className="text-sm text-slate-400">
            AI-driven biomechanical rehabilitation & repetition analysis
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* OAuth Buttons Section */}
        <div className="space-y-3">
          {/* Main Google Sign-In Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={submitting || isLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Official Google 'G' icon */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Quick Examiner Evaluation Login */}
          <button
            type="button"
            onClick={handleExaminerLogin}
            disabled={submitting || isLoading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-emerald-400 font-medium text-sm border border-slate-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span>🎓 Quick Evaluation / Examiner Mode</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Passwordless One-Click Google OAuth & JWT Tokens</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>5-Stage Biomechanical State Machine Rep Counter</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>Personal Session History & Muscle Fatigue Telemetry</span>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center">
          <span className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400/80" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
            </svg>
            Secured with HS256 JWT & SQLite ACID storage
          </span>
        </div>
      </div>
    </div>
  );
};
