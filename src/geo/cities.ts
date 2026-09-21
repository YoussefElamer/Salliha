import geoJson from '../data/geo/cities.generated.json';
import type { CalculationMethodChoice, CalculationMethodId, GeoCity, ResolvedLocation } from '../core/types';
import { normalizeArabic } from '../core/arabic';

interface GeoDatasetMeta {
  sourceName: string;
  sourceUrl: string;
  license: string;
  generatedFrom: string;
  generatedAt: string;
  minimumPopulation: number;
  countryCount: number;
  cityCount: number;
  timezoneCount: number;
  fields: string[];
  note: string;
}

interface GeoDataset {
  meta: GeoDatasetMeta;
  countries: Record<string, { ar: string; en: string; method: CalculationMethodId }>;
  timezones: string[];
  cities: Array<[number, string, string, string, number, number, number, number, number]>;
}

const dataset = geoJson as unknown as GeoDataset;

function toCity(row: GeoDataset['cities'][number]): GeoCity {
  const [geonamesId, name, nameAr, countryCode, latitude, longitude, timezoneIndex, population, isCapital] = row;
  return {
    id: String(geonamesId),
    name,
    nameAr: nameAr || '',
    countryCode,
    countryAr: dataset.countries[countryCode]?.ar ?? countryCode,
    countryEn: dataset.countries[countryCode]?.en ?? countryCode,
    latitude,
    longitude,
    timezone: dataset.timezones[timezoneIndex] ?? 'UTC',
    population,
    isCapital: isCapital === 1,
    defaultMethod: dataset.countries[countryCode]?.method ?? 'mwl'
  };
}

const cities: GeoCity[] = dataset.cities.map(toCity);
const citiesById = new Map(cities.map((city) => [city.id, city]));
const citiesByCountry = new Map<string, GeoCity[]>();
for (const city of cities) {
  const list = citiesByCountry.get(city.countryCode) ?? [];
  list.push(city);
  citiesByCountry.set(city.countryCode, list);
}

/** أكبر مدينة في كل منطقة زمنية — تُستخدم عندما نعرف المنطقة الزمنية للجهاز فقط. */
const biggestCityByTimeZone = (() => {
  const map = new Map<string, GeoCity>();
  for (const city of cities) {
    const current = map.get(city.timezone);
    if (!current || city.population > current.population) map.set(city.timezone, city);
  }
  return map;
})();

interface IndexedCity {
  city: GeoCity;
  haystack: string;
}

const cityIndex: IndexedCity[] = cities.map((city) => ({
  city,
  haystack: normalizeArabic(`${city.nameAr} ${city.name} ${city.countryAr} ${city.countryEn} ${city.countryCode}`)
}));

export function getGeoMetadata(): GeoDatasetMeta {
  return dataset.meta;
}

export function listCities(): GeoCity[] {
  return cities;
}

export function listCountries(): Array<{ code: string; ar: string; en: string; method: CalculationMethodId; cityCount: number }> {
  return Object.entries(dataset.countries)
    .map(([code, info]) => ({ code, ...info, cityCount: citiesByCountry.get(code)?.length ?? 0 }))
    .sort((a, b) => a.ar.localeCompare(b.ar, 'ar'));
}

export function getCountry(code: string): { code: string; ar: string; en: string; method: CalculationMethodId } | null {
  const info = dataset.countries[code];
  return info ? { code, ...info } : null;
}

export function getCityById(id: string): GeoCity | null {
  return citiesById.get(id) ?? null;
}

export function citiesOfCountry(code: string): GeoCity[] {
  return citiesByCountry.get(code) ?? [];
}

export function searchCities(query: string, options: { limit?: number; countryCode?: string; minPopulation?: number } = {}): GeoCity[] {
  const { limit = 40, countryCode, minPopulation = 0 } = options;
  const normalized = normalizeArabic(query).trim();
  const pool = countryCode ? citiesOfCountry(countryCode) : cities;
  const candidates = minPopulation ? pool.filter((city) => city.population >= minPopulation) : pool;
  if (!normalized) return candidates.slice(0, limit);
  const tokens = normalized.split(' ').filter(Boolean);
  const scored = cityIndex
    .filter((entry) => !countryCode || entry.city.countryCode === countryCode)
    .filter((entry) => !minPopulation || entry.city.population >= minPopulation)
    .map((entry) => {
      const haystack = entry.haystack;
      const exact = haystack.includes(normalized);
      const tokensMatched = tokens.filter((token) => haystack.includes(token)).length;
      if (!exact && tokensMatched === 0) return null;
      const startsWith = haystack.startsWith(normalized) ? 1 : 0;
      const score = (exact ? 1000 : 0) + startsWith * 120 + tokensMatched * 220 + Math.min(entry.city.population / 1_000_000, 25) + (entry.city.isCapital ? 40 : 0);
      return { city: entry.city, score };
    })
    .filter((item): item is { city: GeoCity; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || b.city.population - a.city.population)
    .slice(0, limit);
  return scored.map((item) => item.city);
}

export function cityForTimeZone(timeZone: string): GeoCity | null {
  if (biggestCityByTimeZone.has(timeZone)) return biggestCityByTimeZone.get(timeZone) ?? null;
  const match = cities.find((city) => city.timezone === timeZone);
  return match ?? null;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * أقرب مدينة لإحداثيات معطاة. يعتمد أولًا على أقرب مدينة (لأي حجم)، وإن كانت بعيدة
 * أكثر من الحد المسموح يبحث عن أقرب مدينة كبيرة لتفادي نتائج غير مفهومة في المناطق النائية.
 */
export function nearestCity(latitude: number, longitude: number, options: { maxDistanceKm?: number; minPopulation?: number } = {}): { city: GeoCity; distanceKm: number } | null {
  const { maxDistanceKm = 400, minPopulation = 0 } = options;
  const origin = { latitude, longitude };
  let best: { city: GeoCity; distanceKm: number } | null = null;
  for (const city of cities) {
    if (minPopulation && city.population < minPopulation) continue;
    const d = distanceKm(origin, { latitude: city.latitude, longitude: city.longitude });
    if (!best || d < best.distanceKm) best = { city, distanceKm: d };
  }
  if (!best) return null;
  if (best.distanceKm > maxDistanceKm) return null;
  return best;
}

export function resolveCalculationMethod(choice: CalculationMethodChoice, countryCode: string | undefined, fallbackCity?: GeoCity | null): CalculationMethodId {
  if (choice !== 'auto') return choice;
  if (countryCode) {
    const country = dataset.countries[countryCode];
    if (country) return country.method;
  }
  if (fallbackCity) return fallbackCity.defaultMethod;
  return 'mwl';
}

/**
 * تحديد الموقع تلقائيًا:
 *  - إن توفّرت إحداثيات GPS نستخدم أقرب مدينة لها.
 *  - وإلا نشتقّ الموقع من المنطقة الزمنية للجهاز (أكبر مدينة في نفس المنطقة الزمنية).
 */
export function resolveAutoLocation(options: { coordinates?: { latitude: number; longitude: number } | null; timeZone?: string } = {}): ResolvedLocation | null {
  const { coordinates, timeZone = deviceTimeZone() } = options;
  if (coordinates) {
    const nearest = nearestCity(coordinates.latitude, coordinates.longitude, { minPopulation: 0 });
    if (nearest) {
      const { city, distanceKm: dist } = nearest;
      return {
        cityId: city.id,
        name: city.nameAr || city.name,
        countryCode: city.countryCode,
        countryAr: city.countryAr,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timezone: city.timezone,
        method: city.defaultMethod,
        source: 'gps',
        distanceKm: Math.round(dist)
      };
    }
    const country = nearestCity(coordinates.latitude, coordinates.longitude, { minPopulation: 200_000, maxDistanceKm: 2000 });
    if (country) {
      return {
        cityId: country.city.id,
        name: country.city.nameAr || country.city.name,
        countryCode: country.city.countryCode,
        countryAr: country.city.countryAr,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timezone: country.city.timezone,
        method: country.city.defaultMethod,
        source: 'gps',
        distanceKm: Math.round(country.distanceKm)
      };
    }
  }
  const tzCity = cityForTimeZone(timeZone);
  if (!tzCity) return null;
  return {
    cityId: tzCity.id,
    name: tzCity.nameAr || tzCity.name,
    countryCode: tzCity.countryCode,
    countryAr: tzCity.countryAr,
    latitude: tzCity.latitude,
    longitude: tzCity.longitude,
    timezone: tzCity.timezone,
    method: tzCity.defaultMethod,
    source: 'timezone'
  };
}

export function locationLabel(location: { name: string; countryAr: string } | null | undefined): string {
  if (!location) return 'غير محدد';
  return `${location.name} — ${location.countryAr}`;
}
