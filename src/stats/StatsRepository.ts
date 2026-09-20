import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { hifzRepository } from '../hifz/HifzRepository';
import { adhkarRepository } from '../adhkar/AdhkarRepository';
import { prayerRepository } from '../prayer/PrayerRepository';
import { locationLabel } from '../geo/cities';
import { quranRepository } from '../quran/QuranRepository';

export interface UserStats {
  reading: { totalBookmarks: number; lastPosition: { surahName: string; ayahNumber: number } | null; totalSurahsStarted: number };
  hifz: ReturnType<typeof hifzRepository.getStats>;
  prayer: { city: string; nextPrayer: string; notificationsEnabled: boolean };
  adhkar: { totalAdhkar: number; countersUsed: number };
  quran: { totalSurahs: number; totalAyahs: number };
}

export class StatsRepository {
  getStats(): UserStats {
    const bookmarks = bookmarkRepository.list();
    const last = bookmarkRepository.getReadingPosition();
    const prayerSettings = prayerRepository.getSettings();
    const next = prayerRepository.getNextPrayer();
    const locationInfo = prayerRepository.getLocation();
    const adhkarItems = adhkarRepository.list();
    // countersUsed: how many adhkar ids have non-zero counter
    let countersUsed = 0;
    for (const item of adhkarItems.slice(0, 50)) {
      if (adhkarRepository.getCounter(item.id) > 0) countersUsed++;
    }
    return {
      reading: {
        totalBookmarks: bookmarks.length,
        lastPosition: last ? { surahName: quranRepository.getSurah(last.surahId)?.name ?? String(last.surahId), ayahNumber: last.ayahNumber } : null,
        totalSurahsStarted: new Set(bookmarks.map((b) => b.surahId)).size,
      },
      hifz: hifzRepository.getStats(),
      prayer: {
        city: locationLabel(locationInfo),
        nextPrayer: next.name,
        notificationsEnabled: prayerSettings.notificationsEnabled,
      },
      adhkar: {
        totalAdhkar: adhkarItems.length,
        countersUsed,
      },
      quran: {
        totalSurahs: 114,
        totalAyahs: 6236,
      },
    };
  }
}

export const statsRepository = new StatsRepository();
