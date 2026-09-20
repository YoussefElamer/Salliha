import adhkarJson from '../data/adhkar/adhkar.generated.json';
import type { AdhkarDataset, AdhkarItem } from '../core/types';
import { normalizeArabic } from '../core/arabic';
import { storage } from '../core/storage';

export interface AdhkarRepository {
  getMetadata(): AdhkarDataset['meta'];
  getCategories(): string[];
  list(category?: string): AdhkarItem[];
  search(query: string): AdhkarItem[];
  loadOpenDuaCatalogue(): Promise<number>;
  getCounter(id: string): number;
  setCounter(id: string, value: number): void;
  resetCounter(id: string): void;
}

const dataset = adhkarJson as AdhkarDataset;
const COUNTER_KEY = 'dhikr-counters:v1';
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

export class StaticAdhkarRepository implements AdhkarRepository {
  getMetadata(): AdhkarDataset['meta'] {
    return dataset.meta;
  }

  private openDuaItems(): AdhkarItem[] {
    return storage.get<AdhkarItem[]>(OPENDUA_KEY, []);
  }

  private allItems(): AdhkarItem[] {
    return [...dataset.items, ...this.openDuaItems()];
  }

  getCategories(): string[] {
    return Array.from(new Set([...dataset.categories, 'أذكار النوم', 'أذكار الصلاة', 'أدعية مأثورة', ...this.openDuaItems().flatMap((item) => item.categories)]));
  }

  list(category = 'أذكار الصباح'): AdhkarItem[] {
    return this.allItems().filter((item) => item.categories.includes(category));
  }

  search(query: string): AdhkarItem[] {
    const normalized = normalizeArabic(query);
    if (!normalized) return [];
    return this.allItems()
      .map((item) => {
        const haystack = normalizeArabic(`${item.content} ${item.source} ${item.benefit} ${item.categories.join(' ')}`);
        const score = haystack.includes(normalized) ? 100 : normalized.split(' ').filter((token) => haystack.includes(token)).length * 10;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.order - b.item.order)
      .map(({ item }) => item);
  }

  async loadOpenDuaCatalogue(): Promise<number> {
    const response = await fetch('https://opendua.hdfund.org/v0.0.4/catalogue.json');
    if (!response.ok) throw new Error('تعذر تحميل بيانات OpenDua.');
    const payload = (await response.json()) as { entries?: OpenDuaEntry[] };
    const items = (payload.entries ?? []).map(mapOpenDuaEntry).filter((item): item is AdhkarItem => Boolean(item));
    storage.set(OPENDUA_KEY, items);
    return items.length;
  }

  private counters(): Record<string, number> {
    return storage.get<Record<string, number>>(COUNTER_KEY, {});
  }

  getCounter(id: string): number {
    return this.counters()[id] ?? 0;
  }

  setCounter(id: string, value: number): void {
    storage.set(COUNTER_KEY, { ...this.counters(), [id]: Math.max(0, value) });
  }

  resetCounter(id: string): void {
    const next = this.counters();
    delete next[id];
    storage.set(COUNTER_KEY, next);
  }
}

export const adhkarRepository = new StaticAdhkarRepository();
