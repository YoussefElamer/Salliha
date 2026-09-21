import { describe, expect, it } from 'vitest';
import generated from '../src/data/adhkar/adhkar.generated.json';
import source from '../data/sources/adhkar/morning-evening-ar.json';
import hisnSource from '../data/sources/adhkar/hisnul-muslim-ar.json';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const items = generated.items;

describe('خط بيانات الأذكار', () => {
  it('يحفظ أذكار الصباح والمساء كما هي حرفيًا', () => {
    const src = source as Array<{ order: number; content: string; count: number; source: string; count_description: string }>;
    expect(items.length).toBeGreaterThan(src.length);
    for (let index = 0; index < src.length; index += 1) {
      const s = src[index];
      const g = items[index];
      expect(g.id).toBe(`mae-${String(s.order).padStart(3, '0')}`);
      expect(g.order).toBe(s.order);
      expect(g.content).toBe(s.content);
      expect(g.count).toBe(s.count);
      expect(g.source).toBe(s.source);
      expect(g.countDescription).toBe(s.count_description);
    }
  });

  it('يضم أذكار النوم والاستيقاظ والصلاة من حصن المسلم', () => {
    const hisn = items.filter((item) => item.id.startsWith('hisn-'));
    expect(hisn.length).toBeGreaterThan(250);
    expect(hisn.length).toBe(hisnSource.data.length - hisnSource.data.filter((item) => /^المقدمة$|^فضل |^كيف كان النبي|^من أنواع الخير/.test(item.section)).length);
    const categories = new Set(hisn.flatMap((item) => item.categories));
    for (const expected of ['أذكار النوم', 'أذكار الاستيقاظ', 'أذكار الصلاة', 'المنزل والوضوء', 'السفر والحل والترحال']) {
      expect(categories.has(expected)).toBe(true);
    }
    expect(hisnSource.data.some((item) => item.section === 'أذكار النوم')).toBe(true);
  });

  it('لا يعرض مواضع الفضائل كأذكار تُعدّ', () => {
    expect(items.some((item) => (item.section ?? '').startsWith('فضل '))).toBe(false);
    expect(items.some((item) => item.section === 'المقدمة')).toBe(false);
  });

  it('كل ذكر له تصنيف وعدد صحيح ووصف للعدد', () => {
    for (const item of items) {
      expect(item.content.length).toBeGreaterThan(0);
      expect(item.count).toBeGreaterThan(0);
      expect(Number.isInteger(item.count)).toBe(true);
      expect(item.countDescription.length).toBeGreaterThan(0);
      expect(item.categories.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
      for (const category of item.categories) expect(generated.categories).toContain(category);
    }
  });

  it('يعرّف أعداد التكرار المعروفة (٣٣ و١٠٠ و٣)', () => {
    const counts = new Set(items.map((item) => item.count));
    expect(counts.has(33)).toBe(true);
    expect(counts.has(100)).toBe(true);
    expect(counts.has(3)).toBe(true);
    const thirties = items.find((item) => item.count === 33);
    expect(thirties?.countDescription).toContain('33');
  });

  it('بصمات SHA-256 تطابق ملفات المصدر', () => {
    const morningHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/morning-evening-ar.json'))).digest('hex');
    const expectedMorning = fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/morning-evening-ar.sha256'), 'utf8').trim().split(/\s+/)[0];
    expect(morningHash).toBe(expectedMorning);
    expect(generated.meta.sourceSha256).toBe(expectedMorning);

    const hisnHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/hisnul-muslim-ar.json'))).digest('hex');
    const expectedHisn = fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/hisnul-muslim-ar.sha256'), 'utf8').trim().split(/\s+/)[0];
    expect(hisnHash).toBe(expectedHisn);
    expect(generated.meta.hisnSourceSha256).toBe(expectedHisn);
  });

  it('لا توجد معرّفات مكررة', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('يذكر الإسناد والترخيص في بيانات التعريف', () => {
    expect(generated.meta.license).toContain('CC-BY-4.0');
    expect(generated.meta.attribution).toContain('حصن المسلم');
  });
});
