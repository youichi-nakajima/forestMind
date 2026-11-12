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
 * Major pentatonic scale intervals in semitones:
 * 0 (Root/Do), 2 (Re), 4 (Mi), 7 (Sol), 9 (La)
 * Provides a harmonious, natural ascension without dissonant clashes.
 */
export const PENTATONIC_SCALE = [0, 2, 4, 7, 9] as const;

/**
 * Calculates a musical pitch multiplier based on tree depth using the pentatonic scale.
 * As nodes get deeper (trunk -> branches -> leaves), the sound ascends harmonically.
 */
export function getDepthPitchMultiplier(depth: number): number {
  const clampedDepth = Math.max(0, depth);
  // Cap at depth 10 (~2 octaves) so high frequencies remain sweet and gentle
  const effectiveDepth = Math.min(clampedDepth, 10);
  const octave = Math.floor(effectiveDepth / PENTATONIC_SCALE.length);
  const noteIndex = effectiveDepth % PENTATONIC_SCALE.length;
  const semitones = octave * 12 + PENTATONIC_SCALE[noteIndex];
  return Math.pow(2, semitones / 12);
}

/**
 * Plays a cute, organic "bubble popping" sound (シャボン玉がパチンと割れる音).
 * Uses a sine wave with rapid upward pitch glide and exponential amplitude decay.
 * Deeper nodes produce higher, crisper, and lighter bubble pops.
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
    const baseVolume = Math.min(Math.max(options.volume ?? 0.28, 0), 1);

    // Harmonic pitch ascension based on depth
    const depthMultiplier = getDepthPitchMultiplier(depth);

    // Subtle natural organic jitter (±2%) so it feels organic while preserving distinct pitch intervals
    const randomJitter = 0.98 + Math.random() * 0.04;
    const pitchShift = (options.pitchShift ?? 1.0) * depthMultiplier * randomJitter;

    // High notes naturally sound louder to human ears, so gently balance volume for deeper nodes
    const depthVolumeComp = Math.max(0.72, 1 - Math.min(depth, 8) * 0.035);
    const volume = baseVolume * depthVolumeComp;

    // Create oscillator & gain
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Bubble pop acoustics:
    // Base frequency starts warm (~350Hz) and sweeps upward to peak (~720Hz)
    // Deeper nodes are shorter and snappier (80ms down to ~48ms) simulating smaller bubbles
    const startFreq = 350 * pitchShift;
    const peakFreq = 720 * pitchShift;
    const duration = Math.max(0.048, 0.08 - Math.min(depth, 8) * 0.004);
    const attackDuration = 0.005;
    const sweepDuration = Math.min(0.025, duration * 0.35);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + sweepDuration);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.15, now + duration);

    // Quick attack, smooth exponential decay
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + attackDuration);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // High-pass filter: deeper nodes get a slightly higher cutoff to stay crisp and sparkling
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    const filterFreq = Math.min(260 + Math.min(depth, 8) * 40, 600);
    filter.frequency.setValueAtTime(filterFreq, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Ignore audio errors on unsupported environments
  }
}
