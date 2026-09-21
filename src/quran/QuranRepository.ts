import quranJson from '../data/quran/quran.generated.json';
import type { Ayah, QuranDataset, Surah } from '../core/types';
import { normalizeArabic } from '../core/arabic';
import { QuranSearchIndex, type AyahSearchHit, type AyahSearchOutcome } from './quranSearch';

export interface QuranRepository {
  getMetadata(): QuranDataset['meta'];
  getSurahs(): Surah[];
  getSurah(surahId: number): Surah | undefined;
  getAyah(surahId: number, ayahNumber: number): Ayah | undefined;
  getAyahByGlobalNumber(globalAyahNumber: number): Ayah | undefined;
  search(query: string, limit?: number): Ayah[];
  searchDetailed(query: string, limit?: number): AyahSearchOutcome;
  searchSurahs(query: string, limit?: number): Surah[];
  /** يجهّز فهرس البحث مسبقًا (يُستدعى في وقت الخمول بعد أول رسم). */
  warmUp(): void;
  isSearchReady(): boolean;
  searchStats(): { ayat: number; tokens: number; uniqueTokens: number };
}

const dataset = quranJson as QuranDataset;

export class StaticQuranRepository implements QuranRepository {
  private readonly surahs = dataset.surahs;
  private readonly ayat = this.surahs.flatMap((surah) => surah.verses);
  private readonly surahById = new Map(this.surahs.map((surah) => [surah.surahId, surah]));
  private readonly ayahByGlobalNumber = new Map(this.ayat.map((ayah) => [ayah.globalAyahNumber, ayah]));
  private readonly normalizedSurahs = this.surahs.map((surah) => ({
    surah,
    haystack: normalizeArabic(`${surah.name} ${surah.transliteration} ${surah.surahId}`)
  }));
  private index: QuranSearchIndex | null = null;

  private getIndex(): QuranSearchIndex {
    if (!this.index) this.index = new QuranSearchIndex(this.surahs);
    return this.index;
  }

  getMetadata(): QuranDataset['meta'] {
    return dataset.meta;
  }

  getSurahs(): Surah[] {
    return this.surahs;
  }

  getSurah(surahId: number): Surah | undefined {
    return this.surahById.get(surahId);
  }

  getAyah(surahId: number, ayahNumber: number): Ayah | undefined {
    return this.surahById.get(surahId)?.verses.find((ayah) => ayah.ayahNumber === ayahNumber);
  }

  getAyahByGlobalNumber(globalAyahNumber: number): Ayah | undefined {
    return this.ayahByGlobalNumber.get(globalAyahNumber);
  }

  searchDetailed(query: string, limit = 40): AyahSearchOutcome {
    const trimmed = query.trim();
    if (!trimmed) return { hits: [], approximate: false, terms: [] };
    const index = this.getIndex();
    const reference = index.resolveReference(trimmed);
    if (reference) {
      return { hits: [{ ayah: reference, score: 1_000, matchedTerms: [], exactPhrase: true }], approximate: false, terms: [] };
    }
    return index.search(trimmed, limit);
  }

  search(query: string, limit = 50): Ayah[] {
    return this.searchDetailed(query, limit).hits.map((hit: AyahSearchHit) => hit.ayah);
  }

  searchSurahs(query: string, limit = 10): Surah[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const normalized = normalizeArabic(trimmed).replace(/\bسوره\b/g, '').trim();
    if (!normalized) return [];
    const matched = this.normalizedSurahs
      .filter((entry) => entry.haystack.includes(normalized))
      .map((entry) => entry.surah);
    return matched.slice(0, limit);
  }

  warmUp(): void {
    this.getIndex().build();
  }

  isSearchReady(): boolean {
    return this.index?.isReady ?? false;
  }

  searchStats(): { ayat: number; tokens: number; uniqueTokens: number } {
    return this.getIndex().stats;
  }
}

export const quranRepository = new StaticQuranRepository();

/** يبني فهرس البحث في وقت الخمول حتى لا يتأخر أول رسم للتطبيق. */
export function scheduleSearchWarmUp(): void {
  if (typeof window === 'undefined') return;
  const run = () => quranRepository.warmUp();
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === 'function') idle(run, { timeout: 2500 });
  else window.setTimeout(run, 1200);
}
