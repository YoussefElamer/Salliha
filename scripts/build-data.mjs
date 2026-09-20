import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const writeJson = (p, data) => {
  const file = path.join(root, p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const quranSourcePath = 'data/sources/quran/quran-json-3.1.2-quran.json';
const quranSource = readJson(quranSourcePath);
let globalAyahNumber = 0;
const quranGenerated = {
  meta: {
    app: 'صَلِّها — Salliha',
    sourceName: 'quran-json',
    sourceVersion: '3.1.2',
    sourceUrl: 'https://www.npmjs.com/package/quran-json/v/3.1.2',
    upstreamTextSource: 'The Noble Qur\'an Encyclopedia (as documented by quran-json)',
    license: 'CC-BY-4.0 for quran-json package; upstream Quran text attribution retained in docs.',
    sourceSha256: sha256(quranSourcePath),
    generatedFrom: quranSourcePath,
    note: 'Text is copied verbatim from the source JSON. The generator only adds identifiers and positional metadata.'
  },
  surahs: quranSource.map((surah, surahIndex) => {
    return {
      surahId: surah.id,
      order: surahIndex + 1,
      name: surah.name,
      transliteration: surah.transliteration,
      revelationType: surah.type,
      ayahCount: surah.total_verses,
      verses: surah.verses.map((verse, ayahIndex) => {
        globalAyahNumber += 1;
        return {
          id: `${surah.id}:${verse.id}`,
          globalAyahNumber,
          surahId: surah.id,
          surahName: surah.name,
          ayahNumber: verse.id,
          orderInSurah: ayahIndex + 1,
          text: verse.text
        };
      })
    };
  })
};
writeJson('src/data/quran/quran.generated.json', quranGenerated);

const adhkarSourcePath = 'data/sources/adhkar/morning-evening-ar.json';
const adhkarSource = readJson(adhkarSourcePath);
const mapTypeToCategories = (type, content) => {
  const categories = ['أذكار الصباح والمساء'];
  if (type === 0 || type === 1) categories.push('أذكار الصباح');
  if (type === 0 || type === 2) categories.push('أذكار المساء');
  if (/استغفر|أستغفر|الاستغفار/.test(content)) categories.push('الاستغفار');
  return categories;
};
const adhkarGenerated = {
  meta: {
    sourceName: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    sourceVersion: fs.readFileSync(path.join(root, 'data/sources/adhkar/morning-evening-commit.txt'), 'utf8').trim(),
    sourceUrl: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    license: 'MIT',
    sourceSha256: sha256(adhkarSourcePath),
    generatedFrom: adhkarSourcePath,
    note: 'Arabic text, counts and references are copied from the source dataset. The generator adds app categories only.'
  },
  categories: ['أذكار الصباح', 'أذكار المساء', 'أذكار الصباح والمساء', 'الاستغفار'],
  items: adhkarSource.map((item) => ({
    id: `mae-${String(item.order).padStart(3, '0')}`,
    order: item.order,
    content: item.content,
    count: item.count,
    countDescription: item.count_description,
    benefit: item.fadl,
    source: item.source,
    sourceType: item.type,
    categories: mapTypeToCategories(item.type, item.content),
    audioUrl: item.audio || null,
    hadithText: item.hadith_text || null,
    vocabulary: item.explanation_of_hadith_vocabulary || null
  }))
};
writeJson('src/data/adhkar/adhkar.generated.json', adhkarGenerated);

console.log(`Generated Quran data (${globalAyahNumber} ayat) and adhkar data (${adhkarGenerated.items.length} items).`);
