/**
 * Web Audio API & Speech Synthesis utility for real-time auditory buzzer and voice coaching.
 * Uses browser-native synthesis: zero external audio assets, zero latency, guaranteed reliability.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private lastBuzzerTime = 0;
  private lastSpeechTime = 0;
  private lastSpokenText = '';
  public buzzerEnabled = true;
  public voiceEnabled = true;

  constructor() {
    // Load persisted preferences if available
    try {
      this.buzzerEnabled = localStorage.getItem('physio_buzzer_enabled') !== 'false';
      this.voiceEnabled = localStorage.getItem('physio_voice_enabled') !== 'false';
    } catch {
      this.buzzerEnabled = true;
      this.voiceEnabled = true;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Play an intense dual-frequency buzzer / beep on wrong posture or defective repetition.
   */
  playBuzzer(type: 'warning' | 'danger' = 'warning'): void {
    if (!this.buzzerEnabled) return;

    const now = Date.now();
    // Rate-limit buzzer to once every 1.2 seconds to avoid sound clutter
    if (now - this.lastBuzzerTime < 1200) return;
    this.lastBuzzerTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'danger') {
        // Harsh industrial low-frequency buzzer for critical posture stop (160Hz sawtooth)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // High alert beep for form warning (580Hz square wave)
        osc.type = 'square';
        osc.frequency.setValueAtTime(580, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (err) {
      console.warn('Could not synthesize buzzer audio:', err);
    }
  }

  /**
   * Play an uplifting melodic chime when a clean repetition is completed.
   */
  playSuccessChime(): void {
    if (!this.buzzerEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Arpeggio notes: C5 (523Hz) -> E5 (659Hz)
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch {
      // AudioContext muted or blocked
    }
  }

  /**
   * Speak coaching instructions aloud using Web Speech API.
   */
  speak(text: string, force = false): void {
    if (!this.voiceEnabled && !force) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const now = Date.now();
    // Don't repeat identical voice cue within 3.5 seconds
    if (this.lastSpokenText === text && now - this.lastSpeechTime < 3500) return;
    // Don't talk over itself within 2.0 seconds unless forced
    if (!force && now - this.lastSpeechTime < 2200) return;

    this.lastSpeechTime = now;
    this.lastSpokenText = text;

    try {
      // Cancel pending utterance to deliver real-time instruction
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }

  setBuzzerEnabled(enabled: boolean): void {
    this.buzzerEnabled = enabled;
    try {
      localStorage.setItem('physio_buzzer_enabled', String(enabled));
    } catch {}
  }

  setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    try {
      localStorage.setItem('physio_voice_enabled', String(enabled));
    } catch {}
  }
}

export const soundEngine = new SoundEngine();
