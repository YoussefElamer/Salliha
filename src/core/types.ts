export type ThemeMode = 'light' | 'dark' | 'system';

export interface Ayah {
  id: string;
  globalAyahNumber: number;
  surahId: number;
  surahName: string;
  ayahNumber: number;
  orderInSurah: number;
  text: string;
}

export interface Surah {
  surahId: number;
  order: number;
  name: string;
  transliteration: string;
  revelationType: 'meccan' | 'medinan' | string;
  ayahCount: number;
  verses: Ayah[];
}

export interface QuranDataset {
  meta: {
    sourceName: string;
    sourceVersion: string;
    sourceUrl: string;
    upstreamTextSource: string;
    license: string;
    sourceSha256: string;
    generatedFrom: string;
    note: string;
  };
  surahs: Surah[];
}

export interface ReadingPosition {
  surahId: number;
  ayahNumber: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  surahId: number;
  ayahNumber: number;
  label: string;
  createdAt: string;
}

export interface AdhkarItem {
  id: string;
  order: number;
  content: string;
  count: number;
  countDescription: string;
  benefit: string;
  source: string;
  sourceType: number;
  categories: string[];
  audioUrl: string | null;
  hadithText: string | null;
  vocabulary: string | null;
}

export interface AdhkarDataset {
  meta: {
    sourceName: string;
    sourceVersion: string;
    sourceUrl: string;
    license: string;
    sourceSha256: string;
    generatedFrom: string;
    note: string;
  };
  categories: string[];
  items: AdhkarItem[];
}

export type PrayerName = 'الفجر' | 'الشروق' | 'الظهر' | 'العصر' | 'المغرب' | 'العشاء';

export interface PrayerTime {
  name: PrayerName;
  time: Date;
  iso: string;
  status: 'past' | 'current' | 'upcoming';
}

export type CalculationMethodId = 'mwl' | 'egyptian' | 'ummAlQura' | 'karachi' | 'dubai' | 'moonsighting';
export type Madhhab = 'shafi' | 'hanafi';

export interface CityPreset {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface PrayerSettings {
  cityId: string;
  coordinates: { latitude: number; longitude: number } | null;
  calculationMethod: CalculationMethodId;
  madhhab: Madhhab;
  offsets: Record<PrayerName, number>;
  adhanEnabled: Record<PrayerName, boolean>;
  prePrayerMinutes: number;
  notificationsEnabled: boolean;
  silentMode: boolean;
  vibration: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  language: 'ar' | 'en';
  fontScale: number;
  quranFontScale: number;
  onboardingComplete: boolean;
  defaultReciterId: string;
  prayer: PrayerSettings;
}

export interface Reciter {
  id: string;
  name: string;
  source: string;
  licenseNote: string;
  editionIdentifier: string;
  streamingOnly: boolean;
}

export interface SearchResult {
  id: string;
  type: 'ayah' | 'surah' | 'adhkar' | 'reciter' | 'tafsir';
  title: string;
  subtitle?: string;
  text?: string;
  score: number;
  payload: unknown;
}

export interface TafsirEntry {
  sourceName: string;
  sourceUrl: string;
  surahId: number;
  ayahNumber: number;
  text: string;
}
