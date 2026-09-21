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
  /** موضع الذكر في المصدر الأصلي (مثل قسم «أذكار النوم» في حصن المسلم). */
  section?: string;
  /** المعرّف الأصلي في المصدر قبل إعادة الترقيم. */
  sourceId?: string;
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
    attribution?: string;
    hisnSourceSha256?: string;
    hisnSourcePath?: string;
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
export type CalculationMethodChoice = CalculationMethodId | 'auto';
export type Madhhab = 'shafi' | 'hanafi';

/** سجل مدينة من قاعدة البيانات المدمجة (كل دول العالم). */
export interface GeoCity {
  id: string;
  name: string;
  nameAr: string;
  countryCode: string;
  countryAr: string;
  countryEn: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number;
  isCapital: boolean;
  defaultMethod: CalculationMethodId;
}

/** نتيجة تحديد الموقع: إما GPS أو اشتقاق من المنطقة الزمنية للجهاز. */
export interface ResolvedLocation {
  cityId: string;
  name: string;
  countryCode: string;
  countryAr: string;
  latitude: number;
  longitude: number;
  timezone: string;
  method: CalculationMethodId;
  source: 'gps' | 'timezone' | 'manual';
  distanceKm?: number;
}

export interface StoredLocation extends Omit<ResolvedLocation, 'distanceKm'> {
  updatedAt: string;
}

export interface PrayerSettings {
  /** 'auto' = تحديد الموقع تلقائيًا من الجهاز، 'manual' = مدينة مختارة يدويًا. */
  locationMode: 'auto' | 'manual';
  cityId: string;
  coordinates: { latitude: number; longitude: number } | null;
  timezone: string | null;
  resolved: StoredLocation | null;
  calculationMethod: CalculationMethodChoice;
  madhhab: Madhhab;
  offsets: Record<PrayerName, number>;
  adhanEnabled: Record<PrayerName, boolean>;
  prePrayerMinutes: number;
  notificationsEnabled: boolean;
  silentMode: boolean;
  vibration: boolean;
  hijriOffsetDays: number;
}

export type ReciterStyle = 'murattal' | 'mujawwad' | 'teaching';

export interface Reciter {
  id: string;
  name: string;
  /** ترجمة/وصف مختصر للقارئ. */
  description: string;
  source: string;
  licenseNote: string;
  editionIdentifier: string;
  streamingOnly: boolean;
  style: ReciterStyle;
  /** هل تتوفر تسجيلات سورة كاملة (ملف واحد لكل سورة) على CDN؟ */
  surahAudio: boolean;
  bitrates: number[];
  country?: string;
}

export type RepeatMode = 'off' | 'ayah' | 'range' | 'surah';
export type PlaybackMode = 'ayah' | 'surah';

export interface PlaybackSettings {
  reciterId: string;
  mode: PlaybackMode;
  repeatMode: RepeatMode;
  playbackRate: number;
  bitrate: number;
  /** نطاق التكرار (من/إلى) داخل سورة محددة. */
  range: { surahId: number; fromAyah: number; toAyah: number } | null;
  sleepTimerMinutes: number | null;
  autoPlayNextSurah: boolean;
}

export interface ReadingSettings {
  quranFontFamily: 'amiriQuran' | 'notoNaskh';
  quranFontScale: number;
  quranLineHeight: number;
  /**
   * طريقة عرض المصحف:
   * - `flow`: صفحة متصلة لسورة واحدة.
   * - `ayahList`: آية في كل سطر لسورة واحدة.
   * - `continuous`: المصحف كاملًا (114 سورة) في تمرير واحد متصل —
   *   نهاية السورة يليها مباشرة مطلع السورة التي بعدها.
   */
  viewMode: 'flow' | 'ayahList' | 'continuous';
  showTashkeel: boolean;
  tafsirSourceId: string;
}

export interface AdhkarSettings {
  hapticFeedback: boolean;
  autoAdvance: boolean;
  focusMode: boolean;
  keepScreenAwake: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  language: 'ar' | 'en';
  fontScale: number;
  onboardingComplete: boolean;
  onboardingVersion: number;
  prayer: PrayerSettings;
  playback: PlaybackSettings;
  reading: ReadingSettings;
  adhkar: AdhkarSettings;
  /** حجم خط المصحف — محفوظ أيضًا للتوافق مع النسخ السابقة. */
  quranFontScale: number;
  defaultReciterId: string;
}

export interface SearchResult {
  id: string;
  type: 'ayah' | 'surah' | 'adhkar' | 'reciter' | 'tafsir' | 'prayer';
  title: string;
  subtitle?: string;
  text?: string;
  score: number;
  payload: unknown;
  /** مواضع المطابقة داخل النص للتمييز البصري. */
  matches?: Array<{ start: number; end: number }>;
}

export interface TafsirEntry {
  sourceName: string;
  sourceUrl: string;
  surahId: number;
  ayahNumber: number;
  text: string;
}

export interface AdhkarProgress {
  counts: Record<string, number>;
  completedDates: Record<string, string[]>;
  lastCategory: string;
  lastItemId: string | null;
  updatedAt: string;
}

export interface PlaybackSnapshot {
  reciterId: string;
  mode: PlaybackMode;
  bitrate: number;
  surahId: number;
  ayahNumber: number;
  positionSeconds: number;
  updatedAt: string;
}
