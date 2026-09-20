#!/usr/bin/env node
/**
 * يبني قاعدة بيانات المدن/الدول المستخدمة في تحديد الموقع ومواقيت الصلاة.
 *
 * المصادر (تُقرأ من node_modules وقت البناء فقط — لا تُخزَّن في الحزمة النهائية):
 *  - all-the-cities (GeoNames cities15000) — إحداثيات وأسماء المدن، رخصة CC BY 4.0.
 *  - tz-lookup — اشتقاق المنطقة الزمنية من الإحداثيات (بيانات tz database، رخصة MIT).
 *  - countries-list — أسماء الدول بالإنجليزية ورموز ISO (رخصة MIT).
 *
 * البيانات المُنسّقة داخل المشروع في data/geo/:
 *  - countries-ar.json  : أسماء الدول بالعربية.
 *  - city-names-ar.json : أسماء المدن بالعربية (اختياري لكل مدينة).
 *  - prayer-methods.json: طريقة الحساب الافتراضية لكل دولة.
 *
 * الناتج: src/data/geo/cities.generated.json (ملف واحد صغير يعمل Offline).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIN_POPULATION = 100_000;

function readJson(relativePath) {
  const full = resolve(root, relativePath);
  if (!existsSync(full)) throw new Error(`ملف مفقود: ${relativePath}`);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function stripNote(object) {
  const { _note, ...rest } = object;
  return rest;
}

const allCities = require('all-the-cities');
const tzLookup = require('tz-lookup');
const { countries: englishCountries } = require('countries-list');

const countriesAr = stripNote(readJson('data/geo/countries-ar.json'));
const cityNamesAr = stripNote(readJson('data/geo/city-names-ar.json'));
const prayerMethods = readJson('data/geo/prayer-methods.json');
const extraCities = new Set(readJson('data/geo/extra-cities.json').cities);
const methodIds = new Set(['mwl', 'egyptian', 'ummAlQura', 'karachi', 'dubai', 'moonsighting']);

/** كل عاصمة (PPLC) + كل مدينة يسكنها 100 ألف نسمة أو أكثر + المدن المهمة المنسّقة يدويًا. */
function selectCities() {
  const selected = new Map();
  for (const city of allCities) {
    const isCapital = city.featureCode === 'PPLC';
    const isExtra = extraCities.has(`${city.name}|${city.country}`);
    if (!isCapital && !isExtra && city.population < MIN_POPULATION) continue;
    const key = `${city.name}|${city.country}`;
    const existing = selected.get(key);
    if (existing && existing.population >= city.population) continue;
    selected.set(key, {
      id: String(city.cityId),
      name: city.name,
      altName: city.altName || '',
      countryCode: city.country,
      lat: city.loc.coordinates[1],
      lon: city.loc.coordinates[0],
      population: city.population,
      isCapital
    });
  }
  const result = [...selected.values()];
  const included = new Set(result.map((city) => `${city.name}|${city.countryCode}`));
  const missingExtras = [...extraCities].filter((key) => !included.has(key));
  if (missingExtras.length) console.warn(`⚠ مدن مهمة غير موجودة في GeoNames: ${missingExtras.join(' | ')}`);
  return result;
}

/** يتأكد أن لكل دولة ناطقة بالمشروع مدينة واحدة على الأقل، ويضيف كبرى مدن الدولة عند الحاجة. */
function ensureCountryCoverage(cities) {
  const byCountry = new Map();
  for (const city of cities) {
    const list = byCountry.get(city.countryCode) ?? [];
    list.push(city);
    byCountry.set(city.countryCode, list);
  }
  const additions = [];
  for (const code of Object.keys(englishCountries)) {
    if (byCountry.has(code)) continue;
    const biggest = allCities
      .filter((city) => city.country === code)
      .sort((a, b) => b.population - a.population)[0];
    if (!biggest) continue;
    additions.push({
      id: String(biggest.cityId),
      name: biggest.name,
      altName: biggest.altName || '',
      countryCode: code,
      lat: biggest.loc.coordinates[1],
      lon: biggest.loc.coordinates[0],
      population: biggest.population,
      isCapital: biggest.featureCode === 'PPLC'
    });
  }
  return [...cities, ...additions];
}

/** تطبيع اسم المدينة لمطابقة أسماء GeoNames مهما اختلف التشكيل اللاتيني أو علامات الترقيم. */
function normalizeCityKey(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildArabicCityNames() {
  const map = new Map();
  for (const [key, value] of Object.entries(cityNamesAr)) {
    if (key.startsWith('_')) continue;
    const [name, code] = key.split('|');
    if (!name || !code) continue;
    map.set(`${normalizeCityKey(name)}|${code.toUpperCase()}`, value);
  }
  return map;
}

function timezoneFor(city) {
  try {
    return tzLookup(city.lat, city.lon);
  } catch {
    return 'UTC';
  }
}

function main() {
  const base = ensureCountryCoverage(selectCities());
  const cities = base
    .map((city) => ({ ...city, timezone: timezoneFor(city) }))
    .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));

  const timezones = [...new Set(cities.map((city) => city.timezone))].sort();
  const timezoneIndex = new Map(timezones.map((zone, index) => [zone, index]));

  const countryCodes = [...new Set(cities.map((city) => city.countryCode))].sort();
  const countryTable = {};
  for (const code of countryCodes) {
    const english = englishCountries[code];
    const method = prayerMethods.methodsByCountry[code] ?? prayerMethods.default;
    if (!methodIds.has(method)) throw new Error(`طريقة حساب غير معروفة للدولة ${code}: ${method}`);
    countryTable[code] = {
      ar: countriesAr[code] ?? english?.native ?? english?.name ?? code,
      en: english?.name ?? code,
      method
    };
  }

  const missingArabicCountries = countryCodes.filter((code) => !countriesAr[code]);

  const arabicCityNames = buildArabicCityNames();

  const rows = cities.map((city) => [
    city.name,
    arabicCityNames.get(`${normalizeCityKey(city.name)}|${city.countryCode}`) ?? '',
    city.countryCode,
    Number(city.lat.toFixed(3)),
    Number(city.lon.toFixed(3)),
    timezoneIndex.get(city.timezone),
    city.population,
    city.isCapital ? 1 : 0
  ]);

  const usedArabicKeys = new Set();
  for (const city of cities) {
    const key = `${normalizeCityKey(city.name)}|${city.countryCode}`;
    if (arabicCityNames.has(key)) usedArabicKeys.add(key);
  }
  const unusedArabicKeys = Object.keys(cityNamesAr)
    .filter((key) => !key.startsWith('_'))
    .filter((key) => {
      const [name, code] = key.split('|');
      return !usedArabicKeys.has(`${normalizeCityKey(name)}|${(code ?? '').toUpperCase()}`);
    });

  const payload = {
    meta: {
      sourceName: 'GeoNames (via all-the-cities) + tz-lookup + countries-list',
      sourceUrl: 'https://www.geonames.org/',
      license: 'GeoNames CC BY 4.0 — tz-lookup MIT — countries-list MIT',
      generatedFrom: 'scripts/build-geo.mjs',
      generatedAt: new Date().toISOString().slice(0, 10),
      minimumPopulation: MIN_POPULATION,
      fields: ['name', 'nameAr', 'countryCode', 'lat', 'lon', 'timezoneIndex', 'population', 'isCapital'],
      note: 'أسماء الدول بالعربية ومفاتيح المدن العربية بيانات مُنسّقة داخل المشروع في data/geo. المواقيت تُحسب محليًا على الجهاز.'
    },
    countries: countryTable,
    timezones,
    cities: rows
  };

  const outputPath = resolve(root, 'src/data/geo/cities.generated.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  const serialized = `${JSON.stringify(payload)}\n`;
  writeFileSync(outputPath, serialized);

  const digest = createHash('sha256').update(serialized).digest('hex');
  console.log(`✓ ${rows.length} مدينة في ${countryCodes.length} دولة — ${timezones.length} منطقة زمنية`);
  console.log(`✓ ${outputPath} (${(serialized.length / 1024).toFixed(0)} KB, sha256 ${digest.slice(0, 12)}…)`);
  if (missingArabicCountries.length) {
    console.warn(`⚠ دول بدون اسم عربي مُنسّق: ${missingArabicCountries.join(', ')}`);
  }
  if (unusedArabicKeys.length) {
    console.warn(`⚠ مفاتيح أسماء عربية لا تطابق أي مدينة (${unusedArabicKeys.length}): ${unusedArabicKeys.slice(0, 12).join(' | ')}`);
  }
}

main();
