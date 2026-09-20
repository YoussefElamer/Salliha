import type { CalculationMethodId, Madhhab, PrayerName, PrayerSettings, PrayerTime } from '../core/types';

export interface CalculationMethod {
  id: CalculationMethodId;
  label: string;
  fajrAngle: number;
  ishaAngle?: number;
  ishaInterval?: number;
}

export const calculationMethods: CalculationMethod[] = [
  { id: 'mwl', label: 'رابطة العالم الإسلامي', fajrAngle: 18, ishaAngle: 17 },
  { id: 'egyptian', label: 'الهيئة المصرية العامة للمساحة', fajrAngle: 19.5, ishaAngle: 17.5 },
  { id: 'ummAlQura', label: 'أم القرى', fajrAngle: 18.5, ishaInterval: 90 },
  { id: 'karachi', label: 'جامعة العلوم الإسلامية كراتشي', fajrAngle: 18, ishaAngle: 18 },
  { id: 'dubai', label: 'دبي', fajrAngle: 18.2, ishaAngle: 18.2 },
  { id: 'moonsighting', label: 'Moonsighting Committee', fajrAngle: 18, ishaAngle: 18 }
];

const prayerOrder: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const degToRad = (degree: number) => (degree * Math.PI) / 180;
const radToDeg = (radian: number) => (radian * 180) / Math.PI;
const sin = (degree: number) => Math.sin(degToRad(degree));
const cos = (degree: number) => Math.cos(degToRad(degree));
const tan = (degree: number) => Math.tan(degToRad(degree));
const arcsin = (value: number) => radToDeg(Math.asin(value));
const arccos = (value: number) => radToDeg(Math.acos(Math.min(1, Math.max(-1, value))));
const arctan2 = (y: number, x: number) => radToDeg(Math.atan2(y, x));
const fix = (value: number, max: number) => ((value % max) + max) % max;
const fixAngle = (angle: number) => fix(angle, 360);
const fixHour = (hour: number) => fix(hour, 24);
const arccot = (x: number) => radToDeg(Math.atan(1 / x));

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

export function getTimeZoneOffsetHours(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUtc - date.getTime()) / 3_600_000;
}

function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function sunPosition(julian: number) {
  const d = julian - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const rightAscension = fixHour(arctan2(cos(e) * sin(l), cos(l)) / 15);
  const declination = arcsin(sin(e) * sin(l));
  const equationOfTime = q / 15 - rightAscension;
  return { declination, equationOfTime };
}

function timeFromAngle(noon: number, angle: number, latitude: number, declination: number, direction: 'before' | 'after'): number {
  const numerator = sin(angle) - sin(latitude) * sin(declination);
  const denominator = cos(latitude) * cos(declination);
  const hourAngle = arccos(numerator / denominator) / 15;
  return direction === 'before' ? noon - hourAngle : noon + hourAngle;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function zonedDateAtHour(year: number, month: number, day: number, hour: number, timeZoneOffset: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + (hour - timeZoneOffset) * 3_600_000);
}

export function calculatePrayerTimes(params: {
  date: Date;
  latitude: number;
  longitude: number;
  timeZone: string;
  method: CalculationMethodId;
  madhhab: Madhhab;
  offsets: PrayerSettings['offsets'];
  now?: Date;
}): PrayerTime[] {
  const method = calculationMethods.find((item) => item.id === params.method) ?? calculationMethods[0];
  const dateParts = getZonedParts(params.date, params.timeZone);
  const localNoon = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0));
  const tzOffset = getTimeZoneOffsetHours(localNoon, params.timeZone);
  const jd = julianDay(dateParts.year, dateParts.month, dateParts.day) - params.longitude / (15 * 24);
  const { declination, equationOfTime } = sunPosition(jd);
  const noon = fixHour(12 + tzOffset - params.longitude / 15 - equationOfTime);
  const sunrise = timeFromAngle(noon, -0.833, params.latitude, declination, 'before');
  const sunset = timeFromAngle(noon, -0.833, params.latitude, declination, 'after');
  const asrFactor = params.madhhab === 'hanafi' ? 2 : 1;
  const asrAngle = arccot(asrFactor + tan(Math.abs(params.latitude - declination)));
  const asr = timeFromAngle(noon, asrAngle, params.latitude, declination, 'after');
  const fajr = timeFromAngle(noon, -method.fajrAngle, params.latitude, declination, 'before');
  const isha = method.ishaInterval ? sunset + method.ishaInterval / 60 : timeFromAngle(noon, -(method.ishaAngle ?? 17), params.latitude, declination, 'after');

  const raw: Record<PrayerName, number> = {
    الفجر: fajr,
    الشروق: sunrise,
    الظهر: noon,
    العصر: asr,
    المغرب: sunset,
    العشاء: isha
  };

  const now = params.now ?? new Date();
  const dates = prayerOrder.map((name) => {
    const withOffset = raw[name] + (params.offsets[name] ?? 0) / 60;
    return { name, time: zonedDateAtHour(dateParts.year, dateParts.month, dateParts.day, fixHour(withOffset), tzOffset) };
  });
  const nextIndex = dates.findIndex((item) => item.time.getTime() > now.getTime());
  const upcomingIndex = nextIndex === -1 ? -1 : nextIndex;
  const currentIndex = nextIndex <= 0 ? -1 : nextIndex - 1;

  return dates.map((item, index) => ({
    name: item.name,
    time: item.time,
    iso: item.time.toISOString(),
    status: index === upcomingIndex ? 'upcoming' : index === currentIndex ? 'current' : item.time.getTime() < now.getTime() ? 'past' : 'upcoming'
  }));
}

export function getNextPrayer(today: PrayerTime[], tomorrow: PrayerTime[], now = new Date()): PrayerTime {
  const nextToday = today.find((item) => item.name !== 'الشروق' && item.time.getTime() > now.getTime());
  if (nextToday) return nextToday;
  const firstTomorrow = tomorrow.find((item) => item.name !== 'الشروق');
  if (firstTomorrow) return firstTomorrow;
  const fallback = addMinutes(now, 24 * 60);
  return { name: 'الفجر', time: fallback, iso: fallback.toISOString(), status: 'upcoming' };
}
