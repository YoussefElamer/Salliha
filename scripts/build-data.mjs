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
    app: 'صليها — Salliha',
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
const hisnSourcePath = 'data/sources/adhkar/hisnul-muslim-ar.json';
const hisnSource = readJson(hisnSourcePath);
const mapTypeToCategories = (type, content) => {
  const categories = ['أذكار الصباح والمساء'];
  if (type === 0 || type === 1) categories.push('أذكار الصباح');
  if (type === 0 || type === 2) categories.push('أذكار المساء');
  if (/استغفر|أستغفر|الاستغفار/.test(content)) categories.push('الاستغفار');
  return categories;
};

/**
 * تصنيف مواضع «حصن المسلم» إلى تصنيفات تطبيق واضحة.
 * القواعد مرتّبة: أول قاعدة تنطبق على عنوان الموضع هي التي تحدد التصنيف.
 */
const hisnCategoryRules = [
  [/^أذكار الصباح والمساء/, ['أذكار الصباح', 'أذكار المساء']],
  [/^أذكار الاستيقاظ/, ['أذكار الاستيقاظ']],
  [/^أذكار النوم|تقلب ليلاً|القلق والفزع|رأى الرؤيا|نباح الكلاب|مردة الشياطين|أحس وجعاً|الفزع/, ['أذكار النوم']],
  [/^أذكار الأذان|^دعاء الذهاب إلى المسجد|^دعاء دخول المسجد|^دعاء الخروج من المسجد/, ['المسجد والأذان']],
  [/وضع الثوب|لبس الثوب|دخول الخلاء|الخروج من الخلاء|الوضوء|الخروج من المنزل|الدخول المنزل/, ['المنزل والوضوء']],
  [/قبل الطعام|الفراغ من الطعام|الضيف|سقاه|أفطر|الصائم/, ['الطعام والشراب']],
  [/ركوب الدابة|السفر|دخول القرية|دخول السوق|تعس المركوب|المسافر|المقيم|المشعر الحرام|التكبير والتسبيح في سير|نزل منزلا|الرجوع من السفر/, ['السفر والحل والترحال']],
  [/الاستفتاح|الركوع|الرفع من الركوع|السجود|الجلسة بين السجدتين|سجود التلاوة|التشهد|الأذكار بعد السلام|صلاة الاستخارة|قنوت الوتر|عقب السلام من الوتر|الوسوسة في الصلاة/, ['أذكار الصلاة']],
  [/المريض|المحتضر|المصيبة|إغماض الميت|الميت|التعزية|القبور|عيادة المريض/, ['المرض والموتى']],
  [/الهم والحزن|الكرب|لقاء العدو|خاف|الدعاء على العدو|شك في الإيمان|قضاء الدين|استصعب|أذنب|طرد الشيطان|لا يرضاه|الغضب|رأى مبتلى|الشرك|الطيرة|العين|الدجال|أمر يسره|أمر يكرهه|المدح|زكي|سببته/, ['الدعاء والهموم']],
  [/المولود|الأولاد|المتزوج|الزوجة/, ['المناسبات']],
  [/الريح|الرعد|الاستسقاء|المطر|الاستصحاء|الهلال|العطاس|المجلس|غفر الله لك|معروفاً|أحبك في الله|عرض عليك ماله|أقرض|بارك الله فيك|التعجب|الأمر السار|الذبح|الصلاة على النبي|إفشاء السلام|رد السلام|صياح الديك|نهيق|الحج|العمرة|الركن الأسود|الركن اليماني|الصفا والمروة|عرفة|رمي الجمار/, ['الأدعية الجامعية']],
  [/^الاستغفار والتوبة/, ['الاستغفار']]
];

function hisnCategories(section) {
  for (const [pattern, categories] of hisnCategoryRules) {
    if (pattern.test(section)) return categories;
  }
  return ['الأدعية الجامعية'];
}

/** مواضع الفضائل ليست أذكاراً تُعدّ؛ نُبقي الأذكار والأدعية فقط. */
const excludedSections = /^المقدمة$|^فضل |^كيف كان النبي|^من أنواع الخير/;

/** أعداد التكرار معروفة في «حصن المسلم» داخل النص؛ هذه قائمة مضبوطة للحالات المتكررة. */
const hisnCountOverrides = [
  [/ثلاثاً وثلاثين|ثلاثاً وثلاثون|\( ثلاثاً وثلاثين \)/, 33],
  [/أربعاً وثلاثين/, 34],
  [/أستغفر الله ثلاثاً/, 3],
  [/ثلاث مرات|ثلاثاً(?! )/, 3],
  [/سبع مرات|سبعاً/, 7],
  [/عشر مرات|عشراً/, 10],
  [/مائة مرة|مئة مرة/, 100],
  [/مرتين|مرّتين/, 2]
];

const arabicCountWord = (count) => {
  if (count === 1) return 'مرة واحدة';
  if (count === 2) return 'مرتان';
  if (count === 3) return 'ثلاث مرات';
  if (count === 7) return 'سبع مرات';
  if (count === 10) return 'عشر مرات';
  if (count === 100) return 'مئة مرة';
  return `${count} مرة`;
};

const hisnItems = hisnSource.data
  .filter((item) => !excludedSections.test(item.section))
  .map((item, index) => {
    const override = hisnCountOverrides.find(([pattern]) => pattern.test(item.arabic));
    const count = override ? override[1] : 1;
    return {
      id: `hisn-${String(index + 1).padStart(3, '0')}`,
      order: 1000 + index,
      content: item.arabic,
      count,
      countDescription: arabicCountWord(count),
      benefit: '',
      source: `حصن المسلم — ${item.section}`,
      sourceType: 3,
      categories: hisnCategories(item.section),
      audioUrl: null,
      hadithText: null,
      vocabulary: null,
      sourceId: item.id,
      section: item.section
    };
  });

const adhkarGenerated = {
  meta: {
    sourceName: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB + Hisn al-Muslim (حصن المسلم)',
    sourceVersion: fs.readFileSync(path.join(root, 'data/sources/adhkar/morning-evening-commit.txt'), 'utf8').trim(),
    sourceUrl: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    license: 'MIT (morning/evening dataset) + CC-BY-4.0 (Hisn al-Muslim data via npm @kazishariar/hisnul-muslim-data)',
    attribution: 'أذكار الصباح والمساء: Seen-Arabic/Morning-And-Evening-Adhkar-DB (MIT). أذكار وأدعية المواضع: «حصن المسلم» — بيانات @kazishariar/hisnul-muslim-data (CC-BY-4.0).',
    sourceSha256: sha256(adhkarSourcePath),
    hisnSourceSha256: sha256(hisnSourcePath),
    hisnSourcePath,
    generatedFrom: `${adhkarSourcePath} + ${hisnSourcePath}`,
    note: 'Arabic text, counts and references are copied from the source datasets. The generator adds app categories only.'
  },
  categories: [
    'أذكار الصباح',
    'أذكار المساء',
    'أذكار الصباح والمساء',
    'أذكار النوم',
    'أذكار الاستيقاظ',
    'أذكار الصلاة',
    'المنزل والوضوء',
    'المسجد والأذان',
    'الطعام والشراب',
    'السفر والحل والترحال',
    'المرض والموتى',
    'الدعاء والهموم',
    'الاستغفار',
    'المناسبات',
    'الأدعية الجامعية'
  ],
  items: [
    ...adhkarSource.map((item) => ({
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
    })),
    ...hisnItems
  ]
};
writeJson('src/data/adhkar/adhkar.generated.json', adhkarGenerated);

console.log(`Generated Quran data (${globalAyahNumber} ayat) and adhkar data (${adhkarGenerated.items.length} items).`);
