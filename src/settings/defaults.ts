import type { AppSettings, PrayerName } from '../core/types';
import { adhanPrayers, prayerOrder } from '../prayer/prayerCalculations';

const enabledByPrayer = Object.fromEntries(prayerOrder.map((name) => [name, adhanPrayers.includes(name)])) as Record<PrayerName, boolean>;
const zeroOffsets = Object.fromEntries(prayerOrder.map((name) => [name, 0])) as Record<PrayerName, number>;

export const APP_VERSION = '0.2.0';
export const SETTINGS_VERSION = 2;

export const defaultSettings: AppSettings = {
  theme: 'system',
  language: 'ar',
  fontScale: 1,
  quranFontScale: 1.35,
  onboardingComplete: false,
  onboardingVersion: SETTINGS_VERSION,
  defaultReciterId: 'ar.alafasy',
  prayer: {
    locationMode: 'auto',
    cityId: '',
    coordinates: null,
    timezone: null,
    resolved: null,
    calculationMethod: 'auto',
    madhhab: 'shafi',
    offsets: zeroOffsets,
    adhanEnabled: enabledByPrayer,
    prePrayerMinutes: 10,
    notificationsEnabled: false,
    silentMode: false,
    vibration: true,
    hijriOffsetDays: 0,
    adhanSoundId: 'adhan-misr'
  },
  playback: {
    reciterId: 'ar.alafasy',
    mode: 'ayah',
    repeatMode: 'off',
    playbackRate: 1,
    bitrate: 128,
    range: null,
    sleepTimerMinutes: null,
    autoPlayNextSurah: true
  },
  reading: {
    quranFontFamily: 'amiriQuran',
    quranFontScale: 1.35,
    quranLineHeight: 2.5,
    // الافتراضي: المصحف كاملًا في تمرير واحد متصل (يمكن العودة لعرض السورة الواحدة من الإعدادات).
    viewMode: 'continuous',
    showTashkeel: true,
    tafsirSourceId: 'ar.muyassar'
  },
  adhkar: {
    hapticFeedback: true,
    autoAdvance: true,
    focusMode: true,
    keepScreenAwake: false
  },
  salawat: {
    enabled: false,
    intervalMinutes: 15
  }
};

/** معرّفات المدن في الإصدار الأول (قبل قاعدة بيانات GeoNames) → معرّفات GeoNames. */
export const legacyCityIds: Record<string, string> = {
  makkah: '104515',
  madinah: '109223',
  riyadh: '108410',
  cairo: '360630',
  amman: '250441',
  dubai: '292223',
  istanbul: '745044',
  london: '2643743'
};
