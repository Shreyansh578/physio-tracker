import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useWebSocket } from '../hooks/useWebSocket';
import { VideoFeed } from '../components/VideoFeed';
import { HUD, type AICoachFeedback } from '../components/HUD';
import { PostureCorrectionModal } from '../components/PostureCorrectionModal';
import { soundEngine } from '../utils/audioAlerts';
import { useLanguage } from '../context/LanguageContext';

export const LiveSession: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, getSpeechLocale } = useLanguage();

  const exercise = searchParams.get('exercise') || 'bicep_curl';

  // State variables
  const [repCount, setRepCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<'good' | 'warning' | 'error'>('good');
  const [exerciseState, setExerciseState] = useState<string>('');
  const [motionAngle, setMotionAngle] = useState<number>(0);
  const [romPct, setRomPct] = useState<number>(0);
  const [formScore, setFormScore] = useState<number>(1.0);
  const [checkpoints, setCheckpoints] = useState<Record<string, string>>({});
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [aiCoach, setAiCoach] = useState<AICoachFeedback | undefined>(undefined);
  const [buzzerEnabled, setBuzzerEnabled] = useState<boolean>(soundEngine.buzzerEnabled);

  // Correction Video Modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [faultArea, setFaultArea] = useState<string>('');
  const [faultDesc, setFaultDesc] = useState<string>('');
  const consecutiveFaultsRef = useRef<number>(0);
  const lastSpokenFaultTimeRef = useRef<number>(0);

  // Track previous rep count to play success chime
  const prevRepCountRef = useRef<number>(0);

  // Custom hooks
  const { videoRef, canvasRef, isActive, cameraError, startCamera, stopCamera, captureFrame } = useCamera();
  const { connect, disconnect, send, lastMessage, isConnected } = useWebSocket();

  const handleToggleBuzzer = () => {
    const nextState = !buzzerEnabled;
    setBuzzerEnabled(nextState);
    soundEngine.setBuzzerEnabled(nextState);
    if (nextState) {
      soundEngine.playBuzzer('warning');
    }
  };

  // On mount: start camera, connect websocket, activate session
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        await startCamera();
        if (mounted) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl =
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? `${protocol}//${window.location.hostname}:8000/ws/video`
              : `${protocol}//${window.location.host}/ws/video`;

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

  // Frame capture loop: 100ms = 10 FPS (paused when correction video modal is open)
  useEffect(() => {
    if (!isActive || !isConnected || !isSessionActive || showCorrectionModal) {
      return;
    }

    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        const token = localStorage.getItem('physiotrack_jwt');
        send(
          JSON.stringify({
            frame,
            exercise,
            token,
          })
        );
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isActive, isConnected, isSessionActive, showCorrectionModal, captureFrame, send, exercise]);

  // WebSocket message handler
  useEffect(() => {
    if (!lastMessage || showCorrectionModal) return;

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
      if (data.rep_count > prevRepCountRef.current) {
        soundEngine.playSuccessChime();
        soundEngine.speak(t('speech_rep_completed'), getSpeechLocale());
        prevRepCountRef.current = data.rep_count;
        // Clean rep reduces fault count
        if (consecutiveFaultsRef.current > 0) {
          consecutiveFaultsRef.current = Math.max(0, consecutiveFaultsRef.current - 1);
        }
      }
      setRepCount(data.rep_count);
    }
    if (data.state) {
      setExerciseState(data.state);
    }
    if (typeof data.angle === 'number') {
      setMotionAngle(data.angle);
    }
    if (typeof data.rom_pct === 'number') {
      setRomPct(data.rom_pct);
    }
    if (data.checkpoints && typeof data.checkpoints === 'object') {
      setCheckpoints(data.checkpoints);
    }
    if (Array.isArray(data.feedback)) {
      setFeedback(data.feedback);
    }
    if (typeof data.form_score === 'number') {
      setFormScore(data.form_score);
    }
    if (data.form_status === 'good' || data.form_status === 'warning' || data.form_status === 'error') {
      setFormStatus(data.form_status);
    }

    // AI Coach multi-sensory feedback (Buzzer + Spoken Cue + Defect Detection)
    if (data.ai_coach) {
      setAiCoach(data.ai_coach);
      const coach = data.ai_coach;

      const isDefect = coach.should_stop || coach.buzzer_type === 'danger' || data.form_status === 'error';

      if (isDefect) {
        consecutiveFaultsRef.current += 1;
        soundEngine.playBuzzer('danger');

        // Pinpoint anatomical fault area and speech instruction
        const fbStr = (data.feedback || []).join(' ').toLowerCase();
        let targetArea = t('fault_area_elbow');
        let targetDesc = t('fault_msg_elbow_drift');
        let speechMsg = t('speech_fault_elbow');

        if (fbStr.includes('swing') || fbStr.includes('torso') || fbStr.includes('back')) {
          targetArea = t('fault_area_spine');
          targetDesc = t('fault_msg_torso_swing');
          speechMsg = t('speech_fault_swing');
        } else if (fbStr.includes('valgus') || fbStr.includes('knee')) {
          targetArea = t('fault_area_knee');
          targetDesc = t('fault_msg_knee_valgus');
          speechMsg = t('speech_fault_prefix') + ' ' + t('fault_msg_knee_valgus');
        } else if (fbStr.includes('extend') || fbStr.includes('incomplete')) {
          targetArea = t('fault_area_rom');
          targetDesc = t('fault_msg_incomplete_ext');
          speechMsg = t('speech_fault_incomplete');
        }

        setFaultArea(targetArea);
        setFaultDesc(targetDesc);

        const now = Date.now();
        if (now - lastSpokenFaultTimeRef.current > 2500) {
          lastSpokenFaultTimeRef.current = now;
          soundEngine.speak(speechMsg, getSpeechLocale(), true);
        }

        // If patient accumulates 2 or more defective repetitions/movements:
        // Automatically halt the workout and present the interactive biomechanical video modal!
        if (consecutiveFaultsRef.current >= 2) {
          setShowCorrectionModal(true);
        }
      } else if (coach.buzzer_type === 'warning') {
        soundEngine.playBuzzer('warning');
      }
    }

    if (data.frame) {
      setAnnotatedFrame(data.frame);
    }
    if (data.session_id) {
      setSessionId(data.session_id);
    }
  }, [lastMessage, showCorrectionModal, t, getSpeechLocale]);

  const handleDismissCorrectionModal = () => {
    setShowCorrectionModal(false);
    consecutiveFaultsRef.current = 0;
  };

  const handleManualOpenVideoGuide = () => {
    setFaultArea(exercise === 'bicep_curl' ? t('fault_area_elbow') : t('fault_area_knee'));
    setFaultDesc(
      exercise === 'bicep_curl' ? t('fault_msg_elbow_drift') : t('fault_msg_knee_valgus')
    );
    setShowCorrectionModal(true);
  };

  const handleStopWorkout = async () => {
    setIsSessionActive(false);
    stopCamera();
    disconnect();

    let targetSessionId = sessionId;

    if (!targetSessionId) {
      try {
        const token = localStorage.getItem('physiotrack_jwt');
        const res = await fetch('/api/sessions', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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
      {/* Offscreen canvas for JPEG frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Video & HUD Container */}
      <div className="relative w-full max-w-4xl mx-auto">
        <VideoFeed
          videoRef={videoRef}
          frame={annotatedFrame}
          isConnected={isConnected}
          isActive={isActive}
          cameraError={cameraError}
        />

        {/* Realtime Telemetry HUD Overlay */}
        <HUD
          repCount={repCount}
          exercise={exercise}
          formStatus={formStatus}
          feedback={feedback}
          state={exerciseState}
          angle={motionAngle}
          romPct={romPct}
          formScore={formScore}
          checkpoints={checkpoints}
          aiCoach={aiCoach}
          buzzerEnabled={buzzerEnabled}
          onToggleBuzzer={handleToggleBuzzer}
          incorrectReps={consecutiveFaultsRef.current}
          onOpenVideoGuide={handleManualOpenVideoGuide}
        />
      </div>

      {/* Interactive Controls Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-4xl mx-auto shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
              }`}
            />
            <span className="font-medium">
              {isConnected ? 'Vision WebSocket Connected' : 'Connecting Engine...'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleBuzzer}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              buzzerEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span>{buzzerEnabled ? t('hud_buzzer_on') : t('hud_buzzer_muted')}</span>
          </button>

          <button
            type="button"
            onClick={handleManualOpenVideoGuide}
            className="px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <span>📹 {t('video_demonstration')}</span>
          </button>
        </div>

        {/* Finish Workout CTA */}
        <button
          type="button"
          onClick={handleStopWorkout}
          className="flex items-center gap-2 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/40 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{t('hud_end_workout')}</span>
        </button>
      </div>

      {/* Interactive Biomechanical Video & Posture Correction Modal */}
      <PostureCorrectionModal
        isOpen={showCorrectionModal}
        exercise={exercise}
        faultArea={faultArea}
        faultDescription={faultDesc}
        incorrectRepsCount={consecutiveFaultsRef.current}
        onDismiss={handleDismissCorrectionModal}
      />
    </div>
  );
};
