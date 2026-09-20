import { BookOpen, Clock3, Headphones, Home, Search, Settings, Sparkles, GraduationCap, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AppRoute = 'home' | 'quran' | 'prayer' | 'audio' | 'adhkar' | 'search' | 'space' | 'settings' | 'hifz' | 'stats';

export interface NavItem {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { route: 'home', label: 'الرئيسية', icon: Home },
  { route: 'quran', label: 'المصحف', icon: BookOpen },
  { route: 'prayer', label: 'الصلاة', icon: Clock3 },
  { route: 'audio', label: 'التلاوة', icon: Headphones },
  { route: 'adhkar', label: 'الأذكار', icon: Sparkles }
];

export const moreNavItems: NavItem[] = [
  { route: 'search', label: 'البحث', icon: Search },
  { route: 'hifz', label: 'الحفظ', icon: GraduationCap },
  { route: 'stats', label: 'الإحصائيات', icon: BarChart3 },
  { route: 'settings', label: 'الإعدادات', icon: Settings }
];
