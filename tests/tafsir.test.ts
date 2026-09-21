import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlQuranCloudTafsirRepository } from '../src/tafsir/TafsirRepository';

describe('TafsirRepository', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function repo() {
    return new AlQuranCloudTafsirRepository();
  }

  it('يجلب التفسير ويعيد بيانات المصدر', async () => {
    global.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          data: { text: 'هذا تفسير الميسر لآية الاختبار.', edition: { name: 'تفسير الميسر — King Fahad Quran Complex' } }
        })
      }) as unknown as Response
    );
    const entry = await repo().getTafsir(1, 1);
    expect(entry.text).toBe('هذا تفسير الميسر لآية الاختبار.');
    expect(entry.sourceName).toContain('الميسر');
    expect(entry.surahId).toBe(1);
    expect(entry.ayahNumber).toBe(1);
  });

  it('يرمي خطأً واضحًا عند استجابة غير ناجحة', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response);
    await expect(repo().getTafsir(3, 7)).rejects.toThrow(/تعذر تحميل التفسير/);
  });

  it('يرمي خطأً عند عدم وجود نص في الاستجابة', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }) as unknown as Response);
    await expect(repo().getTafsir(2, 255)).rejects.toThrow(/لم يرجع المصدر/);
  });

  it('يعرض رسالة عربية عند انقطاع الشبكة', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('Network offline');
    });
    await expect(repo().getTafsir(4, 5)).rejects.toThrow(/التفسير يحتاج إنترنت/);
  });

  it('يستخدم النقطة الصحيحة لكل آية', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { text: 'x', edition: { name: 'y' } } }) }) as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    await repo().getTafsir(70, 5);
    expect(fetchMock).toHaveBeenCalledWith('https://api.alquran.cloud/v1/ayah/70:5/ar.muyassar');
  });

  it('يخزّن التفسير محليًا ويعمل بدون شبكة بعد أول تحميل', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { text: 'نص محفوظ', edition: { name: 'الميسر' } } }) }) as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const first = repo();
    await first.getTafsir(18, 10);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const second = repo();
    const cachedEntry = await second.getTafsir(18, 10);
    expect(cachedEntry.text).toBe('نص محفوظ');
  });
});
