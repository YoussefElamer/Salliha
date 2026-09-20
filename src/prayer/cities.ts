import type { CityPreset } from '../core/types';

export const cityPresets: CityPreset[] = [
  { id: 'makkah', name: 'مكة المكرمة', country: 'السعودية', latitude: 21.3891, longitude: 39.8579, timezone: 'Asia/Riyadh' },
  { id: 'madinah', name: 'المدينة المنورة', country: 'السعودية', latitude: 24.5247, longitude: 39.5692, timezone: 'Asia/Riyadh' },
  { id: 'riyadh', name: 'الرياض', country: 'السعودية', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' },
  { id: 'cairo', name: 'القاهرة', country: 'مصر', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
  { id: 'amman', name: 'عمّان', country: 'الأردن', latitude: 31.9539, longitude: 35.9106, timezone: 'Asia/Amman' },
  { id: 'dubai', name: 'دبي', country: 'الإمارات', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { id: 'istanbul', name: 'إسطنبول', country: 'تركيا', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  { id: 'london', name: 'London', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' }
];

export function getCityById(id: string): CityPreset {
  return cityPresets.find((city) => city.id === id) ?? cityPresets[0];
}
