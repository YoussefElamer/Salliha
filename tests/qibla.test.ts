import { describe, expect, it } from 'vitest';
import { calculateQibla, directionLabel } from '../src/qibla/qibla';

describe('qibla', () => {
  it('calculates a valid bearing from Cairo', () => {
    const value = calculateQibla(30.0444, 31.2357);
    expect(value).toBeGreaterThan(130);
    expect(value).toBeLessThan(150);
  });

  it('labels cardinal directions', () => {
    expect(directionLabel(0)).toBe('شمال');
    expect(directionLabel(90)).toBe('شرق');
    expect(directionLabel(180)).toBe('جنوب');
    expect(directionLabel(270)).toBe('غرب');
  });
});
