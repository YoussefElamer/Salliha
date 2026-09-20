import type { SearchResult } from '../core/types';
import { normalizeArabic } from '../core/arabic';
import { adhkarRepository } from '../adhkar/AdhkarRepository';
import { quranRepository } from '../quran/QuranRepository';
import { reciters } from '../audio/reciters';

export interface AppSearchRepository {
  search(query: string): SearchResult[];
}

export class LocalAppSearchRepository implements AppSearchRepository {
  search(query: string): SearchResult[] {
    const normalized = normalizeArabic(query);
    if (!normalized) return [];
    const ayahResults: SearchResult[] = quranRepository.search(query, 20).map((ayah, index) => ({
      id: `ayah-${ayah.id}`,
      type: 'ayah',
      title: `${ayah.surahName} — الآية ${ayah.ayahNumber}`,
      subtitle: `سورة ${ayah.surahId}`,
      text: ayah.text,
      score: 100 - index,
      payload: ayah
    }));
    const surahResults: SearchResult[] = quranRepository
      .getSurahs()
      .filter((surah) => normalizeArabic(`${surah.name} ${surah.transliteration} ${surah.surahId}`).includes(normalized))
      .slice(0, 10)
      .map((surah, index) => ({
        id: `surah-${surah.surahId}`,
        type: 'surah',
        title: `سورة ${surah.name}`,
        subtitle: `${surah.ayahCount} آية`,
        score: 80 - index,
        payload: surah
      }));
    const adhkarResults: SearchResult[] = adhkarRepository.search(query).slice(0, 10).map((item, index) => ({
      id: `adhkar-${item.id}`,
      type: 'adhkar',
      title: item.categories[0],
      subtitle: item.countDescription,
      text: item.content,
      score: 70 - index,
      payload: item
    }));
    const reciterResults: SearchResult[] = reciters
      .filter((reciter) => normalizeArabic(`${reciter.name} ${reciter.id}`).includes(normalized))
      .map((reciter, index) => ({
        id: `reciter-${reciter.id}`,
        type: 'reciter',
        title: reciter.name,
        subtitle: reciter.source,
        score: 60 - index,
        payload: reciter
      }));
    return [...ayahResults, ...surahResults, ...adhkarResults, ...reciterResults].sort((a, b) => b.score - a.score);
  }
}

export const appSearchRepository = new LocalAppSearchRepository();
