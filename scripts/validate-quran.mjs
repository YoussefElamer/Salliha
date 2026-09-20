import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const quranSourcePath = 'data/sources/quran/quran-json-3.1.2-quran.json';
const quranHashPath = 'data/sources/quran/quran-json-3.1.2-quran.sha256';
const generatedPath = 'src/data/quran/quran.generated.json';

const expectedAyahCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49,
  62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28,
  28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

function fail(message) {
  console.error(`❌ Quran validation failed: ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filePath))).digest('hex');
}

function readUtf8Strict(filePath) {
  const absolute = path.join(root, filePath);
  const buffer = fs.readFileSync(absolute);
  const decoded = buffer.toString('utf8');
  const reencoded = Buffer.from(decoded, 'utf8');
  assert(buffer.equals(reencoded), `${filePath} is not stable UTF-8`);
  assert(!decoded.includes('\uFFFD'), `${filePath} contains Unicode replacement characters`);
  return decoded;
}

const sourceRaw = readUtf8Strict(quranSourcePath);
const generatedRaw = readUtf8Strict(generatedPath);
const expectedHash = fs.readFileSync(path.join(root, quranHashPath), 'utf8').trim().split(/\s+/)[0];
const actualHash = sha256(quranSourcePath);
assert(actualHash === expectedHash, `Quran source hash changed. Expected ${expectedHash}, got ${actualHash}`);

let source;
let generated;
try {
  source = JSON.parse(sourceRaw);
  generated = JSON.parse(generatedRaw);
} catch (error) {
  fail(`Invalid JSON: ${error.message}`);
}

assert(Array.isArray(source), 'Quran source must be an array');
assert(Array.isArray(generated?.surahs), 'Generated Quran data must contain surahs array');
assert(source.length === 114, `Source must contain 114 surahs, found ${source.length}`);
assert(generated.surahs.length === 114, `Generated data must contain 114 surahs, found ${generated.surahs.length}`);
assert(generated.meta?.sourceSha256 === actualHash, 'Generated metadata sourceSha256 does not match canonical source hash');

const seenKeys = new Set();
let sourceTotal = 0;
let generatedTotal = 0;

for (let surahIndex = 0; surahIndex < 114; surahIndex += 1) {
  const expectedSurahId = surahIndex + 1;
  const sourceSurah = source[surahIndex];
  const generatedSurah = generated.surahs[surahIndex];
  const expectedCount = expectedAyahCounts[surahIndex];

  assert(sourceSurah.id === expectedSurahId, `Source surah order mismatch at index ${surahIndex}: expected id ${expectedSurahId}, got ${sourceSurah.id}`);
  assert(generatedSurah.surahId === expectedSurahId, `Generated surah order mismatch at index ${surahIndex}: expected id ${expectedSurahId}, got ${generatedSurah.surahId}`);
  assert(sourceSurah.name === generatedSurah.name, `Surah ${expectedSurahId} name changed in generated data`);
  assert(sourceSurah.total_verses === expectedCount, `Surah ${expectedSurahId} expected ${expectedCount} ayat, source has ${sourceSurah.total_verses}`);
  assert(generatedSurah.ayahCount === expectedCount, `Surah ${expectedSurahId} expected ${expectedCount} ayat, generated has ${generatedSurah.ayahCount}`);
  assert(sourceSurah.verses.length === expectedCount, `Surah ${expectedSurahId} source verses length mismatch`);
  assert(generatedSurah.verses.length === expectedCount, `Surah ${expectedSurahId} generated verses length mismatch`);

  for (let ayahIndex = 0; ayahIndex < expectedCount; ayahIndex += 1) {
    const expectedAyahNumber = ayahIndex + 1;
    const sourceAyah = sourceSurah.verses[ayahIndex];
    const generatedAyah = generatedSurah.verses[ayahIndex];
    const key = `${expectedSurahId}:${expectedAyahNumber}`;

    assert(sourceAyah.id === expectedAyahNumber, `${key} source ayah number mismatch: got ${sourceAyah.id}`);
    assert(generatedAyah.surahId === expectedSurahId, `${key} generated surahId mismatch`);
    assert(generatedAyah.surahName === sourceSurah.name, `${key} generated surahName mismatch`);
    assert(generatedAyah.ayahNumber === expectedAyahNumber, `${key} generated ayahNumber mismatch`);
    assert(generatedAyah.orderInSurah === expectedAyahNumber, `${key} generated orderInSurah mismatch`);
    assert(generatedAyah.text === sourceAyah.text, `${key} text changed between source and generated data`);
    assert(typeof generatedAyah.text === 'string' && generatedAyah.text.length > 0, `${key} has empty text`);
    assert(!seenKeys.has(key), `Duplicate ayah record key ${key}`);
    seenKeys.add(key);
  }

  sourceTotal += sourceSurah.verses.length;
  generatedTotal += generatedSurah.verses.length;
}

assert(sourceTotal === 6236, `Source ayah total must be 6236, found ${sourceTotal}`);
assert(generatedTotal === 6236, `Generated ayah total must be 6236, found ${generatedTotal}`);
assert(seenKeys.size === 6236, `Expected 6236 unique ayah keys, found ${seenKeys.size}`);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ Quran validation passed: 114 surahs, 6236 ayat, canonical order, source hash, UTF-8, and generated-text integrity verified.');
