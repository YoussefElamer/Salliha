import quranJson from '../data/quran/quran.generated.json';
import type { Ayah, QuranDataset, Surah } from '../core/types';
import { normalizeArabic, tokenizeArabic } from '../core/arabic';

export interface QuranRepository {
  getMetadata(): QuranDataset['meta'];
  getSurahs(): Surah[];
  getSurah(surahId: number): Surah | undefined;
  getAyah(surahId: number, ayahNumber: number): Ayah | undefined;
  getAyahByGlobalNumber(globalAyahNumber: number): Ayah | undefined;
  search(query: string, limit?: number): Ayah[];
}

const dataset = quranJson as QuranDataset;

interface IndexedAyah {
  ayah: Ayah;
  normalizedText: string;
  normalizedRef: string;
}

export class StaticQuranRepository implements QuranRepository {
  private readonly surahs = dataset.surahs;
  private readonly ayat = this.surahs.flatMap((surah) => surah.verses);
  private readonly index: IndexedAyah[] = this.ayat.map((ayah) => ({
    ayah,
    normalizedText: normalizeArabic(ayah.text),
    normalizedRef: normalizeArabic(`${ayah.surahName} ${ayah.surahId} ${ayah.ayahNumber} ${ayah.surahId}:${ayah.ayahNumber}`)
  }));

  getMetadata(): QuranDataset['meta'] {
    return dataset.meta;
  }

  getSurahs(): Surah[] {
    return this.surahs;
  }

  getSurah(surahId: number): Surah | undefined {
    return this.surahs.find((surah) => surah.surahId === surahId);
  }

  getAyah(surahId: number, ayahNumber: number): Ayah | undefined {
    return this.getSurah(surahId)?.verses.find((ayah) => ayah.ayahNumber === ayahNumber);
  }

  getAyahByGlobalNumber(globalAyahNumber: number): Ayah | undefined {
    return this.ayat.find((ayah) => ayah.globalAyahNumber === globalAyahNumber);
  }

  search(query: string, limit = 50): Ayah[] {
    const normalized = normalizeArabic(query);
    if (!normalized) return [];

    const directRef = normalized.match(/^(\d{1,3})(?::|\s+)(\d{1,3})$/);
    if (directRef) {
      const ayah = this.getAyah(Number(directRef[1]), Number(directRef[2]));
      return ayah ? [ayah] : [];
    }

    const tokens = tokenizeArabic(query);
    const scored = this.index
      .map((entry) => {
        const textIncludes = entry.normalizedText.includes(normalized);
        const refIncludes = entry.normalizedRef.includes(normalized);
        const tokenMatches = tokens.filter((token) => entry.normalizedText.includes(token) || entry.normalizedRef.includes(token)).length;
        const score = (textIncludes ? 100 : 0) + (refIncludes ? 80 : 0) + tokenMatches * 12 - Math.abs(entry.normalizedText.length - normalized.length) / 500;
        return { ayah: entry.ayah, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.ayah.globalAyahNumber - b.ayah.globalAyahNumber)
      .slice(0, limit);
    return scored.map((item) => item.ayah);
  }
}

export const quranRepository = new StaticQuranRepository();
