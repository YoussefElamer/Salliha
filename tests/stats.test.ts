import { describe, expect, it, beforeEach } from 'vitest';
import { statsRepository } from '../src/stats/StatsRepository';
import { bookmarkRepository } from '../src/bookmarks/BookmarkRepository';
import { hifzRepository } from '../src/hifz/HifzRepository';

describe('StatsRepository', () => {
  beforeEach(() => localStorage.clear());

  it('returns aggregated stats locally', () => {
    bookmarkRepository.add(1, 1, 'test');
    bookmarkRepository.saveReadingPosition({ surahId: 2, ayahNumber: 255 });
    hifzRepository.createPlan({ title: 'حفظ', surahId: 112, fromAyah: 1, toAyah: 4, dailyGoal: 2 });
    const stats = statsRepository.getStats();
    expect(stats.reading.totalBookmarks).toBe(1);
    expect(stats.reading.lastPosition?.ayahNumber).toBe(255);
    expect(stats.quran.totalSurahs).toBe(114);
    expect(stats.quran.totalAyahs).toBe(6236);
    expect(stats.hifz.totalPlans).toBe(1);
    expect(stats.prayer.city).toBeTruthy();
  });
});
