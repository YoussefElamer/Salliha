import type { CalculationMethodId, Madhhab, PrayerName, PrayerSettings, PrayerTime } from '../core/types';

export interface CalculationMethod {
  id: CalculationMethodId;
  label: string;
  shortLabel: string;
  fajrAngle: number;
  ishaAngle?: number;
  ishaInterval?: number;
}

export const calculationMethods: CalculationMethod[] = [
  { id: 'egyptian', label: 'الهيئة المصرية العامة للمساحة', shortLabel: 'مصر', fajrAngle: 19.5, ishaAngle: 17.5 },
  { id: 'ummAlQura', label: 'أم القرى — مكة المكرمة', shortLabel: 'أم القرى', fajrAngle: 18.5, ishaInterval: 90 },
  { id: 'mwl', label: 'رابطة العالم الإسلامي', shortLabel: 'رابطة العالم', fajrAngle: 18, ishaAngle: 17 },
  { id: 'karachi', label: 'جامعة العلوم الإسلامية — كراتشي', shortLabel: 'كراتشي', fajrAngle: 18, ishaAngle: 18 },
  { id: 'dubai', label: 'دبي — الإمارات', shortLabel: 'دبي', fajrAngle: 18.2, ishaAngle: 18.2 },
  { id: 'moonsighting', label: 'Moonsighting Committee — أمريكا وكندا', shortLabel: 'Moonsighting', fajrAngle: 18, ishaAngle: 18 }
];

export function getCalculationMethod(id: CalculationMethodId): CalculationMethod {
  return calculationMethods.find((method) => method.id === id) ?? calculationMethods[0];
}

export const prayerOrder: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];

/** الصلوات التي لها أذان (الشروق ليس صلاة). */
export const adhanPrayers: PrayerName[] = prayerOrder.filter((name) => name !== 'الشروق');

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

export function getZonedParts(date: Date, timeZone: string) {
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
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
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

/** اليوم المحلي (في منطقة زمنية معينة) الذي تنتمي إليه اللحظة المعطاة. */
export function zonedDateKey(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
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

function hourAngleFor(angle: number, latitude: number, declination: number): number {
  const numerator = sin(angle) - sin(latitude) * sin(declination);
  const denominator = cos(latitude) * cos(declination);
  const cosine = numerator / denominator;
  // عند خطوط العرض العالية قد لا تصل الشمس للزاوية المطلوبة إطلاقًا — نعيد NaN لاستخدام قاعدة سُبع الليل.
  if (!Number.isFinite(cosine) || cosine > 1 || cosine < -1) return Number.NaN;
  return arccos(cosine) / 15;
}

/** أقصى/أدنى ارتفاع للشمس لا يتحقق في خطوط العرض العالية (الشمس لا تغيب أو لا تشرق). */
function seventhOfNightFallback(offsets: { sunrise?: number; sunset?: number; fajr?: number; isha?: number }) {
  const sunrise = Number.isFinite(offsets.sunrise) ? (offsets.sunrise as number) : -6;
  const sunset = Number.isFinite(offsets.sunset) ? (offsets.sunset as number) : 6;
  const dayLength = Math.max(0, Math.min(24, sunset - sunrise));
  const seventh = (24 - dayLength) / 7;
  return {
    sunrise,
    sunset,
    fajr: sunrise - seventh,
    isha: sunset + seventh,
    seventh
  };
}


export interface PrayerCalculationResult {
  times: PrayerTime[];
  dateKey: string;
  timeZone: string;
  coordinates: { latitude: number; longitude: number };
}

/**
 * يحسب مواقيت الصلاة كـ«لحظات مطلقة» (UTC instants) اعتمادًا على زوال الشمس،
 * ثم يعرضها بمنطقة المدينة الزمنية. لا يعتمد على منطقة الجهاز الزمنية إطلاقًا،
 * ويتعامل مع التوقيت الصيفي بشكل صحيح لأن كل المواقيت محسوبة كفرق عن لحظة الزوال.
 */
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
  const method = getCalculationMethod(params.method);
  const { year, month, day } = getZonedParts(params.date, params.timeZone);
  const middayAnchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  const jd = julianDay(year, month, day) - params.longitude / (15 * 24);
  const { declination, equationOfTime } = sunPosition(jd);
  const transitMs = middayAnchor - (params.longitude / 15) * 3_600_000 - equationOfTime * 3_600_000;

  const atOffset = (hours: number, offsetMinutes = 0) => new Date(transitMs + hours * 3_600_000 + offsetMinutes * 60_000);

  const sunriseOffset = -hourAngleFor(-0.833, params.latitude, declination);
  const sunsetOffset = hourAngleFor(-0.833, params.latitude, declination);
  const asrFactor = params.madhhab === 'hanafi' ? 2 : 1;
  const asrAngle = arccot(asrFactor + tan(Math.abs(params.latitude - declination)));
  const asrOffset = hourAngleFor(asrAngle, params.latitude, declination);
  const fajrOffset = -hourAngleFor(-method.fajrAngle, params.latitude, declination);
  const ishaOffset = method.ishaInterval
    ? sunsetOffset + method.ishaInterval / 60
    : hourAngleFor(-(method.ishaAngle ?? 17), params.latitude, declination);

  let fajrOffsetFinal = fajrOffset;
  let ishaOffsetFinal = ishaOffset;
  let sunriseOffsetFinal = sunriseOffset;
  let sunsetOffsetFinal = sunsetOffset;
  // خطوط العرض العالية: الأشعة قد تعجز عن بلوغ زوايا الفجر/العشاء أو حتى شروق الشمس وغروبها.
  const degenerate =
    ![fajrOffset, ishaOffset, sunriseOffset, sunsetOffset].every((value) => Number.isFinite(value)) || sunriseOffset >= sunsetOffset || fajrOffset >= sunriseOffset || ishaOffset <= sunsetOffset;
  if (degenerate) {
    const fallback = seventhOfNightFallback({ sunrise: sunriseOffset, sunset: sunsetOffset, fajr: fajrOffset, isha: ishaOffset });
    sunriseOffsetFinal = fallback.sunrise;
    sunsetOffsetFinal = fallback.sunset;
    fajrOffsetFinal = fallback.fajr;
    ishaOffsetFinal = fallback.isha;
  }

  const raw: Record<PrayerName, Date> = {
    الفجر: atOffset(fajrOffsetFinal, params.offsets['الفجر'] ?? 0),
    الشروق: atOffset(sunriseOffsetFinal, params.offsets['الشروق'] ?? 0),
    الظهر: atOffset(0, params.offsets['الظهر'] ?? 0),
    العصر: atOffset(Number.isFinite(asrOffset) ? asrOffset : 3.5, params.offsets['العصر'] ?? 0),
    المغرب: atOffset(sunsetOffsetFinal, params.offsets['المغرب'] ?? 0),
    العشاء: atOffset(ishaOffsetFinal, params.offsets['العشاء'] ?? 0)
  };

  const now = params.now ?? new Date();
  const dates = prayerOrder.map((name) => ({ name, time: raw[name] }));
  const nextIndex = dates.findIndex((item) => item.name !== 'الشروق' && item.time.getTime() > now.getTime());
  const upcomingIndex = nextIndex === -1 ? -1 : nextIndex;
  let currentIndex = -1;
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    if (dates[index].time.getTime() <= now.getTime()) {
      currentIndex = index;
      break;
    }
  }

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
  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { name: 'الفجر', time: fallback, iso: fallback.toISOString(), status: 'upcoming' };
}

/** الوقت المتبقي بصيغة «٣ ساعات و١٢ دقيقة» للعرض في الواجهة. */
export function formatRemaining(target: Date, now: Date): string {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const totalMinutes = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diff % 60_000) / 1000);
  if (hours > 0) return `${hours} س ${minutes} د`;
  if (minutes > 0) return `${minutes} د ${seconds} ث`;
  return `${seconds} ث`;
}

export function formatClockInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date);
}
