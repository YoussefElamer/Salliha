import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText, isNativeApp, shareText } from '../src/sharing/shareService';

describe('خدمة المشاركة (الويب/التطبيق)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, { share: undefined, canShare: undefined, clipboard: undefined });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('تنسخ النص إلى الحافظة عند عدم توفر أي مشاركة', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const outcome = await shareText({ text: 'نص اختباري' });
    expect(outcome.status).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('نص اختباري');
  });

  it('تستخدم Web Share عند توفره', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const outcome = await shareText({ text: 'نص', title: 'صليها' });
    expect(outcome.status).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('تتعامل مع إلغاء المستخدم بهدوء', async () => {
    const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { value: vi.fn(async () => { throw abort; }), configurable: true });
    const outcome = await shareText({ text: 'نص' });
    expect(outcome.status).toBe('cancelled');
  });

  it('تعمل بدون navigator.share إطلاقًا (لا تعليق)', async () => {
    const outcome = await shareText({ text: 'نص بدون مشاركة' });
    expect(['copied', 'unsupported']).toContain(outcome.status);
  });

  it('copyText يعيد رسالة واضحة عند النجاح', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
    const outcome = await copyText('نص', 'تم النسخ بنجاح');
    expect(outcome.status).toBe('copied');
    if (outcome.status === 'copied') expect(outcome.message).toBe('تم النسخ بنجاح');
  });

  it('تكتشف بيئة التطبيق الأصلي من واجهة Capacitor', () => {
    expect(isNativeApp()).toBe(false);
    (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });
});
