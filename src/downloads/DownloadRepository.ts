import type { Ayah, Reciter } from '../core/types';
import { ayahAudioUrl } from '../audio/reciters';
import { storage } from '../core/storage';

export interface DownloadRecord {
  id: string;
  reciterId: string;
  surahId: number;
  ayahCount: number;
  downloadedAyat: number;
  bytes: number;
  bitrate: number;
  status: 'idle' | 'downloading' | 'complete' | 'error' | 'cancelled';
  updatedAt: string;
}

export interface DownloadRepository {
  list(): DownloadRecord[];
  cacheSurah(reciter: Reciter, verses: Ayah[], onProgress?: (record: DownloadRecord) => void, bitrate?: number): Promise<DownloadRecord>;
  delete(recordId: string): Promise<void>;
  /** يعيد رابطًا محليًا (blob URL) إن كانت التلاوة محفوظة، وإلا null — للتشغيل بدون إنترنت. */
  cachedObjectUrl(url: string): Promise<string | null>;
}

const KEY = 'downloads:v1';
const CACHE = 'salliha-audio-v1';

export class CacheDownloadRepository implements DownloadRepository {
  list(): DownloadRecord[] {
    return storage.get<DownloadRecord[]>(KEY, []);
  }

  private save(record: DownloadRecord): void {
    const records = this.list().filter((item) => item.id !== record.id);
    storage.set(KEY, [record, ...records]);
  }

  async cacheSurah(reciter: Reciter, verses: Ayah[], onProgress?: (record: DownloadRecord) => void, bitrate = 128): Promise<DownloadRecord> {
    if (!('caches' in window)) throw new Error('التخزين المحلي للصوت غير مدعوم في هذا المتصفح. جرّب تطبيق Android/iOS.');
    const cache = await caches.open(CACHE);
    let bytes = 0;
    const record: DownloadRecord = {
      id: `${reciter.id}:${verses[0]?.surahId ?? 0}:${bitrate}`,
      reciterId: reciter.id,
      surahId: verses[0]?.surahId ?? 0,
      ayahCount: verses.length,
      downloadedAyat: 0,
      bytes: 0,
      bitrate,
      status: 'downloading',
      updatedAt: new Date().toISOString()
    };
    this.save(record);
    onProgress?.(record);
    try {
      for (const ayah of verses) {
        const url = ayahAudioUrl(reciter.id, ayah.globalAyahNumber, bitrate);
        const cached = await cache.match(url);
        if (cached) {
          const existing = await cached.clone().blob();
          bytes += existing.size;
        } else {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`تعذر تحميل تلاوة الآية ${ayah.ayahNumber}`);
          const blob = await response.clone().blob();
          bytes += blob.size;
          await cache.put(url, response);
        }
        record.downloadedAyat += 1;
        record.bytes = bytes;
        record.updatedAt = new Date().toISOString();
        this.save(record);
        onProgress?.({ ...record });
      }
      record.status = 'complete';
      record.updatedAt = new Date().toISOString();
      this.save(record);
      onProgress?.({ ...record });
      return record;
    } catch (error) {
      record.status = 'error';
      record.updatedAt = new Date().toISOString();
      this.save(record);
      throw error;
    }
  }

  async delete(recordId: string): Promise<void> {
    const record = this.list().find((item) => item.id === recordId);
    if (record && 'caches' in window) {
      const range = await this.globalRange(record.surahId);
      const cache = await caches.open(CACHE);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((request) => request.url.includes(`/${record.reciterId}/`))
          .filter((request) => {
            const match = request.url.match(/\/(\d+)\.mp3$/);
            if (!match) return false;
            const globalNumber = Number(match[1]);
            return globalNumber >= range.start && globalNumber <= range.end;
          })
          .map((request) => cache.delete(request))
      );
    }
    storage.set(KEY, this.list().filter((item) => item.id !== recordId));
  }

  private async globalRange(surahId: number): Promise<{ start: number; end: number }> {
    const { quranRepository } = await import('../quran/QuranRepository');
    const surah = quranRepository.getSurah(surahId);
    if (!surah || !surah.verses.length) return { start: 0, end: 0 };
    return { start: surah.verses[0].globalAyahNumber, end: surah.verses[surah.verses.length - 1].globalAyahNumber };
  }

  async cachedObjectUrl(url: string): Promise<string | null> {
    if (!('caches' in window)) return null;
    try {
      const cache = await caches.open(CACHE);
      const response = await cache.match(url);
      if (!response) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}

export const downloadRepository = new CacheDownloadRepository();
