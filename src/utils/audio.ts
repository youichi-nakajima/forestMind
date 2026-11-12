/**
 * Web Audio API based Sound Synthesizer for forestMind
 * Synthesizes cute bubble pop sounds without external audio assets.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export interface BubblePopOptions {
  depth?: number;
  pitchShift?: number; // multiplier, e.g. 0.9 ~ 1.2
  volume?: number;     // 0.0 ~ 1.0
}

/**
 * Plays a cute, organic "bubble popping" sound (シャボン玉がパチンと割れる音).
 * Uses a sine wave with rapid upward pitch glide and exponential amplitude decay.
 */
export function playBubblePopSound(options: BubblePopOptions = {}) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const depth = options.depth ?? 0;
    const volume = Math.min(Math.max(options.volume ?? 0.28, 0), 1);

    // Subtle pitch variation based on depth and slight randomness so it doesn't sound robotic
    const randomJitter = 0.94 + Math.random() * 0.12;
    const depthMultiplier = Math.pow(1.08, Math.min(depth, 5));
    const pitchShift = (options.pitchShift ?? 1.0) * depthMultiplier * randomJitter;

    // Create oscillator & gain
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Bubble pop acoustics:
    // Starts at a resonant mid-frequency (e.g. 420Hz) and sweeps rapidly upwards to ~850Hz in ~25ms
    // followed by an instant decay, simulating a small bubble cavity popping open.
    const startFreq = 420 * pitchShift;
    const peakFreq = 860 * pitchShift;
    const duration = 0.08; // 80ms total

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.025);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.2, now + duration);

    // Quick attack, smooth exponential decay
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Optional subtle high-pass to remove low thump and keep it crisp & cute
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Ignore audio errors on unsupported environments
  }
}
