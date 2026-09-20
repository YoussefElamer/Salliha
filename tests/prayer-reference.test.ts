import { describe, expect, it } from 'vitest';
import { calculatePrayerTimes } from '../src/prayer/prayerCalculations';
import type { PrayerName } from '../src/core/types';

const zeroOffsets = Object.fromEntries(['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'].map((name) => [name, 0])) as Record<PrayerName, number>;

function formatHM(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(date);
}
function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}
function diffMinutes(actual: string, expected: string): number {
  const d = Math.abs(hmToMinutes(actual) - hmToMinutes(expected));
  return Math.min(d, 24 * 60 - d);
}

// Golden snapshots generated from current algorithm on 2026-09-21.
// These lock the behavior — any unintentional change fails.
// Reference values cross-checked approximately vs external tables (IslamicFinder/PrayTimes) with ±2min tolerance.
const GOLDEN = {
  makkah_2026_01_15: { الفجر: '05:40', الشروق: '07:00', الظهر: '12:29', العصر: '15:37', المغرب: '17:58', العشاء: '19:28' },
  makkah_2026_06_15: { الفجر: '04:10', الشروق: '05:38', الظهر: '12:20', العصر: '15:40', المغرب: '19:03', العشاء: '20:33' },
  makkah_2026_09_20: { الفجر: '04:52', الشروق: '06:08', الظهر: '12:14', العصر: '15:39', المغرب: '18:19', العشاء: '19:49' },
  cairo_2026_01_15: { الفجر: '05:27', الشروق: '06:51', الظهر: '12:04', العصر: '14:57', المغرب: '17:16', العشاء: '18:36' },
  cairo_2026_06_15: { الفجر: '04:16', الشروق: '05:53', الظهر: '12:55', العصر: '16:31', المغرب: '19:57', العشاء: '21:27' },
  cairo_2026_09_20: { الفجر: '05:22', الشروق: '06:42', الظهر: '12:48', العصر: '16:17', المغرب: '18:55', العشاء: '20:10' },
} as const;

describe('Prayer reference validation', () => {
  it('matches golden snapshot for Makkah 2026-09-20 (Umm Al-Qura) within 1 minute', () => {
    const times = calculatePrayerTimes({
      date: new Date('2026-09-20T12:00:00Z'),
      latitude: 21.3891,
      longitude: 39.8579,
      timeZone: 'Asia/Riyadh',
      method: 'ummAlQura',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-09-20T00:00:00Z'),
    });
    const expected = GOLDEN.makkah_2026_09_20;
    for (const t of times) {
      const actualHM = formatHM(t.time, 'Asia/Riyadh');
      expect(diffMinutes(actualHM, expected[t.name as PrayerName])).toBeLessThanOrEqual(1);
    }
  });

  it('matches golden snapshots for Makkah/Cairo winter & summer within 2 minutes', () => {
    const cases: Array<{ city: string; lat: number; lon: number; tz: string; date: string; method: 'ummAlQura' | 'mwl'; expected: Record<PrayerName, string> }> = [
      { city: 'makkah', lat: 21.3891, lon: 39.8579, tz: 'Asia/Riyadh', date: '2026-01-15', method: 'ummAlQura', expected: GOLDEN.makkah_2026_01_15 },
      { city: 'makkah', lat: 21.3891, lon: 39.8579, tz: 'Asia/Riyadh', date: '2026-06-15', method: 'ummAlQura', expected: GOLDEN.makkah_2026_06_15 },
      { city: 'cairo', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo', date: '2026-01-15', method: 'mwl', expected: GOLDEN.cairo_2026_01_15 },
      { city: 'cairo', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo', date: '2026-06-15', method: 'mwl', expected: GOLDEN.cairo_2026_06_15 },
      { city: 'cairo', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo', date: '2026-09-20', method: 'mwl', expected: GOLDEN.cairo_2026_09_20 },
    ];
    for (const c of cases) {
      const times = calculatePrayerTimes({
        date: new Date(`${c.date}T12:00:00Z`),
        latitude: c.lat,
        longitude: c.lon,
        timeZone: c.tz,
        method: c.method,
        madhhab: 'shafi',
        offsets: zeroOffsets,
        now: new Date(`${c.date}T00:00:00Z`),
      });
      for (const t of times) {
        const actualHM = formatHM(t.time, c.tz);
        const diff = diffMinutes(actualHM, c.expected[t.name]);
        expect(diff, `${c.city} ${c.date} ${t.name}: expected ${c.expected[t.name]} got ${actualHM}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('enforces canonical ordering and plausible windows', () => {
    const times = calculatePrayerTimes({
      date: new Date('2026-09-20T12:00:00Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      timeZone: 'Africa/Cairo',
      method: 'egyptian',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-09-20T00:00:00Z'),
    });
    const order: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
    expect(times.map((t) => t.name)).toEqual(order);
    for (let i = 1; i < times.length; i++) {
      expect(times[i].time.getTime()).toBeGreaterThan(times[i - 1].time.getTime());
    }
    // Fajr before sunrise by at least 60 min, Maghrib after Asr, Isha after Maghrib
    const byName = Object.fromEntries(times.map((t) => [t.name, t.time.getTime()]));
    expect(byName['الشروق'] - byName['الفجر']).toBeGreaterThan(60 * 60 * 1000);
    expect(byName['المغرب'] - byName['العصر']).toBeGreaterThan(60 * 60 * 1000);
    expect(byName['العشاء'] - byName['المغرب']).toBeGreaterThan(30 * 60 * 1000);
  });

  it('hanafi Asr is later than shafi Asr', () => {
    const base = { date: new Date('2026-06-15T12:00:00Z'), latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo', method: 'egyptian' as const, offsets: zeroOffsets, now: new Date('2026-06-15T00:00:00Z') };
    const shafi = calculatePrayerTimes({ ...base, madhhab: 'shafi' });
    const hanafi = calculatePrayerTimes({ ...base, madhhab: 'hanafi' });
    const shafiAsr = shafi.find((t) => t.name === 'العصر')!.time.getTime();
    const hanafiAsr = hanafi.find((t) => t.name === 'العصر')!.time.getTime();
    expect(hanafiAsr).toBeGreaterThan(shafiAsr);
    expect(hanafiAsr - shafiAsr).toBeGreaterThan(30 * 60 * 1000);
  });

  it('method differences affect Fajr/Isha', () => {
    const base = { date: new Date('2026-09-20T12:00:00Z'), latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo', madhhab: 'shafi' as const, offsets: zeroOffsets, now: new Date('2026-09-20T00:00:00Z') };
    const mwl = calculatePrayerTimes({ ...base, method: 'mwl' });
    const egypt = calculatePrayerTimes({ ...base, method: 'egyptian' });
    const mwlFajr = mwl.find((t) => t.name === 'الفجر')!.time.getTime();
    const egyptFajr = egypt.find((t) => t.name === 'الفجر')!.time.getTime();
    // Egyptian fajr angle 19.5 > MWL 18 => earlier fajr
    expect(egyptFajr).toBeLessThan(mwlFajr);
  });

  it('offsets shift times correctly', () => {
    const offsetsShafi: Record<PrayerName, number> = { الفجر: 5, الشروق: 0, الظهر: -3, العصر: 0, المغرب: 2, العشاء: 0 };
    const baseTimes = calculatePrayerTimes({
      date: new Date('2026-09-20T12:00:00Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      timeZone: 'Africa/Cairo',
      method: 'egyptian',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-09-20T00:00:00Z'),
    });
    const offsetTimes = calculatePrayerTimes({
      date: new Date('2026-09-20T12:00:00Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      timeZone: 'Africa/Cairo',
      method: 'egyptian',
      madhhab: 'shafi',
      offsets: offsetsShafi,
      now: new Date('2026-09-20T00:00:00Z'),
    });
    for (const name of Object.keys(offsetsShafi) as PrayerName[]) {
      const diff = offsetTimes.find((t) => t.name === name)!.time.getTime() - baseTimes.find((t) => t.name === name)!.time.getTime();
      expect(diff).toBe(offsetsShafi[name] * 60 * 1000);
    }
  });

  it('يعطي أوقاتًا معقولة ومتتابعة في خطوط العرض العالية (Tromsø) دون NaN', () => {
    const times = calculatePrayerTimes({
      date: new Date('2026-06-21T12:00:00Z'),
      latitude: 69.6492,
      longitude: 18.9553,
      timeZone: 'Europe/Oslo',
      method: 'mwl',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-06-21T00:00:00Z')
    });
    expect(times).toHaveLength(6);
    for (const time of times) expect(Number.isNaN(time.time.getTime())).toBe(false);
    const fajr = times.find((t) => t.name === 'الفجر')!.time.getTime();
    const sunrise = times.find((t) => t.name === 'الشروق')!.time.getTime();
    const dhuhr = times.find((t) => t.name === 'الظهر')!.time.getTime();
    const isha = times.find((t) => t.name === 'العشاء')!.time.getTime();
    expect(fajr).toBeLessThan(sunrise);
    expect(sunrise).toBeLessThan(dhuhr);
    expect(dhuhr).toBeLessThan(isha);
  });

  it('يتعامل مع التوقيت الصيفي في مصر (تغيير يوم ٢٤ أبريل ٢٠٢٦)', () => {
    const before = calculatePrayerTimes({
      date: new Date('2026-04-23T12:00:00Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      timeZone: 'Africa/Cairo',
      method: 'egyptian',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-04-23T00:00:00Z')
    });
    const after = calculatePrayerTimes({
      date: new Date('2026-04-25T12:00:00Z'),
      latitude: 30.0444,
      longitude: 31.2357,
      timeZone: 'Africa/Cairo',
      method: 'egyptian',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-04-25T00:00:00Z')
    });
    for (const time of [...before, ...after]) expect(Number.isNaN(time.time.getTime())).toBe(false);
    const beforeDhuhr = formatHM(before.find((t) => t.name === 'الظهر')!.time, 'Africa/Cairo');
    const afterDhuhr = formatHM(after.find((t) => t.name === 'الظهر')!.time, 'Africa/Cairo');
    // قبل بدء التوقيت الصيفي (UTC+2) وبعده (UTC+3) — فرق ساعة كامل في التوقيت المحلي.
    expect(beforeDhuhr).toBe('11:53');
    expect(afterDhuhr).toBe('12:53');
    // لحظتان مطلقتان بعد يومين: يجب أن يكون الفرق ≈ 48 ساعة + ساعة التوقيت الصيفي (لا نطرح ساعتين خطأً).
    const gap = after.find((t) => t.name === 'الظهر')!.time.getTime() - before.find((t) => t.name === 'الظهر')!.time.getTime();
    expect(gap).toBeGreaterThan(47 * 60 * 60 * 1000);
    expect(gap).toBeLessThan(49 * 60 * 60 * 1000);
  });

  it('يتعامل مع نصف الكرة الجنوبي (أوكلاند)', () => {
    const times = calculatePrayerTimes({
      date: new Date('2026-09-21T09:00:00Z'),
      latitude: -36.8485,
      longitude: 174.7633,
      timeZone: 'Pacific/Auckland',
      method: 'mwl',
      madhhab: 'shafi',
      offsets: zeroOffsets,
      now: new Date('2026-09-21T09:00:00Z')
    });
    const dhuhr = formatHM(times.find((t) => t.name === 'الظهر')!.time, 'Pacific/Auckland');
    expect(dhuhr).toBe('12:14');
    const maghrib = formatHM(times.find((t) => t.name === 'المغرب')!.time, 'Pacific/Auckland');
    expect(hmToMinutes(maghrib)).toBeGreaterThan(hmToMinutes('18:00'));
  });
});
