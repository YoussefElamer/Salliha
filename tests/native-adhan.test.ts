import { describe, expect, it, vi, beforeEach } from 'vitest';
import { __testing } from '../src/notifications/NativeAdhanService';
import type { PrayerTime } from '../src/core/types';

describe('NativeAdhanService — web fallback', () => {
  it('web fallback schedules 0 and returns honest message', async () => {
    const service = new __testing.WebFallbackAdhanService();
    const times: PrayerTime[] = [
      { name: 'الفجر', time: new Date(Date.now() + 60_000), iso: new Date().toISOString(), status: 'upcoming' },
      { name: 'الظهر', time: new Date(Date.now() + 120_000), iso: new Date().toISOString(), status: 'upcoming' },
    ];
    const result = await service.scheduleDaily(times, { prePrayerMinutes: 5, enabled: { الفجر: true, الظهر: true } as Record<string, boolean>, silentMode: false });
    expect(result.scheduled).toBe(0);
    expect(result.platform).toBe('web');
    expect(result.message).toContain('المتصفح لا يدعم');
  });

  it('web fallback requestPermission delegates to Notification when available', async () => {
    const service = new __testing.WebFallbackAdhanService();
    // mock Notification
    const original = (global as unknown as { Notification?: unknown }).Notification;
    // @ts-ignore
    global.Notification = { requestPermission: vi.fn(async () => 'granted') };
    // also mock window Notification check inside service (it checks window)
    // @ts-ignore
    global.window.Notification = global.Notification;
    const perm = await service.requestPermission();
    expect(perm).toBe('granted');
    // @ts-ignore
    if (original) global.Notification = original as unknown as Notification; else delete (global as unknown as { Notification?: unknown }).Notification;
  });
});

describe('CapacitorAdhanService — mocked', () => {
  beforeEach(() => vi.resetAllMocks());

  it('capacitor service reports capacitor platform', () => {
    const svc = new __testing.CapacitorAdhanService();
    expect(svc.isCapacitor()).toBe(true);
    expect(svc.isSupported()).toBe(true);
  });
});
