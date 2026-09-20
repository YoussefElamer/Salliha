import { describe, expect, it, beforeEach } from 'vitest';
import { LocalHifzRepository } from '../src/hifz/HifzRepository';

describe('HifzRepository', () => {
  beforeEach(() => localStorage.clear());

  it('creates plan with validation', () => {
    const repo = new LocalHifzRepository();
    const plan = repo.createPlan({ title: 'البقرة 1-5', surahId: 2, fromAyah: 1, toAyah: 5, dailyGoal: 2 });
    expect(plan.surahId).toBe(2);
    expect(repo.listPlans()).toHaveLength(1);
    expect(() => repo.createPlan({ title: 'x', surahId: 2, fromAyah: 10, toAyah: 5, dailyGoal: 2 })).toThrow();
    expect(() => repo.createPlan({ title: 'x', surahId: 999, fromAyah: 1, toAyah: 5, dailyGoal: 2 })).toThrow();
  });

  it('marks progress and dedupes same day', () => {
    const repo = new LocalHifzRepository();
    const plan = repo.createPlan({ title: 'p', surahId: 1, fromAyah: 1, toAyah: 7, dailyGoal: 3 });
    const today = '2026-09-20';
    repo.markProgress(plan.id, [{ surahId: 1, ayahNumber: 1 }], today);
    repo.markProgress(plan.id, [{ surahId: 1, ayahNumber: 1 }, { surahId: 1, ayahNumber: 2 }], today);
    const progresses = repo.listProgress();
    expect(progresses).toHaveLength(1);
    expect(progresses[0].completedAyahs).toBe(2);
  });

  it('computes stats and streak', () => {
    const repo = new LocalHifzRepository();
    const plan = repo.createPlan({ title: 'p', surahId: 113, fromAyah: 1, toAyah: 5, dailyGoal: 1 });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    repo.markProgress(plan.id, [{ surahId: 113, ayahNumber: 1 }], yesterday);
    repo.markProgress(plan.id, [{ surahId: 113, ayahNumber: 2 }], today);
    const stats = repo.getStats();
    expect(stats.totalMemorized).toBe(2);
    expect(stats.streakDays).toBeGreaterThanOrEqual(1);
    expect(stats.activePlans).toBe(1);
  });

  it('due reviews returns old ayahs not reviewed today', () => {
    const repo = new LocalHifzRepository();
    const plan = repo.createPlan({ title: 'p', surahId: 1, fromAyah: 1, toAyah: 7, dailyGoal: 1 });
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    repo.markProgress(plan.id, [{ surahId: 1, ayahNumber: 1 }], old);
    const due = repo.getDueReviews();
    expect(due.length).toBe(1);
    // reviewing today removes from due
    const today = new Date().toISOString().slice(0, 10);
    repo.markProgress(plan.id, [{ surahId: 1, ayahNumber: 1 }], today);
    expect(repo.getDueReviews().length).toBe(0);
  });

  it('remove plan clears progress', () => {
    const repo = new LocalHifzRepository();
    const plan = repo.createPlan({ title: 'p', surahId: 1, fromAyah: 1, toAyah: 7, dailyGoal: 1 });
    repo.markProgress(plan.id, [{ surahId: 1, ayahNumber: 1 }]);
    repo.removePlan(plan.id);
    expect(repo.listPlans()).toHaveLength(0);
    expect(repo.listProgress()).toHaveLength(0);
  });
});
