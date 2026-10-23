import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useWebSocket } from '../hooks/useWebSocket';
import { VideoFeed } from '../components/VideoFeed';
import { HUD } from '../components/HUD';

export const LiveSession: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const exercise = searchParams.get('exercise') || 'bicep_curl';

  // State variables
  const [repCount, setRepCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<'good' | 'warning' | 'error'>('good');
  const [, setExerciseState] = useState<string>('');
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Custom hooks
  const { videoRef, canvasRef, isActive, startCamera, stopCamera, captureFrame } = useCamera();
  const { connect, disconnect, send, lastMessage, isConnected } = useWebSocket();

  // On mount: start camera, connect websocket, activate session
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        await startCamera();
        if (mounted) {
          const wsUrl =
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'ws://localhost:8000/ws/video'
              : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/video`;

          connect(wsUrl);
          setIsSessionActive(true);
        }
      } catch (err) {
        console.error('Failed to initialize live workout session:', err);
      }
    };

    initSession();

    return () => {
      mounted = false;
      stopCamera();
      disconnect();
    };
  }, [startCamera, stopCamera, connect, disconnect]);

  // Frame capture loop: 100ms = 10 FPS
  useEffect(() => {
    if (!isActive || !isConnected || !isSessionActive) {
      return;
    }

    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        send(
          JSON.stringify({
            frame,
            exercise,
          })
        );
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isActive, isConnected, isSessionActive, captureFrame, send, exercise]);

  // WebSocket message handler
  useEffect(() => {
    if (!lastMessage) return;

    const data =
      typeof lastMessage === 'string'
        ? (() => {
            try {
              return JSON.parse(lastMessage);
            } catch {
              return null;
            }
          })()
        : lastMessage;

    if (!data) return;

    if (typeof data.rep_count === 'number') {
      setRepCount(data.rep_count);
    }
    if (data.state) {
      setExerciseState(data.state);
    }
    if (Array.isArray(data.feedback)) {
      setFeedback(data.feedback);
    }
    if (typeof data.form_score === 'number') {
      const score = data.form_score;
      if (score >= 0.8) {
        setFormStatus('good');
      } else if (score >= 0.5) {
        setFormStatus('warning');
      } else {
        setFormStatus('error');
      }
    }
    if (data.frame) {
      setAnnotatedFrame(data.frame);
    }
    if (data.session_id) {
      setSessionId(data.session_id);
    }
  }, [lastMessage]);

  const handleStopWorkout = async () => {
    setIsSessionActive(false);
    stopCamera();
    disconnect();

    let targetSessionId = sessionId;

    // If session ID was not sent in WS messages, retrieve newest session from API
    if (!targetSessionId) {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          const sessions = await res.json();
          if (Array.isArray(sessions) && sessions.length > 0) {
            targetSessionId = sessions[0].id;
          }
        }
      } catch (err) {
        console.error('Error fetching latest session for summary:', err);
      }
    }

    if (targetSessionId) {
      navigate(`/summary/${targetSessionId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hidden elements for capturing video feed */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Video & HUD Container */}
      <div className="relative w-full max-w-4xl mx-auto">
        <VideoFeed frame={annotatedFrame} isConnected={isConnected} />
        <HUD
          repCount={repCount}
          exercise={exercise}
          formStatus={formStatus}
          feedback={feedback}
        />
      </div>

      {/* Control Actions */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleStopWorkout}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-8 py-3.5 rounded-lg shadow-xl shadow-rose-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
              clipRule="evenodd"
            />
          </svg>
          <span>Stop Workout</span>
        </button>
      </div>
    </div>
  );
};
