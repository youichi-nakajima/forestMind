import { describe, it, expect } from 'vitest';
import { getDepthPitchMultiplier, playBubblePopSound } from '../audio';

describe('audio: getDepthPitchMultiplier', () => {
  it('returns 1.0 at depth 0 (root node)', () => {
    expect(getDepthPitchMultiplier(0)).toBeCloseTo(1.0, 5);
  });

  it('ascends monotonically with increasing depth', () => {
    let prevMultiplier = getDepthPitchMultiplier(0);
    for (let depth = 1; depth <= 8; depth++) {
      const currentMultiplier = getDepthPitchMultiplier(depth);
      expect(currentMultiplier).toBeGreaterThan(prevMultiplier);
      prevMultiplier = currentMultiplier;
    }
  });

  it('correctly maps to pentatonic scale steps', () => {
    // Degree 0 (depth 0): 0 semitones -> 2^(0/12) = 1.0
    expect(getDepthPitchMultiplier(0)).toBeCloseTo(1.0, 4);

    // Degree 1 (depth 1): 2 semitones -> 2^(2/12) ~ 1.12246
    expect(getDepthPitchMultiplier(1)).toBeCloseTo(Math.pow(2, 2 / 12), 4);

    // Degree 2 (depth 2): 4 semitones -> 2^(4/12) ~ 1.25992
    expect(getDepthPitchMultiplier(2)).toBeCloseTo(Math.pow(2, 4 / 12), 4);

    // Degree 3 (depth 3): 7 semitones -> 2^(7/12) ~ 1.49830
    expect(getDepthPitchMultiplier(3)).toBeCloseTo(Math.pow(2, 7 / 12), 4);

    // Degree 4 (depth 4): 9 semitones -> 2^(9/12) ~ 1.68179
    expect(getDepthPitchMultiplier(4)).toBeCloseTo(Math.pow(2, 9 / 12), 4);

    // Degree 5 (depth 5): 1 octave higher (12 semitones) -> 2.0
    expect(getDepthPitchMultiplier(5)).toBeCloseTo(2.0, 4);
  });

  it('handles negative or out-of-range depths safely', () => {
    expect(getDepthPitchMultiplier(-1)).toBeCloseTo(1.0, 4);
    // Depth capped at 10
    const depth10 = getDepthPitchMultiplier(10);
    const depth20 = getDepthPitchMultiplier(20);
    expect(depth20).toBeCloseTo(depth10, 4);
  });

  it('playBubblePopSound runs safely without throwing even without AudioContext in test env', () => {
    expect(() => {
      playBubblePopSound({ depth: 0 });
      playBubblePopSound({ depth: 3 });
      playBubblePopSound({ depth: 10 });
    }).not.toThrow();
  });
});
