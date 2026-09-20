import type { AppSettings, PrayerName } from '../core/types';

const prayerNames: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const enabledByPrayer = Object.fromEntries(prayerNames.map((name) => [name, name !== 'الشروق'])) as Record<PrayerName, boolean>;
const zeroOffsets = Object.fromEntries(prayerNames.map((name) => [name, 0])) as Record<PrayerName, number>;

export const defaultSettings: AppSettings = {
  theme: 'system',
  language: 'ar',
  fontScale: 1,
  quranFontScale: 1.12,
  onboardingComplete: false,
  defaultReciterId: 'ar.alafasy',
  prayer: {
    cityId: 'makkah',
    coordinates: null,
    calculationMethod: 'ummAlQura',
    madhhab: 'shafi',
    offsets: zeroOffsets,
    adhanEnabled: enabledByPrayer,
    prePrayerMinutes: 10,
    notificationsEnabled: false,
    silentMode: false,
    vibration: true
  }
};
