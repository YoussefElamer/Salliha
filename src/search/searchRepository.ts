import type { AdhkarItem, Ayah, SearchResult, Surah } from '../core/types';
import { normalizeArabic } from '../core/arabic';
import { adhkarRepository } from '../adhkar/AdhkarRepository';
import { quranRepository } from '../quran/QuranRepository';
import { filterReciters } from '../audio/reciters';

export interface AppSearchRepository {
  search(query: string, options?: { limit?: number }): SearchResult[];
}

interface CachedQuery {
  results: SearchResult[];
  timestamp: number;
}

const CACHE_LIMIT = 40;

/**
 * بحث موحّد يعمل بالكامل على الجهاز:
 *  - الآيات: فهرس معكوس مرجّح (يتعامل مع التشكيل والهمزات و«ال» التعريف والبادئات).
 *  - السور: بالاسم أو الرقم.
 *  - الأذكار والقرّاء: مطابقة عادية سريعة.
 */
export class LocalAppSearchRepository implements AppSearchRepository {
  private cache = new Map<string, CachedQuery>();

  search(query: string, options: { limit?: number } = {}): SearchResult[] {
    const normalized = normalizeArabic(query);
    if (!normalized) return [];
    const limit = options.limit ?? 60;
    const cacheKey = `${normalized}|${limit}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < 60_000) return cached.results;

    const results: SearchResult[] = [];

    const ayahOutcome = quranRepository.searchDetailed(query, Math.min(30, limit));
    ayahOutcome.hits.forEach((hit, index) => {
      results.push({
        id: `ayah-${hit.ayah.id}`,
        type: 'ayah',
        title: `${hit.ayah.surahName} — الآية ${hit.ayah.ayahNumber}`,
        subtitle: `سورة ${hit.ayah.surahId} · ${hit.exactPhrase ? 'تطابق كامل للنص' : 'كلمات مطابقة'}`,
        text: hit.ayah.text,
        score: 1000 - index,
        payload: hit.ayah
      });
    });

    const surahs: Surah[] = quranRepository.searchSurahs(query, 6);
    surahs.forEach((surah, index) => {
      results.push({
        id: `surah-${surah.surahId}`,
        type: 'surah',
        title: `سورة ${surah.name}`,
        subtitle: `${surah.ayahCount} آية · ${surah.revelationType === 'meccan' ? 'مكية' : 'مدنية'}`,
        score: 800 - index,
        payload: surah
      });
    });

    const adhkar: AdhkarItem[] = adhkarRepository.search(query).slice(0, 8);
    adhkar.forEach((item, index) => {
      results.push({
        id: `adhkar-${item.id}`,
        type: 'adhkar',
        title: item.categories[0] ?? 'ذكر',
        subtitle: item.countDescription,
        text: item.content,
        score: 600 - index,
        payload: item
      });
    });

    if (normalized.length >= 3) {
      filterReciters(query)
        .slice(0, 5)
        .forEach((reciter, index) => {
          results.push({
            id: `reciter-${reciter.id}`,
            type: 'reciter',
            title: reciter.name,
            subtitle: reciter.description,
            score: 400 - index,
            payload: reciter
          });
        });
    }

    const sliced = results.slice(0, limit);
    this.cache.set(cacheKey, { results: sliced, timestamp: now });
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    return sliced;
  }

  isAyah(result: SearchResult): result is SearchResult & { payload: Ayah } {
    return result.type === 'ayah';
  }
}

export const appSearchRepository = new LocalAppSearchRepository();
