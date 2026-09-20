import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AlQuranCloudTafsirRepository } from '../src/tafsir/TafsirRepository';

describe('TafsirRepository', () => {
  const originalFetch = global.fetch;
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => { global.fetch = originalFetch; });

  it('fetches tafsir and returns source metadata', async () => {
    global.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          data: {
            text: 'هذا تفسير الميسر لآية الاختبار.',
            edition: { name: 'تفسير الميسر — King Fahad Quran Complex', englishName: 'Muyassar' },
          },
        }),
      }) as unknown as Response
    );
    const repo = new AlQuranCloudTafsirRepository();
    const entry = await repo.getTafsir(1, 1);
    expect(entry.text).toBe('هذا تفسير الميسر لآية الاختبار.');
    expect(entry.sourceName).toContain('الميسر');
    expect(entry.sourceUrl).toContain('1:1');
    expect(entry.surahId).toBe(1);
    expect(entry.ayahNumber).toBe(1);
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response);
    const repo = new AlQuranCloudTafsirRepository();
    await expect(repo.getTafsir(1, 1)).rejects.toThrow();
  });

  it('throws when payload has no text', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }) as unknown as Response);
    const repo = new AlQuranCloudTafsirRepository();
    await expect(repo.getTafsir(2, 255)).rejects.toThrow();
  });

  it('throws on network error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('Network offline'); });
    const repo = new AlQuranCloudTafsirRepository();
    await expect(repo.getTafsir(1, 5)).rejects.toThrow('Network offline');
  });

  it('uses correct endpoint per ayah', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { text: 'x', edition: { name: 'y' } } }) }) as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const repo = new AlQuranCloudTafsirRepository();
    await repo.getTafsir(70, 5);
    expect(fetchMock).toHaveBeenCalledWith('https://api.alquran.cloud/v1/ayah/70:5/ar.muyassar');
  });
});
