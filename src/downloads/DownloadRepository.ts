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
  status: 'idle' | 'downloading' | 'complete' | 'error' | 'cancelled';
  updatedAt: string;
}

export interface DownloadRepository {
  list(): DownloadRecord[];
  cacheSurah(reciter: Reciter, verses: Ayah[], onProgress?: (record: DownloadRecord) => void): Promise<DownloadRecord>;
  delete(recordId: string): Promise<void>;
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

  async cacheSurah(reciter: Reciter, verses: Ayah[], onProgress?: (record: DownloadRecord) => void): Promise<DownloadRecord> {
    if (!('caches' in window)) throw new Error('التخزين المحلي للملفات الصوتية غير مدعوم في هذا المتصفح.');
    const cache = await caches.open(CACHE);
    let bytes = 0;
    const record: DownloadRecord = {
      id: `${reciter.id}:${verses[0]?.surahId ?? 0}`,
      reciterId: reciter.id,
      surahId: verses[0]?.surahId ?? 0,
      ayahCount: verses.length,
      downloadedAyat: 0,
      bytes: 0,
      status: 'downloading',
      updatedAt: new Date().toISOString()
    };
    this.save(record);
    onProgress?.(record);
    try {
      for (const ayah of verses) {
        const request = new Request(ayahAudioUrl(reciter.id, ayah.globalAyahNumber), { mode: 'cors' });
        const cached = await cache.match(request);
        if (!cached) {
          const response = await fetch(request);
          if (!response.ok) throw new Error(`تعذر تحميل تلاوة الآية ${ayah.ayahNumber}`);
          const clone = response.clone();
          const blob = await clone.blob();
          bytes += blob.size;
          await cache.put(request, response);
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
    storage.set(KEY, this.list().filter((item) => item.id !== recordId));
  }
}

export const downloadRepository = new CacheDownloadRepository();
