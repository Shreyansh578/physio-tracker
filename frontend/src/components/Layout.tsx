import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Exercise Dashboard';
    if (location.pathname.startsWith('/session')) return 'Live Workout Session';
    if (location.pathname.startsWith('/summary')) return 'Session Summary';
    return 'PhysioTrack';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800 flex flex-col z-20">
        {/* App Logo & Title */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
          <span className="text-2xl" role="img" aria-label="dumbbell">🏋️</span>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white">PhysioTrack</span>
            <span className="text-xs text-emerald-400 font-medium">AI Form Assistant</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/session"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Start Workout</span>
          </NavLink>
        </nav>

        {/* System Info footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Vision Engine Active</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 ml-64 min-h-screen flex flex-col bg-slate-950">
        {/* Top Header Bar */}
        <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-white tracking-wide">
            {getPageTitle()}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              WebCam • 10 FPS Realtime
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
