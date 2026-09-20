import { BookOpen, Bookmark, Headphones, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Ayah, SearchResult } from '../core/types';
import type { AppRoute } from '../app/navigation';
import { appSearchRepository } from './searchRepository';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';

const labels: Record<SearchResult['type'], string> = {
  ayah: 'آيات',
  surah: 'سور',
  adhkar: 'أذكار',
  reciter: 'قراء',
  tafsir: 'تفسير'
};

export function SearchPage({ navigate }: { navigate: (route: AppRoute) => void }) {
  const [query, setQuery] = useState('');
  const audio = useAudio();
  const results = useMemo(() => appSearchRepository.search(query), [query]);
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    acc[result.type] = [...(acc[result.type] ?? []), result];
    return acc;
  }, {});

  const playIfAyah = (result: SearchResult) => {
    if (result.type === 'ayah') audio.playAyah(result.payload as Ayah);
  };
  const bookmarkIfAyah = (result: SearchResult) => {
    if (result.type === 'ayah') {
      const ayah = result.payload as Ayah;
      bookmarkRepository.add(ayah.surahId, ayah.ayahNumber, 'من البحث');
    }
  };

  return (
    <div className="page-grid">
      <section className="card full-span">
        <h1>البحث العام</h1>
        <p className="muted">البحث عن الآيات يعتمد حصراً على قاعدة بيانات القرآن المحلية، ويدعم البحث بدون تشكيل، اسم السورة، رقم السورة ورقم الآية. لا يخمّن التطبيق موضع آية.</p>
        <div className="search-box large"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: فاصبر صبرا جميلا" /></div>
      </section>
      {!query && <section className="card empty-state"><h2>اكتب ما تبحث عنه</h2><p>يمكنك البحث في القرآن، السور، الأذكار والقراء.</p></section>}
      {Object.entries(grouped).map(([type, group]) => (
        <section className="card full-span" key={type}>
          <h2>{labels[type as SearchResult['type']]}</h2>
          <div className="result-list">
            {group.map((result) => (
              <article key={result.id} className="result-item">
                <div>
                  <h3>{result.title}</h3>
                  {result.subtitle && <small>{result.subtitle}</small>}
                  {result.text && <p className={result.type === 'ayah' ? 'quran-snippet' : ''}>{result.text}</p>}
                </div>
                <div className="inline-actions">
                  {result.type === 'ayah' && <button onClick={() => playIfAyah(result)}><Headphones size={18} /> تشغيل</button>}
                  {result.type === 'ayah' && <button onClick={() => bookmarkIfAyah(result)}><Bookmark size={18} /> علامة</button>}
                  <button onClick={() => navigate(result.type === 'adhkar' ? 'adhkar' : result.type === 'reciter' ? 'audio' : 'quran')}><BookOpen size={18} /> فتح</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {query && results.length === 0 && <section className="card empty-state"><h2>لا توجد نتائج مؤكدة</h2><p>لم يتم العثور على النص داخل قاعدة القرآن أو البيانات المحلية. لن يعرض التطبيق تخمينًا على أنه آية.</p></section>}
    </div>
  );
}
