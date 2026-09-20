import { describe, expect, it } from 'vitest';
import { calculatePrayerTimes, getNextPrayer, getTimeZoneOffsetHours } from '../src/prayer/prayerCalculations';
import type { PrayerName } from '../src/core/types';

const zeroOffsets = Object.fromEntries(['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'].map((name) => [name, 0])) as Record<PrayerName, number>;

describe('Prayer calculations', () => {
  it('calculates the six daily times in chronological order', () => {
    const times = calculatePrayerTimes({
      date: new Date('2026-09-20T09:00:00Z'),
      latitude: 21.3891,
      longitude: 39.8579,
      timeZone: 'Asia/Riyadh',
      method: 'ummAlQura',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-09-20T09:00:00Z')
    });
    expect(times.map((time) => time.name)).toEqual(['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء']);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index].time.getTime()).toBeGreaterThan(times[index - 1].time.getTime());
    }
  });

  it('finds tomorrow Fajr after the last prayer', () => {
    const today = calculatePrayerTimes({ date: new Date('2026-09-20T21:30:00Z'), latitude: 21.3891, longitude: 39.8579, timeZone: 'Asia/Riyadh', method: 'ummAlQura', madhhab: 'shafi', offsets: zeroOffsets, now: new Date('2026-09-20T21:30:00Z') });
    const tomorrow = calculatePrayerTimes({ date: new Date('2026-09-21T21:30:00Z'), latitude: 21.3891, longitude: 39.8579, timeZone: 'Asia/Riyadh', method: 'ummAlQura', madhhab: 'shafi', offsets: zeroOffsets, now: new Date('2026-09-20T21:30:00Z') });
    const next = getNextPrayer(today, tomorrow, new Date('2026-09-20T21:30:00Z'));
    expect(next.name).toBe('الفجر');
    expect(next.time.getTime()).toBeGreaterThan(new Date('2026-09-20T21:30:00Z').getTime());
  });

  it('reflects DST/timezone offsets where the platform provides IANA data', () => {
    const winter = getTimeZoneOffsetHours(new Date('2026-01-15T12:00:00Z'), 'Europe/London');
    const summer = getTimeZoneOffsetHours(new Date('2026-07-15T12:00:00Z'), 'Europe/London');
    expect(summer).toBeGreaterThanOrEqual(winter);
  });
});
