import adhkarJson from '../data/adhkar/adhkar.generated.json';
import type { AdhkarDataset, AdhkarItem, AdhkarProgress } from '../core/types';
import { normalizeArabic } from '../core/arabic';
import { storage } from '../core/storage';

export interface AdhkarCategoryInfo {
  name: string;
  count: number;
}

export interface AdhkarRepository {
  getMetadata(): AdhkarDataset['meta'];
  getCategories(): string[];
  getCategoriesWithCounts(): AdhkarCategoryInfo[];
  list(category?: string): AdhkarItem[];
  search(query: string): AdhkarItem[];
  getItem(id: string): AdhkarItem | null;
  loadOpenDuaCatalogue(): Promise<number>;
  getCounter(id: string): number;
  increment(id: string): number;
  setCounter(id: string, value: number): void;
  resetCounter(id: string): void;
  resetAllCounters(): void;
  markCompletedToday(id: string): void;
  getTodayCompletedCount(category: string): number;
  getProgress(): AdhkarProgress;
  saveProgress(patch: Partial<AdhkarProgress>): AdhkarProgress;
  removeOpenDuaCatalogue(): void;
}

const dataset = adhkarJson as AdhkarDataset;
const PROGRESS_KEY = 'dhikr-progress:v1';
const LEGACY_COUNTER_KEY = 'dhikr-counters:v1';
const OPENDUA_KEY = 'opendua-catalogue:v1';

interface OpenDuaEntry {
  id: string;
  title: string;
  sourceReference?: string;
  tags?: string[];
  variations?: Array<{ steps?: Array<{ items?: Array<{ dua?: { arabic?: string; references?: unknown[] } }>; recordings?: Array<{ url?: string }> }> }>;
}

function categorizeOpenDua(entry: OpenDuaEntry): string[] {
  const haystack = normalizeArabic(`${entry.title} ${(entry.tags ?? []).join(' ')}`);
  if (haystack.includes('morning')) return ['أذكار الصباح', 'أدعية مأثورة'];
  if (haystack.includes('evening')) return ['أذكار المساء', 'أدعية مأثورة'];
  if (haystack.includes('sleep') || haystack.includes('waking')) return ['أذكار النوم', 'أدعية مأثورة'];
  if (haystack.includes('prayer') || haystack.includes('mosque') || haystack.includes('athan')) return ['أذكار الصلاة', 'أدعية مأثورة'];
  return ['أدعية مأثورة'];
}

function mapOpenDuaEntry(entry: OpenDuaEntry, index: number): AdhkarItem | null {
  const standard = entry.variations?.[0];
  const recitations = standard?.steps?.flatMap((step) => step.items?.map((item) => item.dua?.arabic).filter(Boolean) ?? []) ?? [];
  const content = recitations.join('\n');
  if (!content.trim()) return null;
  const audioUrl = standard?.steps?.flatMap((step) => step.recordings ?? []).find((recording) => recording.url)?.url ?? null;
  return {
    id: `opendua-${entry.id}`,
    order: 10_000 + index,
    content,
    count: 1,
    countDescription: 'حسب النص المصدر؛ لا يوجد عدد ثابت مضمّن هنا',
    benefit: '',
    source: `OpenDua / Hisn al-Muslim${entry.sourceReference ? ` — ${entry.sourceReference}` : ''}`,
    sourceType: 9,
    categories: categorizeOpenDua(entry),
    audioUrl,
    hadithText: null,
    vocabulary: null
  };
}

const emptyProgress: AdhkarProgress = { counts: {}, completedDates: {}, lastCategory: 'أذكار الصباح', lastItemId: null, updatedAt: new Date().toISOString() };

export class StaticAdhkarRepository implements AdhkarRepository {
  private searchIndex: Array<{ item: AdhkarItem; haystack: string }> | null = null;
  private allItemsCache: AdhkarItem[] | null = null;

  getMetadata(): AdhkarDataset['meta'] {
    return dataset.meta;
  }

  private openDuaItems(): AdhkarItem[] {
    return storage.get<AdhkarItem[]>(OPENDUA_KEY, []);
  }

  private allItems(): AdhkarItem[] {
    const openDua = this.openDuaItems();
    if (this.allItemsCache && openDua.length === 0) return this.allItemsCache;
    const items = [...dataset.items, ...openDua];
    if (openDua.length === 0) this.allItemsCache = items;
    return items;
  }

  getCategories(): string[] {
    return this.getCategoriesWithCounts().map((category) => category.name);
  }

  /** لا نعرض تصنيفات فارغة — كانت تظهر «لا توجد نتائج» عند اختيار تصنيف بلا عناصر. */
  getCategoriesWithCounts(): AdhkarCategoryInfo[] {
    const counts = new Map<string, number>();
    for (const item of this.allItems()) {
      for (const category of item.categories) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const preferredOrder = [
      'أذكار الصباح',
      'أذكار المساء',
      'أذكار النوم',
      'أذكار الاستيقاظ',
      'أذكار الصلاة',
      'المنزل والوضوء',
      'المسجد والأذان',
      'الطعام والشراب',
      'السفر والحل والترحال',
      'الدعاء والهموم',
      'المرض والموتى',
      'الاستغفار',
      'المناسبات',
      'الأدعية الجامعية',
      'أذكار الصباح والمساء',
      'أدعية مأثورة'
    ];
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.name);
        const indexB = preferredOrder.indexOf(b.name);
        if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        return b.count - a.count;
      });
  }

  list(category = 'أذكار الصباح'): AdhkarItem[] {
    return this.allItems().filter((item) => item.categories.includes(category));
  }

  getItem(id: string): AdhkarItem | null {
    return this.allItems().find((item) => item.id === id) ?? null;
  }

  private ensureSearchIndex(): Array<{ item: AdhkarItem; haystack: string }> {
    if (this.searchIndex && this.searchIndex.length === this.allItems().length) return this.searchIndex;
    this.searchIndex = this.allItems().map((item) => ({
      item,
      haystack: normalizeArabic(`${item.content} ${item.source} ${item.benefit} ${item.categories.join(' ')}`)
    }));
    return this.searchIndex;
  }

  search(query: string): AdhkarItem[] {
    const normalized = normalizeArabic(query);
    if (!normalized) return [];
    const tokens = normalized.split(' ').filter(Boolean);
    return this.ensureSearchIndex()
      .map(({ item, haystack }) => {
        if (haystack.includes(normalized)) return { item, score: 100 + tokens.length * 5 };
        const matched = tokens.filter((token) => haystack.includes(token)).length;
        if (!matched) return null;
        const coverage = matched / tokens.length;
        if (coverage < 0.6) return null;
        return { item, score: coverage * 60 };
      })
      .filter((entry): entry is { item: AdhkarItem; score: number } => Boolean(entry))
      .sort((a, b) => b.score - a.score || a.item.order - b.item.order)
      .map(({ item }) => item);
  }

  async loadOpenDuaCatalogue(): Promise<number> {
    const response = await fetch('https://opendua.hdfund.org/v0.0.4/catalogue.json');
    if (!response.ok) throw new Error('تعذر تحميل بيانات OpenDua.');
    const payload = (await response.json()) as { entries?: OpenDuaEntry[] };
    const items = (payload.entries ?? []).map(mapOpenDuaEntry).filter((item): item is AdhkarItem => Boolean(item));
    storage.set(OPENDUA_KEY, items);
    this.allItemsCache = null;
    this.searchIndex = null;
    return items.length;
  }

  removeOpenDuaCatalogue(): void {
    storage.remove(OPENDUA_KEY);
    this.allItemsCache = null;
    this.searchIndex = null;
  }

  getProgress(): AdhkarProgress {
    const stored = storage.get<Partial<AdhkarProgress>>(PROGRESS_KEY, {});
    const legacy = storage.get<Record<string, number>>(LEGACY_COUNTER_KEY, {});
    return {
      ...emptyProgress,
      ...stored,
      counts: { ...legacy, ...(stored.counts ?? {}) },
      completedDates: stored.completedDates ?? {}
    };
  }

  saveProgress(patch: Partial<AdhkarProgress>): AdhkarProgress {
    const next = { ...this.getProgress(), ...patch, updatedAt: new Date().toISOString() };
    storage.set(PROGRESS_KEY, next);
    return next;
  }

  getCounter(id: string): number {
    return this.getProgress().counts[id] ?? 0;
  }

  increment(id: string): number {
    const progress = this.getProgress();
    const next = (progress.counts[id] ?? 0) + 1;
    this.saveProgress({ counts: { ...progress.counts, [id]: next } });
    return next;
  }

  setCounter(id: string, value: number): void {
    const progress = this.getProgress();
    this.saveProgress({ counts: { ...progress.counts, [id]: Math.max(0, value) } });
  }

  resetCounter(id: string): void {
    const progress = this.getProgress();
    const counts = { ...progress.counts };
    delete counts[id];
    this.saveProgress({ counts });
  }

  resetAllCounters(): void {
    this.saveProgress({ counts: {}, completedDates: {} });
    storage.remove(LEGACY_COUNTER_KEY);
  }

  markCompletedToday(id: string): void {
    const progress = this.getProgress();
    const today = new Date().toISOString().slice(0, 10);
    const existing = progress.completedDates[today] ?? [];
    if (existing.includes(id)) return;
    this.saveProgress({ completedDates: { ...progress.completedDates, [today]: [...existing, id] } });
  }

  getTodayCompletedCount(category: string): number {
    const progress = this.getProgress();
    const today = new Date().toISOString().slice(0, 10);
    const completed = progress.completedDates[today] ?? [];
    const ids = new Set(this.list(category).map((item) => item.id));
    return completed.filter((id) => ids.has(id)).length;
  }
}

export const adhkarRepository = new StaticAdhkarRepository();

/** اهتزاز خفيف عند العدّ، وأقوى عند إكمال العدد — يعمل على الويب وفي التطبيق. */
export async function dhikrHaptic(kind: 'tick' | 'success' = 'tick'): Promise<void> {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
    return;
  } catch {
    // بعض المنصات لا تدعم الاهتزاز — نجرّب واجهة الويب.
  }
  try {
    navigator.vibrate?.(kind === 'success' ? [24, 40, 24] : 14);
  } catch {
    // تجاهل.
  }
}
