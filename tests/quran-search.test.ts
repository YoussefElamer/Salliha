import { describe, expect, it } from 'vitest';
import { quranRepository } from '../src/quran/QuranRepository';
import { appSearchRepository } from '../src/search/searchRepository';
import type { Ayah } from '../src/core/types';

function top(query: string, count = 5): Ayah[] {
  return quranRepository.search(query, count);
}

describe('محرك بحث القرآن', () => {
  it('يجد الآية الصحيحة أولًا مع البحث بجملة كاملة بدون تشكيل', () => {
    const results = top('فاصبر صبرا جميلا');
    expect(results[0].surahId).toBe(70);
    expect(results[0].ayahNumber).toBe(5);
  });

  it('يتجاهل التشكيل في الاستعلام نفسه', () => {
    const results = top('فَاصْبِرْ صَبْرًا جَمِيلًا');
    expect(results[0].surahId).toBe(70);
    expect(results[0].ayahNumber).toBe(5);
  });

  it('يجد ببادئة كلمة ناقصة أثناء الكتابة', () => {
    const results = top('صبرا جمي');
    expect(results[0].surahId).toBe(70);
  });

  it('يجد بكلمة واحدة شائعة دون أن يتعطل البحث', () => {
    const results = top('الرحمن', 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('يوحّد الهمزات والألفات والتاء المربوطة', () => {
    const hamza = top('اصبر صبرا جميلا');
    expect(hamza[0].surahId).toBe(70);
    const taMarbuta = quranRepository.search('سوره البقره', 5);
    expect(taMarbuta.length).toBeGreaterThan(0);
  });

  it('يفهم المراجع الرقمية واسم السورة مع رقم الآية', () => {
    expect(top('2:255')[0].ayahNumber).toBe(255);
    expect(top('البقرة 255')[0].surahId).toBe(2);
    expect(top('٧٠:٥')[0].surahId).toBe(70);
  });

  it('يبحث في أسماء السور', () => {
    const surahs = quranRepository.searchSurahs('كهف');
    expect(surahs[0].surahId).toBe(18);
    expect(quranRepository.searchSurahs('11')[0].surahId).toBe(11);
  });

  it('يرتّب النتائج بحيث يتقدم التطابق الكامل للنص', () => {
    const results = top('ان الله مع الصابرين', 8);
    expect(`${results[0].surahId}:${results[0].ayahNumber}`).toBe('2:153');
    const similar = top('ان الله مع الذين اتقوا', 8);
    expect(`${similar[0].surahId}:${similar[0].ayahNumber}`).toBe('16:128');
  });

  it('يعطي نتائج أسرع من 120 مللي ثانية بعد بناء الفهرس', () => {
    quranRepository.warmUp();
    const started = performance.now();
    for (const query of ['الصبر', 'الجنة', 'موسى', 'فاصبر صبرا جميلا', 'يوسف', 'الرحمن الرحيم']) {
      quranRepository.search(query, 20);
    }
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(600);
  });

  it('البحث الموحّد يجمع الآيات والسور والأذكار', () => {
    const results = appSearchRepository.search('الصبر');
    expect(results.some((result) => result.type === 'ayah')).toBe(true);
    const surahResults = appSearchRepository.search('الكهف');
    expect(surahResults.some((result) => result.type === 'surah')).toBe(true);
  });

  it('لا يعيد نتائج فارغة لاستعلام فارغ', () => {
    expect(quranRepository.search('   ', 5)).toEqual([]);
    expect(appSearchRepository.search('')).toEqual([]);
  });

  it('يبني فهرس البحث لكل الآيات', () => {
    quranRepository.warmUp();
    const stats = quranRepository.searchStats();
    expect(stats.ayat).toBe(6236);
    expect(stats.uniqueTokens).toBeGreaterThan(5000);
  });
});
