import { Download, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatArabicNumber } from '../core/arabic';
import { adhkarRepository } from './AdhkarRepository';

export function AdhkarPage() {
  const [category, setCategory] = useState('أذكار الصباح');
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [loadingOpenDua, setLoadingOpenDua] = useState(false);
  const [message, setMessage] = useState('');
  const categories = adhkarRepository.getCategories();
  const items = useMemo(() => (query ? adhkarRepository.search(query) : adhkarRepository.list(category)), [category, query, version]);
  const bump = () => setVersion((value) => value + 1);
  const loadOpenDua = async () => {
    setLoadingOpenDua(true);
    setMessage('');
    try {
      const count = await adhkarRepository.loadOpenDuaCatalogue();
      setMessage(`تم تحميل ${formatArabicNumber(count)} دعاء من OpenDua وحفظها محليًا لهذا الجهاز.`);
      bump();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل OpenDua.');
    } finally {
      setLoadingOpenDua(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="card full-span">
        <div className="section-heading">
          <h1>الأذكار</h1>
          <span>{items.length} ذكر</span>
        </div>
        <p className="source-note">المصدر المضمّن: {adhkarRepository.getMetadata().sourceName} — الترخيص {adhkarRepository.getMetadata().license}. لا يتم توليد نصوص الأذكار بالذكاء الاصطناعي. يمكن تحميل حصن المسلم كاملًا من OpenDua (CC BY 4.0) وحفظه محليًا عند توفر الإنترنت.</p>
        <div className="inline-actions"><button className="secondary-button" disabled={loadingOpenDua} onClick={loadOpenDua}><Download /> {loadingOpenDua ? 'جاري التحميل...' : 'تحميل أدعية OpenDua'}</button></div>
        {message && <p className="state-note">{message}</p>}
        <div className="toolbar-row">
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الأذكار..." /></div>
        </div>
      </section>

      {items.map((item) => {
        const counter = adhkarRepository.getCounter(item.id);
        return (
          <article className="card dhikr-card" key={item.id}>
            <div className="section-heading"><h2>{item.categories[0]}</h2><span>{item.countDescription}</span></div>
            <p className="dhikr-text">{item.content}</p>
            {item.benefit && <p className="muted">{item.benefit}</p>}
            <details><summary>المصدر والتخريج</summary><p>{item.source}</p>{item.hadithText && <p>{item.hadithText}</p>}</details>
            <div className="counter-panel">
              <button className="counter-button" onClick={() => { adhkarRepository.setCounter(item.id, counter + 1); bump(); }} aria-label="زيادة العداد">
                {formatArabicNumber(counter)}
              </button>
              <span>المطلوب من المصدر: {formatArabicNumber(item.count)}</span>
              <button className="icon-button" onClick={() => { adhkarRepository.resetCounter(item.id); bump(); }} aria-label="إعادة العداد"><RotateCcw /></button>
            </div>
          </article>
        );
      })}

      {!items.length && <section className="card empty-state"><h2>لا توجد نتائج</h2><p>جرّب عبارة أخرى أو اختر تصنيفًا مختلفًا.</p></section>}
    </div>
  );
}
