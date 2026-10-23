import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseCard } from '../components/ExerciseCard';

interface SessionItem {
  id: number;
  started_at: string;
  ended_at: string | null;
  exercise_type: string;
  total_reps: number;
  avg_form_score: number;
  feedback_log?: string[] | string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedExercise, setSelectedExercise] = useState<'bicep_curl' | 'squat' | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const handleStartWorkout = () => {
    if (selectedExercise) {
      navigate(`/session?exercise=${selectedExercise}`);
    }
  };

  const formatExerciseName = (type: string) => {
    if (type === 'bicep_curl') return 'Bicep Curls';
    if (type === 'squat') return 'Squats';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getScoreBadge = (score: number) => {
    // Score is 0.0 - 1.0 or already percentage
    const pct = score <= 1.0 ? Math.round(score * 100) : Math.round(score);

    if (pct >= 80) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
          {pct}% Excellent
        </span>
      );
    }
    if (pct >= 60) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
          {pct}% Good
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
        {pct}% Needs Work
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header Section */}
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Welcome to PhysioTrack
        </h1>
        <p className="text-base text-slate-400">
          Track your exercises with AI-powered form analysis
        </p>
      </section>

      {/* Start New Session Section */}
      <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Start New Session</h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose an exercise below to calibrate the AI computer vision tracker
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExerciseCard
            name="Bicep Curls"
            description="Track your bicep curl form and count reps"
            icon="💪"
            isSelected={selectedExercise === 'bicep_curl'}
            onSelect={() => setSelectedExercise('bicep_curl')}
          />
          <ExerciseCard
            name="Squats"
            description="Monitor your squat depth and knee alignment"
            icon="🏋️"
            isSelected={selectedExercise === 'squat'}
            onSelect={() => setSelectedExercise('squat')}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleStartWorkout}
            disabled={!selectedExercise}
            className={`px-8 py-3.5 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-2 shadow-lg ${
              selectedExercise
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 cursor-pointer scale-100 hover:scale-102'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <span>Start Workout</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </section>

      {/* Recent Sessions Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-wide">Recent Sessions</h2>
          <span className="text-xs text-slate-400">Total Workouts: {sessions.length}</span>
        </div>

        {loading ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading workout history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="text-4xl">🎯</div>
            <h3 className="text-lg font-semibold text-white">No sessions yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Ready to begin? Select an exercise above and start your first AI-guided workout today!
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Exercise</th>
                    <th className="py-4 px-6 text-center">Reps</th>
                    <th className="py-4 px-6 text-center">Form Score</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/summary/${session.id}`)}
                    >
                      <td className="py-4 px-6 whitespace-nowrap text-slate-300 font-medium">
                        {formatDate(session.started_at)}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-semibold text-white">
                          {formatExerciseName(session.exercise_type)}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-center font-bold text-white text-base">
                        {session.total_reps}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-center">
                        {getScoreBadge(session.avg_form_score)}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-right">
                        <span className="text-emerald-400 hover:text-emerald-300 font-medium text-xs">
                          View Summary &rarr;
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
