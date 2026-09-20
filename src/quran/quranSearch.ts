import type { Ayah, Surah } from '../core/types';
import { normalizeArabic, normalizeArabicVariants, stripDefiniteArticle } from '../core/arabic';

export interface IndexedAyah {
  ayah: Ayah;
  /** كل صور النص المطبَّع (مع الألف الخنجرية محذوفة ومحوَّلة إلى ألف). */
  normalizedTexts: string[];
  tokens: string[];
  /** كل صورة ممكنة للكلمة (بدون «ال» وبدون حروف الجر المسبوقة) لمطابقة أوسع. */
  variants: string[];
}

export interface AyahSearchHit {
  ayah: Ayah;
  score: number;
  matchedTerms: string[];
  exactPhrase: boolean;
}

export interface AyahSearchOutcome {
  hits: AyahSearchHit[];
  /** true إذا لم تُطابق كل الكلمات، فتُعرض النتائج كـ«أقرب نتائج» لا كتطابق مؤكد. */
  approximate: boolean;
  terms: string[];
}

const PREFIX_LETTERS = ['و', 'ف', 'ب', 'ل', 'ك'];

/** يولّد صور الكلمة الممكنة: الكلمة نفسها، وبدون «ال»، وبدون حرف ابتدائي، ومعهما معًا. */
export function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  const withoutArticle = stripDefiniteArticle(token);
  if (withoutArticle !== token) variants.add(withoutArticle);
  for (const source of [token, withoutArticle]) {
    if (source.length >= 4 && PREFIX_LETTERS.includes(source[0])) {
      const stripped = source.slice(1);
      if (stripped.length >= 3) variants.add(stripped);
    }
  }
  return [...variants];
}

/** كلمات لا تُحسب في المطابقة إن كان الاستعلام يحتوي كلمات ذات معنى. */
const STOPWORD_TERMS = new Set(['سوره', 'ايه', 'الايه', 'القران', 'في', 'من', 'علي', 'عن', 'الي', 'هذا', 'هذه', 'الذي', 'التي']);

export class QuranSearchIndex {
  private readonly entries: IndexedAyah[] = [];
  private readonly postings = new Map<string, number[]>();
  private readonly documentFrequency = new Map<string, number>();
  private readonly surahByNormalizedName = new Map<string, Surah>();
  private ready = false;
  private totalTokens = 0;

  constructor(private readonly surahs: Surah[]) {}

  get size(): number {
    return this.entries.length;
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** يبني الفهرس مرة واحدة فقط عند أول بحث (لتقليل زمن بدء التطبيق). */
  build(): void {
    if (this.ready) return;
    for (const surah of this.surahs) {
      for (const ayah of surah.verses) {
        const normalizedTexts = normalizeArabicVariants(ayah.text);
        const tokens = normalizedTexts[0].split(' ').filter(Boolean);
        const allTokens = [...new Set(normalizedTexts.flatMap((text) => text.split(' ')))].filter(Boolean);
        const variants = [...new Set(allTokens.flatMap((token) => tokenVariants(token)))];
        const entryIndex = this.entries.length;
        this.entries.push({ ayah, normalizedTexts, tokens, variants });
        this.totalTokens += tokens.length;
        for (const variant of variants) {
          const list = this.postings.get(variant);
          if (list) list.push(entryIndex);
          else this.postings.set(variant, [entryIndex]);
        }
        for (const variant of new Set(variants)) {
          this.documentFrequency.set(variant, (this.documentFrequency.get(variant) ?? 0) + 1);
        }
      }
      this.surahByNormalizedName.set(normalizeArabic(`${surah.name} ${surah.transliteration} ${surah.surahId}`), surah);
      this.surahByNormalizedName.set(normalizeArabic(surah.name), surah);
    }
    this.ready = true;
  }

  private idf(token: string): number {
    const df = this.documentFrequency.get(token) ?? 0;
    if (!df) return 0;
    return Math.log(1 + this.entries.length / df);
  }

  /** يبحث في نطاق الكلمة: مطابقة تامة، ثم بادئة (للقراءة أثناء الكتابة). */
  private termWeight(term: string): Map<string, number> {
    const weights = new Map<string, number>();
    const variants = tokenVariants(term);
    for (const variant of variants) {
      const weight = variant === term ? 1 : variant.length >= 4 ? 0.92 : 0.8;
      if (this.postings.has(variant)) weights.set(variant, Math.max(weights.get(variant) ?? 0, weight));
    }
    if (weights.size === 0 && term.length >= 3) {
      for (const [token] of this.postings) {
        if (token.startsWith(term)) weights.set(token, Math.max(weights.get(token) ?? 0, 0.6));
      }
    }
    if (weights.size === 0 && term.length >= 4) {
      // تطابق تقريبي: الكلمة داخل الكلمة (يفيد مع اختلاف الألف/الهمزة والزيادات)
      for (const [token] of this.postings) {
        if (token.includes(term)) weights.set(token, Math.max(weights.get(token) ?? 0, 0.45));
      }
    }
    return weights;
  }

  search(rawQuery: string, limit = 40, options: { requireAllTerms?: boolean } = {}): AyahSearchOutcome {
    this.build();
    const normalizedVariants = normalizeArabicVariants(rawQuery).map((value) => value.trim()).filter(Boolean);
    const normalized = normalizedVariants[0] ?? '';
    if (!normalized) return { hits: [], approximate: false, terms: [] };

    const allTerms = [...new Set(normalizedVariants.flatMap((value) => value.split(' ')))].filter(Boolean);
    const meaningful = allTerms.filter((term) => !STOPWORD_TERMS.has(term));
    const terms = meaningful.length ? meaningful : allTerms;
    if (!terms.length) return { hits: [], approximate: false, terms: [] };

    const phrases = [...new Set(normalizedVariants)];
    if (meaningful.length && meaningful.length !== allTerms.length) phrases.push(meaningful.join(' '));

    const candidateScores = new Map<number, { score: number; matched: Set<string>; weights: Map<string, number> }>();
    let totalIdf = 0;

    for (const term of terms) {
      const weights = this.termWeight(term);
      if (!weights.size) continue;
      let bestIdf = 0;
      for (const [token, weight] of weights) bestIdf = Math.max(bestIdf, this.idf(token) * weight);
      totalIdf += bestIdf || this.idf(term);
      for (const [token, weight] of weights) {
        const decisiveWeight = weight >= 0.8 ? 1 : weight;
        const postings = this.postings.get(token) ?? [];
        const idf = this.idf(token);
        const contribution = idf * decisiveWeight;
        for (const entryIndex of postings) {
          const current = candidateScores.get(entryIndex) ?? { score: 0, matched: new Set<string>(), weights: new Map() };
          const previous = current.weights.get(term) ?? 0;
          if (contribution > previous) {
            current.score += contribution - previous;
            current.weights.set(term, contribution);
          }
          current.matched.add(term);
          candidateScores.set(entryIndex, current);
        }
      }
    }

    if (!candidateScores.size) return { hits: [], approximate: false, terms };

    const requireAll = options.requireAllTerms ?? terms.length > 1;
    const hits: AyahSearchHit[] = [];
    let anyApproximate = false;

    for (const [entryIndex, candidate] of candidateScores) {
      const entry = this.entries[entryIndex];
      const coverage = candidate.matched.size / terms.length;
      const complete = candidate.matched.size === terms.length;
      if (requireAll && !complete) {
        anyApproximate = true;
        if (coverage < 0.5 && terms.length > 1) continue;
      }
      let score = candidate.score * (complete ? 1 : Math.pow(coverage, 2.2) * 0.45);

      const exactPhrase = phrases.some((phrase) => entry.normalizedTexts.some((text) => text.includes(phrase)));
      if (exactPhrase) score += 2.2 * (totalIdf || 1);

      if (complete && terms.length > 1) {
        const positions = terms.map((term) => this.firstPositionOf(entry, term));
        const ordered = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
        if (ordered && positions.every((position) => position >= 0)) score += 0.6 * (totalIdf || 1);
      }

      const lengthFactor = 1 + 0.22 * (1 - Math.min(1, entry.tokens.length / 60));
      score *= lengthFactor;
      if (entry.ayah.surahId === 1 || entry.ayah.surahId === 112) score *= 1.01;

      hits.push({ ayah: entry.ayah, score, matchedTerms: [...candidate.matched], exactPhrase });
    }

    hits.sort((a, b) => b.score - a.score || a.ayah.globalAyahNumber - b.ayah.globalAyahNumber);
    const limited = hits.slice(0, limit);
    const complete = limited.length > 0 && limited.every((hit) => hit.matchedTerms.length === terms.length);
    return { hits: limited, approximate: !complete && !hits.some((hit) => hit.exactPhrase) ? true : anyApproximate && limited.some((hit) => hit.matchedTerms.length < terms.length), terms };
  }

  private firstPositionOf(entry: IndexedAyah, term: string): number {
    const variants = new Set(tokenVariants(term));
    for (let index = 0; index < entry.tokens.length; index += 1) {
      const token = entry.tokens[index];
      if (variants.has(token) || [...variants].some((variant) => token.startsWith(variant))) return index;
    }
    return -1;
  }

  /** بحث في أسماء السور ورقم السورة. */
  searchSurahs(rawQuery: string, limit = 10): Surah[] {
    const normalized = normalizeArabic(rawQuery).replace(/\bسوره\b/g, '').trim();
    if (!normalized) return [];
    const directNumber = Number(normalized);
    const results: Surah[] = [];
    if (Number.isInteger(directNumber) && directNumber >= 1 && directNumber <= this.surahs.length) {
      results.push(this.surahs[directNumber - 1]);
    }
    for (const [key, surah] of this.surahByNormalizedName) {
      if (key.includes(normalized) && !results.includes(surah)) results.push(surah);
      if (results.length >= limit) break;
    }
    return results.slice(0, limit);
  }

  /** يفسّر المراجع الرقمية مثل «2:255» أو «البقرة 255» أو «255 2». */
  resolveReference(rawQuery: string): Ayah | null {
    const normalized = normalizeArabic(rawQuery);
    const direct = normalized.match(/^(\d{1,3})\s*[:\s]\s*(\d{1,3})$/);
    if (direct) {
      const [surahId, ayahNumber] = [Number(direct[1]), Number(direct[2])];
      const surah = this.surahs.find((item) => item.surahId === surahId);
      const ayah = surah?.verses.find((item) => item.ayahNumber === ayahNumber);
      if (ayah) return ayah;
    }
    const bare = normalized.match(/^(\d{1,3})$/);
    if (bare) return null;
    const named = normalized.match(/^(.+?)\s+(\d{1,3})$/);
    if (named) {
      const surahs = this.searchSurahs(named[1], 1);
      const ayahNumber = Number(named[2]);
      const ayah = surahs[0]?.verses.find((item) => item.ayahNumber === ayahNumber);
      if (ayah) return ayah;
    }
    return null;
  }

  get stats(): { ayat: number; tokens: number; uniqueTokens: number } {
    return { ayat: this.entries.length, tokens: this.totalTokens, uniqueTokens: this.postings.size };
  }
}
