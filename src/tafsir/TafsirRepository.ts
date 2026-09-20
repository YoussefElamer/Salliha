import type { TafsirEntry } from '../core/types';
import { storage } from '../core/storage';

export interface TafsirRepository {
  getTafsir(surahId: number, ayahNumber: number): Promise<TafsirEntry>;
  getCached(surahId: number, ayahNumber: number): TafsirEntry | null;
  clearCache(): void;
}

interface CacheShape {
  entries: Record<string, TafsirEntry>;
}

const CACHE_KEY = 'tafsir-cache:v1';
const CACHE_LIMIT = 300;

/** تفسير الميسر مع تخزين محلي دائم — يعمل بدون إنترنت بعد أول تحميل للآية. */
export class AlQuranCloudTafsirRepository implements TafsirRepository {
  private readCache(): CacheShape {
    return storage.get<CacheShape>(CACHE_KEY, { entries: {} });
  }

  getCached(surahId: number, ayahNumber: number): TafsirEntry | null {
    return this.readCache().entries[`${surahId}:${ayahNumber}`] ?? null;
  }

  clearCache(): void {
    storage.set(CACHE_KEY, { entries: {} });
  }

  private save(entry: TafsirEntry): void {
    const cache = this.readCache();
    const keys = Object.keys(cache.entries);
    if (keys.length >= CACHE_LIMIT) {
      // نُبقي آخر ٣٠٠ مدخل فقط لتقليل استهلاك التخزين.
      for (const key of keys.slice(0, keys.length - CACHE_LIMIT + 1)) delete cache.entries[key];
    }
    cache.entries[`${entry.surahId}:${entry.ayahNumber}`] = { ...entry, sourceUrl: 'https://quranenc.com/ar/browse/arabic_moyassar' };
    storage.set(CACHE_KEY, cache);
  }

  async getTafsir(surahId: number, ayahNumber: number): Promise<TafsirEntry> {
    const cached = this.getCached(surahId, ayahNumber);
    if (cached) return cached;

    const endpoint = `https://api.alquran.cloud/v1/ayah/${surahId}:${ayahNumber}/ar.muyassar`;
    let response: Response;
    try {
      response = await fetch(endpoint);
    } catch {
      throw new Error('تعذر الاتصال بمصدر التفسير. التفسير يحتاج إنترنت أول مرة لكل آية، ثم يُحفظ على الجهاز.');
    }
    if (!response.ok) {
      throw new Error('تعذر تحميل التفسير من المصدر. جرّب لاحقًا أو تحقق من الاتصال.');
    }
    const payload = (await response.json()) as { data?: { text?: string; edition?: { name?: string; englishName?: string } } };
    const text = payload.data?.text;
    if (!text) throw new Error('لم يرجع المصدر نص تفسير لهذه الآية.');
    const entry: TafsirEntry = {
      sourceName: payload.data?.edition?.name ?? 'تفسير الميسر — مجمع الملك فهد',
      sourceUrl: endpoint,
      surahId,
      ayahNumber,
      text
    };
    this.save(entry);
    return entry;
  }
}

export const tafsirRepository = new AlQuranCloudTafsirRepository();
