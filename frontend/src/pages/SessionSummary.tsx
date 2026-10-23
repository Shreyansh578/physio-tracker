import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface SessionData {
  id: number;
  started_at: string;
  ended_at: string | null;
  exercise_type: string;
  total_reps: number;
  avg_form_score: number;
  feedback_log: string[] | string;
}

export const SessionSummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!id) {
        setError('Session ID is missing');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Session not found');
          } else {
            setError('Failed to load session details');
          }
          return;
        }

        const data: SessionData = await res.json();
        setSession(data);
      } catch (err) {
        console.error('Error fetching session:', err);
        setError('Session not found');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  const formatExercise = (type: string) => {
    if (type === 'bicep_curl') return { name: 'Bicep Curls', icon: '💪' };
    if (type === 'squat') return { name: 'Squats', icon: '🏋️' };
    return {
      name: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: '⚡',
    };
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!start || !end) return '< 1 min';
    try {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const totalSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (minutes === 0) return `${seconds}s`;
      return `${minutes}m ${seconds}s`;
    } catch {
      return '< 1 min';
    }
  };

  const parseFeedbackList = (raw: string[] | string | undefined): { message: string; count: number }[] => {
    if (!raw) return [];
    let list: string[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
        else list = [raw];
      } catch {
        list = raw ? [raw] : [];
      }
    }

    const counts: Record<string, number> = {};
    for (const item of list) {
      if (typeof item === 'string' && item.trim()) {
        const trimmed = item.trim();
        counts[trimmed] = (counts[trimmed] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-base font-medium text-slate-300">Loading session summary...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center text-2xl font-bold">
          !
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Session not found</h2>
          <p className="text-slate-400 text-sm">
            {error || "The session you are looking for doesn't exist or hasn't finished saving."}
          </p>
        </div>
        <div>
          <button
            onClick={() => navigate('/')}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { name: exerciseName, icon: exerciseIcon } = formatExercise(session.exercise_type);
  const scorePct =
    session.avg_form_score <= 1.0
      ? Math.round(session.avg_form_score * 100)
      : Math.round(session.avg_form_score);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  const feedbackSummary = parseFeedbackList(session.feedback_log);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm cursor-pointer shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-mono">Session ID #{session.id}</span>
      </div>

      {/* Session Overview Card */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-slate-800/80 pb-6 mb-6">
          <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
            <span role="img" aria-label={exerciseName}>
              {exerciseIcon}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{exerciseName}</h2>
            <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase mt-0.5">
              Completed Workout Summary
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Total Reps */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-5 text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Reps
            </span>
            <span className="text-4xl font-black text-white mt-2">
              {session.total_reps}
            </span>
          </div>

          {/* Average Form Score */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-5 text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Average Form Score
            </span>
            <span className={`text-4xl font-black mt-2 ${getScoreColor(scorePct)}`}>
              {scorePct}%
            </span>
          </div>

          {/* Duration */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-5 text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Duration
            </span>
            <span className="text-4xl font-black text-slate-200 mt-2">
              {calculateDuration(session.started_at, session.ended_at)}
            </span>
          </div>
        </div>
      </section>

      {/* Form Feedback Section */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Form Feedback Breakdown</h3>
          <p className="text-sm text-slate-400 mt-1">
            Real-time cues detected by AI computer vision during repetitions
          </p>
        </div>

        {feedbackSummary.length === 0 ? (
          <div className="bg-slate-950/40 border border-emerald-500/20 rounded-xl p-6 text-center text-emerald-400 flex items-center justify-center gap-3">
            <span className="text-2xl">🌟</span>
            <span className="font-semibold text-sm">
              Flawless session! No posture warnings or errors were triggered.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackSummary.map(({ message, count }, index) => {
              const isFocusArea = count > 5;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isFocusArea
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isFocusArea ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <span className="font-medium text-sm text-slate-100">{message}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono">
                      {count} {count === 1 ? 'occurrence' : 'occurrences'}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        isFocusArea
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {isFocusArea ? 'Focus Area' : 'Minor'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
