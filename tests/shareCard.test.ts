import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdhkarShareCard, createAyahShareCard, ensureShareFonts } from '../src/sharing/shareCard';
import type { AdhkarItem, Ayah } from '../src/core/types';

const ayah: Ayah = {
  id: '70:5',
  globalAyahNumber: 5429,
  surahId: 70,
  surahName: 'المعارج',
  ayahNumber: 5,
  orderInSurah: 5,
  text: 'فَاصْبِرْ صَبْرًا جَمِيلًا'
};

const dhikr: AdhkarItem = {
  id: 'test-dhikr',
  order: 1,
  content: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
  count: 100,
  countDescription: 'مئة مرة',
  benefit: 'حُطَّت خطاياه وإن كانت مثل زبد البحر',
  source: 'صحيح البخاري',
  sourceType: 1,
  categories: ['أذكار الصباح'],
  audioUrl: null,
  hadithText: null,
  vocabulary: null
};

interface ContextSpy {
  fillRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
}

let context: ContextSpy;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob;

function installCanvasMock(options: { width?: number; height?: number } = {}) {
  const gradient = { addColorStop: vi.fn() };
  context = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn(() => ({ width: options.width ?? 60 }) as TextMetrics)
  };
  const ctx = {
    ...context,
    fill: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    direction: '',
    textAlign: '',
    textBaseline: ''
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['png-bytes'], { type: 'image/png' }))) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
  return ctx;
}

describe('shareCard', () => {
  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    vi.restoreAllMocks();
  });

  it('ينشئ صورة PNG بأبعاد 1080×1440 ويرسم نص الآية والمرجع', async () => {
    installCanvasMock();
    const blob = await createAyahShareCard(ayah, 'light');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
    const drawnTexts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(drawnTexts.some((text) => text.includes('فَاصْبِرْ'))).toBe(true);
    expect(drawnTexts.some((text) => text.includes('المعارج'))).toBe(true);
    expect(drawnTexts.some((text) => text.includes('صليها'))).toBe(true);
  });

  it('يدعم المظهر الداكن', async () => {
    installCanvasMock();
    const blob = await createAyahShareCard(ayah, 'dark');
    expect(blob.type).toBe('image/png');
  });

  it('ينشئ بطاقة ذكر مع مصدرها', async () => {
    installCanvasMock();
    const blob = await createAdhkarShareCard(dhikr, 'light');
    expect(blob.type).toBe('image/png');
    const drawnTexts = context.fillText.mock.calls.map((call) => String(call[0]));
    expect(drawnTexts.some((text) => text.includes('سُبْحَانَ'))).toBe(true);
    expect(drawnTexts.some((text) => text.includes('أذكار الصباح'))).toBe(true);
  });

  it('يتعامل مع نص طويل دون فشل', async () => {
    installCanvasMock({ width: 900 });
    const longAyah: Ayah = { ...ayah, text: ayah.text.repeat(40) };
    const blob = await createAyahShareCard(longAyah, 'light');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('ensureShareFonts لا يفشل عند غياب واجهة الخطوط', async () => {
    await expect(ensureShareFonts()).resolves.toBeUndefined();
  });
});
