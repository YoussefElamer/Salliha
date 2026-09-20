import { describe, expect, it } from 'vitest';
import generated from '../src/data/adhkar/adhkar.generated.json';
import source from '../data/sources/adhkar/morning-evening-ar.json';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

describe('Adhkar data pipeline', () => {
  it('generated adhkar count matches source count', () => {
    expect(generated.items.length).toBe((source as unknown[]).length);
    expect(generated.items.length).toBeGreaterThan(0);
  });

  it('generated adhkar content is copied verbatim, no paraphrasing', () => {
    const src = source as Array<{ order: number; content: string; count: number; source: string; count_description: string }>;
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      const g = generated.items[i];
      expect(g.order).toBe(s.order);
      expect(g.content).toBe(s.content);
      expect(g.count).toBe(s.count);
      expect(g.source).toBe(s.source);
      expect(g.countDescription).toBe(s.count_description);
    }
  });

  it('each item has categories and required fields', () => {
    for (const item of generated.items) {
      expect(item.id).toMatch(/^mae-\d{3}$/);
      expect(item.content.length).toBeGreaterThan(0);
      expect(item.count).toBeGreaterThan(0);
      expect(Array.isArray(item.categories) && item.categories.length > 0).toBe(true);
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it('categories are from allowed set', () => {
    const allowed = new Set(['أذكار الصباح', 'أذكار المساء', 'أذكار الصباح والمساء', 'الاستغفار']);
    for (const cat of generated.categories) {
      expect(allowed.has(cat)).toBe(true);
    }
    for (const item of generated.items) {
      for (const cat of item.categories) expect(allowed.has(cat)).toBe(true);
    }
  });

  it('SHA-256 metadata matches source file', () => {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/morning-evening-ar.json'))).digest('hex');
    const expected = fs.readFileSync(path.join(process.cwd(), 'data/sources/adhkar/morning-evening-ar.sha256'), 'utf8').trim().split(/\s+/)[0];
    expect(sha).toBe(expected);
    expect((generated.meta as { sourceSha256: string }).sourceSha256).toBe(expected);
  });

  it('has no duplicate ids', () => {
    const ids = generated.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
