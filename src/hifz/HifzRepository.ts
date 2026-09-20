import { createId, storage } from '../core/storage';
import { quranRepository } from '../quran/QuranRepository';

export type HifzPlanStatus = 'active' | 'paused' | 'completed';
export interface HifzPlan {
  id: string;
  title: string;
  surahId: number;
  fromAyah: number;
  toAyah: number;
  dailyGoal: number; // آيات في اليوم
  createdAt: string;
  status: HifzPlanStatus;
}

export interface HifzProgress {
  planId: string;
  date: string; // YYYY-MM-DD
  completedAyahs: number; // عدد الآيات المُنجزة اليوم
  ayahs: Array<{ surahId: number; ayahNumber: number }>;
}

export interface HifzStats {
  totalPlans: number;
  activePlans: number;
  streakDays: number;
  totalMemorized: number;
  dueReviews: number;
}

const PLANS_KEY = 'hifz:plans:v1';
const PROGRESS_KEY = 'hifz:progress:v1';

export class LocalHifzRepository {
  listPlans(): HifzPlan[] {
    return storage.get<HifzPlan[]>(PLANS_KEY, []);
  }

  createPlan(input: Omit<HifzPlan, 'id' | 'createdAt' | 'status'>): HifzPlan {
    const surah = quranRepository.getSurah(input.surahId);
    if (!surah) throw new Error('السورة غير موجودة');
    if (input.fromAyah < 1 || input.toAyah > surah.ayahCount || input.fromAyah > input.toAyah) {
      throw new Error('مجال الآيات غير صحيح');
    }
    if (input.dailyGoal < 1 || input.dailyGoal > 20) throw new Error('الهدف اليومي بين 1 و 20 آية');
    const plan: HifzPlan = { id: createId('hifz'), createdAt: new Date().toISOString(), status: 'active', ...input };
    storage.set(PLANS_KEY, [plan, ...this.listPlans()]);
    return plan;
  }

  updatePlan(id: string, patch: Partial<HifzPlan>): HifzPlan[] {
    const next = this.listPlans().map((p) => (p.id === id ? { ...p, ...patch } : p));
    storage.set(PLANS_KEY, next);
    return next;
  }

  removePlan(id: string): void {
    storage.set(PLANS_KEY, this.listPlans().filter((p) => p.id !== id));
    storage.set(PROGRESS_KEY, this.listProgress().filter((pr) => pr.planId !== id));
  }

  listProgress(): HifzProgress[] {
    return storage.get<HifzProgress[]>(PROGRESS_KEY, []);
  }

  // تسجيل إنجاز اليوم — يراكم الآيات
  markProgress(planId: string, ayahs: Array<{ surahId: number; ayahNumber: number }>, date = new Date().toISOString().slice(0, 10)): HifzProgress {
    const plan = this.listPlans().find((p) => p.id === planId);
    if (!plan) throw new Error('الخطة غير موجودة');
    if (plan.status !== 'active') throw new Error('الخطة ليست نشطة');
    const existing = this.listProgress();
    const sameDay = existing.find((p) => p.planId === planId && p.date === date);
    let next: HifzProgress;
    if (sameDay) {
      const merged = [...sameDay.ayahs, ...ayahs];
      // dedupe
      const seen = new Set(merged.map((a) => `${a.surahId}:${a.ayahNumber}`));
      next = { planId, date, completedAyahs: seen.size, ayahs: Array.from(seen).map((k) => { const [s, a] = k.split(':').map(Number); return { surahId: s, ayahNumber: a }; }) };
      storage.set(PROGRESS_KEY, existing.map((p) => (p === sameDay ? next : p)));
    } else {
      next = { planId, date, completedAyahs: ayahs.length, ayahs };
      storage.set(PROGRESS_KEY, [next, ...existing]);
    }
    return next;
  }

  // طابور المراجعة المبسط: آيات حفظت قبل أكثر من 3 أيام ولم تُراجع اليوم
  getDueReviews(planId?: string): Array<{ surahId: number; ayahNumber: number; lastDate: string }> {
    const progresses = this.listProgress().filter((p) => !planId || p.planId === planId);
    const today = new Date().toISOString().slice(0, 10);
    const reviewedToday = new Set(progresses.filter((p) => p.date === today).flatMap((p) => p.ayahs.map((a) => `${a.surahId}:${a.ayahNumber}`)));
    const due: Array<{ surahId: number; ayahNumber: number; lastDate: string }> = [];
    for (const pr of progresses) {
      if (pr.date === today) continue;
      // if older than 3 days and not reviewed today
      const daysDiff = (Date.now() - new Date(pr.date).getTime()) / (24 * 60 * 60 * 1000);
      if (daysDiff >= 3) {
        for (const ayah of pr.ayahs) {
          const key = `${ayah.surahId}:${ayah.ayahNumber}`;
          if (!reviewedToday.has(key) && !due.find((d) => `${d.surahId}:${d.ayahNumber}` === key)) {
            due.push({ ...ayah, lastDate: pr.date });
          }
        }
      }
    }
    return due;
  }

  getStats(): HifzStats {
    const plans = this.listPlans();
    const progresses = this.listProgress();
    const totalMemorized = progresses.reduce((sum, p) => sum + p.completedAyahs, 0);
    // streak: consecutive days with any progress ending today or yesterday
    const dates = [...new Set(progresses.map((p) => p.date))].sort().reverse();
    let streak = 0;
    let cursor = new Date();
    // allow streak if last progress is today or yesterday
    for (let i = 0; i < dates.length; i++) {
      const d = cursor.toISOString().slice(0, 10);
      if (dates.includes(d)) {
        streak++;
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      } else if (i === 0) {
        // if today missing, try yesterday
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
        const yesterday = cursor.toISOString().slice(0, 10);
        if (dates.includes(yesterday)) { streak++; cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000); } else break;
      } else break;
    }
    return {
      totalPlans: plans.length,
      activePlans: plans.filter((p) => p.status === 'active').length,
      streakDays: streak,
      totalMemorized,
      dueReviews: this.getDueReviews().length,
    };
  }
}

export const hifzRepository = new LocalHifzRepository();
