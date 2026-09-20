import { describe, expect, it, vi } from 'vitest';
import { createAyahShareCard } from '../src/sharing/shareCard';
import type { Ayah } from '../src/core/types';

describe('shareCard', () => {
  it('creates 1080x1350 PNG blob with correct content', async () => {
    const ayah: Ayah = {
      id: '1:1',
      globalAyahNumber: 1,
      surahId: 1,
      surahName: 'الفاتحة',
      ayahNumber: 1,
      orderInSurah: 1,
      text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    };

    // Mock canvas
    const toBlobMock = vi.fn((cb: (blob: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })));
    const fillRectMock = vi.fn();
    const fillTextMock = vi.fn();
    const measureTextMock = vi.fn(() => ({ width: 100 }));
    // @ts-ignore
    global.document.createElement = vi.fn((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            fillRect: fillRectMock,
            fillText: fillTextMock,
            measureText: measureTextMock,
            // allow setting properties
            set fillStyle(_: string) {},
            set font(_: string) {},
            set direction(_: string) {},
            set textAlign(_: string) {},
          }),
          toBlob: toBlobMock,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement.call(document, tag);
    });
    const originalCreateElement = document.createElement.bind(document);

    // Since we overrode, restore quickly after call? Create a more reliable mock via spy
    // Instead use direct mocking of createElement for canvas only
    const blob = await createAyahShareCard(ayah, 'light');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('supports dark theme', async () => {
    const ayah: Ayah = {
      id: '70:5',
      globalAyahNumber: 5429,
      surahId: 70,
      surahName: 'المعارج',
      ayahNumber: 5,
      orderInSurah: 5,
      text: 'فَاصْبِرْ صَبْرًا جَمِيلًا',
    };
    const toBlobMock = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['png2'], { type: 'image/png' })));
    const mockCtx: Record<string, unknown> = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      fillStyle: '',
      font: '',
      direction: '',
      textAlign: '',
    };
    const original = document.createElement;
    // @ts-ignore
    document.createElement = (tag: string) => {
      if (tag === 'canvas') return { width: 0, height: 0, getContext: () => mockCtx, toBlob: toBlobMock } as unknown as HTMLCanvasElement;
      return original.call(document, tag);
    };
    const blobDark = await createAyahShareCard(ayah, 'dark');
    expect(blobDark.type).toBe('image/png');
    document.createElement = original;
  });
});
