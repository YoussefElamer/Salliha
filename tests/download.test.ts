import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheDownloadRepository } from '../src/downloads/DownloadRepository';
import { reciters } from '../src/audio/reciters';
import { quranRepository } from '../src/quran/QuranRepository';

function makeResponse(size: number) {
  const blob = new Blob(['x'.repeat(size)], { type: 'audio/mpeg' });
  const response = {
    ok: true,
    blob: async () => blob,
    clone: () => ({ blob: async () => blob, ok: true })
  };
  return response;
}

function mockCachesWithStore(store: Map<string, unknown>) {
  // @ts-ignore
  global.caches = {
    open: vi.fn(async () => ({
      match: vi.fn(async (req: { url: string } | string) => store.get(typeof req === 'string' ? req : req.url)),
      put: vi.fn(async (req: { url: string } | string, res: unknown) => {
        store.set(typeof req === 'string' ? req : req.url, res);
      }),
      delete: vi.fn(async (req: { url: string } | string) => store.delete(typeof req === 'string' ? req : req.url)),
      keys: vi.fn(async () => [...store.keys()].map((url) => ({ url })))
    })),
    keys: vi.fn(async () => ['salliha-audio-v1']),
    delete: vi.fn(async () => true)
  } as unknown as CacheStorage;
}

describe('DownloadRepository (Cache API)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // @ts-ignore
    global.Request = class Request {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
    } as unknown as typeof Request;
  });

  it('يحفظ السورة ويتابع التقدم', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    global.fetch = vi.fn(async () => makeResponse(2048)) as unknown as typeof fetch;

    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(112)!.verses;
    const progress: number[] = [];
    const record = await repo.cacheSurah(reciters[0], verses, (r) => progress.push(r.downloadedAyat));
    expect(record.status).toBe('complete');
    expect(record.downloadedAyat).toBe(4);
    expect(record.bytes).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(4);
    expect(repo.list()).toHaveLength(1);
  });

  it('يرمي خطأً عندما لا يدعم المتصفح Cache API', async () => {
    // @ts-ignore
    delete global.caches;
    const repo = new CacheDownloadRepository();
    await expect(repo.cacheSurah(reciters[0], quranRepository.getSurah(1)!.verses)).rejects.toThrow(/غير مدعوم/);
  });

  it('يتعامل مع فشل الشبكة بتسجيل حالة الخطأ', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response) as unknown as typeof fetch;
    const repo = new CacheDownloadRepository();
    await expect(repo.cacheSurah(reciters[0], quranRepository.getSurah(112)!.verses)).rejects.toThrow(/تعذر تحميل تلاوة/);
    expect(repo.list()[0]?.status).toBe('error');
  });

  it('يتجاوز الآيات المحفوظة مسبقًا', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    const fetchMock = vi.fn(async () => makeResponse(512));
    global.fetch = fetchMock as unknown as typeof fetch;
    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(112)!.verses;
    await repo.cacheSurah(reciters[0], verses);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await repo.cacheSurah(reciters[0], verses);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('لا يعيد رابطًا محليًا لتلاوة غير محفوظة', async () => {
    mockCachesWithStore(new Map());
    const repo = new CacheDownloadRepository();
    const local = await repo.cachedObjectUrl('https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3');
    expect(local).toBeNull();
  });
});
