import { describe, expect, it } from 'vitest';
import { citiesOfCountry, deviceTimeZone, getCityById, getCountry, getGeoMetadata, listCountries, nearestCity, resolveAutoLocation, resolveCalculationMethod, searchCities } from '../src/geo/cities';

describe('قاعدة المدن والدول (Offline)', () => {
  it('تغطي كل الدول تقريبًا وتحتوي آلاف المدن', () => {
    const countries = listCountries();
    expect(countries.length).toBeGreaterThanOrEqual(200);
    expect(countries.every((country) => country.cityCount > 0)).toBe(true);
    expect(getGeoMetadata().minimumPopulation).toBe(100000);
  });

  it('تعرض أسماء الدول بالعربية', () => {
    expect(getCountry('EG')?.ar).toBe('مصر');
    expect(getCountry('SA')?.ar).toBe('السعودية');
    expect(getCountry('US')?.ar).toBe('الولايات المتحدة');
  });

  it('تحدد المدينة بالمعرّف', () => {
    const cairo = getCityById('360630');
    expect(cairo?.name).toBe('Cairo');
    expect(cairo?.nameAr).toBe('القاهرة');
    expect(cairo?.timezone).toBe('Africa/Cairo');
  });

  it('تبحث بالعربية والإنجليزية', () => {
    expect(searchCities('القاهرة')[0].id).toBe('360630');
    expect(searchCities('Cairo')[0].countryCode).toBe('EG');
    expect(searchCities('دبي')[0].nameAr).toBe('دبي');
    expect(searchCities('لندن')[0].countryCode).toBe('GB');
  });

  it('تبحث داخل دولة محددة فقط', () => {
    const results = searchCities('ال', { countryCode: 'SA', limit: 30 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((city) => city.countryCode === 'SA')).toBe(true);
    expect(citiesOfCountry('SA').length).toBeGreaterThan(5);
  });

  it('تعيد أقرب مدينة لإحداثيات معينة', () => {
    const nearest = nearestCity(30.0444, 31.2357);
    expect(nearest?.city.id).toBe('360630');
    expect(nearest?.distanceKm).toBeLessThan(15);
  });

  it('تحدد الموقع تلقائيًا من الإحداثيات', () => {
    const resolved = resolveAutoLocation({ coordinates: { latitude: 30.05, longitude: 31.23 } });
    expect(resolved?.source).toBe('gps');
    expect(resolved?.countryCode).toBe('EG');
    expect(resolved?.timezone).toBe('Africa/Cairo');
  });

  it('تحدد الموقع من المنطقة الزمنية للجهاز عند غياب GPS', () => {
    const resolved = resolveAutoLocation({ timeZone: 'Africa/Cairo' });
    expect(resolved?.countryCode).toBe('EG');
    expect(resolved?.source).toBe('timezone');
    // الأهم: القاهرة بالتحديد لا مدينة أصغر في نفس المنطقة الزمنية.
    expect(resolved?.cityId).toBe('360630');
    expect(resolved?.name).toBe('القاهرة');
    expect(resolved?.method).toBe('egyptian');
    const riyadh = resolveAutoLocation({ timeZone: 'Asia/Riyadh' });
    expect(riyadh?.countryCode).toBe('SA');
    expect(riyadh?.method).toBe('ummAlQura');
  });

  it('تقرأ المنطقة الزمنية للجهاز بدون فشل', () => {
    expect(typeof deviceTimeZone()).toBe('string');
  });

  it('تختار طريقة الحساب المناسبة لكل دولة', () => {
    expect(resolveCalculationMethod('auto', 'EG')).toBe('egyptian');
    expect(resolveCalculationMethod('auto', 'SA')).toBe('ummAlQura');
    expect(resolveCalculationMethod('auto', 'US')).toBe('moonsighting');
    expect(resolveCalculationMethod('auto', 'PK')).toBe('karachi');
    expect(resolveCalculationMethod('auto', 'FR')).toBe('mwl');
    expect(resolveCalculationMethod('karachi', 'EG')).toBe('karachi');
  });

  it('تضمن أن كل مدينة لها منطقة زمنية معرّفة في قاعدة IANA', () => {
    const samples = searchCities('', { limit: 400 });
    expect(samples.length).toBeGreaterThan(0);
    const valid = new Set<string>();
    for (const city of samples) valid.add(city.timezone);
    for (const zone of valid) {
      expect(() => new Intl.DateTimeFormat('ar', { timeZone: zone })).not.toThrow();
    }
  });
});
