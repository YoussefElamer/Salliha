import { BarChart3, BookOpen, Clock3, GraduationCap, Headphones, Home, Search, Settings, Sparkles, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AppRoute = 'home' | 'quran' | 'prayer' | 'audio' | 'adhkar' | 'search' | 'space' | 'settings' | 'hifz' | 'stats';

export interface NavItem {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
}

export interface RouteParams {
  surahId?: number;
  ayahNumber?: number;
}

export interface RouteState {
  route: AppRoute;
  params?: RouteParams;
}

/** التبويبات الخمسة الأساسية في الشريط السفلي. */
export const mainNavItems: NavItem[] = [
  { route: 'home', label: 'الرئيسية', icon: Home },
  { route: 'quran', label: 'المصحف', icon: BookOpen },
  { route: 'prayer', label: 'الصلاة', icon: Clock3 },
  { route: 'audio', label: 'التلاوة', icon: Headphones },
  { route: 'adhkar', label: 'الأذكار', icon: Sparkles }
];

/** بقية الأقسام — تظهر في قائمة «المزيد» وفي التنقل الجانبي على الشاشات الكبيرة. */
export const moreNavItems: NavItem[] = [
  { route: 'search', label: 'البحث', icon: Search },
  { route: 'hifz', label: 'الحفظ والمراجعة', icon: GraduationCap },
  { route: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  { route: 'space', label: 'مساحتي', icon: UserRound },
  { route: 'settings', label: 'الإعدادات', icon: Settings }
];

export const allNavItems: NavItem[] = [...mainNavItems, ...moreNavItems];
