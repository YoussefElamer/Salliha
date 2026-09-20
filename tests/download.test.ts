import { describe, expect, it, beforeEach, vi } from 'vitest';
import { CacheDownloadRepository } from '../src/downloads/DownloadRepository';
import { reciters } from '../src/audio/reciters';
import { quranRepository } from '../src/quran/QuranRepository';

function mockCachesWithStore(store: Map<string, unknown>) {
  // @ts-ignore
  global.caches = {
    open: vi.fn(async () => ({
      match: vi.fn(async (req: { url: string } | string) => {
        const url = typeof req === 'string' ? req : req.url;
        return store.get(url) ?? undefined;
      }),
      put: vi.fn(async (req: { url: string } | string, res: unknown) => {
        const url = typeof req === 'string' ? req : req.url;
        store.set(url, res);
      }),
    })),
  } as unknown as CacheStorage;
}

describe('DownloadRepository (Cache API)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('caches surah verses and tracks progress', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    // mock fetch to return mock response with clone + blob
    const mockBlob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
    global.fetch = vi.fn(async () => ({
      ok: true,
      clone: () => ({ blob: async () => mockBlob }),
      blob: async () => mockBlob,
    })) as unknown as typeof fetch;
    // mock Request
    // @ts-ignore
    global.Request = class Request {
      url: string;
      constructor(url: string) { this.url = url; }
    } as unknown as typeof Request;

    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(112)!.verses; // 4 ayat
    const reciter = reciters[0];
    const progress: number[] = [];
    const record = await repo.cacheSurah(reciter, verses, (r) => progress.push(r.downloadedAyat));
    expect(record.status).toBe('complete');
    expect(record.downloadedAyat).toBe(4);
    expect(record.surahId).toBe(112);
    expect(progress.length).toBeGreaterThan(0);
    expect(repo.list()).toHaveLength(1);
  });

  it('throws when Cache API unsupported', async () => {
    // @ts-ignore
    delete global.caches;
    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(1)!.verses.slice(0, 1);
    await expect(repo.cacheSurah(reciters[0], verses)).rejects.toThrow('غير مدعوم');
  });

  it('handles fetch failure gracefully', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, clone: () => ({ blob: async () => new Blob([]) }) })) as unknown as typeof fetch;
    // @ts-ignore
    global.Request = class Request { url: string; constructor(url: string) { this.url = url; } } as unknown as typeof Request;
    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(1)!.verses.slice(0, 1);
    await expect(repo.cacheSurah(reciters[0], verses)).rejects.toThrow();
    expect(repo.list()[0].status).toBe('error');
  });

  it('skips already cached ayahs', async () => {
    const store = new Map<string, unknown>();
    mockCachesWithStore(store);
    let fetchCalls = 0;
    global.fetch = vi.fn(async () => {
      fetchCalls++;
      const b = new Blob(['x']);
      return { ok: true, clone: () => ({ blob: async () => b }) } as unknown as Response;
    }) as unknown as typeof fetch;
    // @ts-ignore
    global.Request = class Request { url: string; constructor(url: string) { this.url = url; } } as unknown as typeof Request;
    const repo = new CacheDownloadRepository();
    const verses = quranRepository.getSurah(112)!.verses.slice(0, 2);
    // pre-populate one ayah as cached
    const firstUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${verses[0].globalAyahNumber}.mp3`;
    store.set(firstUrl, { ok: true });
    await repo.cacheSurah(reciters[0], verses);
    // fetch should be called only for the uncached one
    expect(fetchCalls).toBe(1);
  });
});
