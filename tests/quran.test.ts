import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { quranRepository } from '../src/quran/QuranRepository';

const expectedCounts = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

describe('Quran data', () => {
  it('passes the release validation script', () => {
    expect(() => execFileSync('node', ['scripts/validate-quran.mjs'], { stdio: 'pipe' })).not.toThrow();
  });

  it('contains 114 surahs and 6236 ayat with known counts', () => {
    const surahs = quranRepository.getSurahs();
    expect(surahs).toHaveLength(114);
    expect(surahs.reduce((sum, surah) => sum + surah.ayahCount, 0)).toBe(6236);
    expect(surahs.map((surah) => surah.ayahCount)).toEqual(expectedCounts);
  });

  it('keeps ayah relationships consistent', () => {
    for (const surah of quranRepository.getSurahs()) {
      expect(surah.surahId).toBe(surah.order);
      surah.verses.forEach((ayah, index) => {
        expect(ayah.surahId).toBe(surah.surahId);
        expect(ayah.surahName).toBe(surah.name);
        expect(ayah.ayahNumber).toBe(index + 1);
        expect(ayah.text.length).toBeGreaterThan(0);
      });
    }
  });

  it('finds heard ayah fragments without diacritics', () => {
    const result = quranRepository.search('فاصبر صبرا جميلا', 3)[0];
    expect(result.surahId).toBe(70);
    expect(result.ayahNumber).toBe(5);
  });

  it('supports direct numeric references', () => {
    const result = quranRepository.search('2:255', 1)[0];
    expect(result.surahId).toBe(2);
    expect(result.ayahNumber).toBe(255);
  });
});
