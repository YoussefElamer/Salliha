import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { quranRepository } from '../quran/QuranRepository';
import { settingsRepository } from '../settings/settingsRepository';

export function ProfilePage() {
  const [bookmarks, setBookmarks] = useState(() => bookmarkRepository.list());
  const fileInput = useRef<HTMLInputElement | null>(null);
  const last = bookmarkRepository.getReadingPosition();
  const exportBackup = () => {
    const blob = new Blob([settingsRepository.exportLocalBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salliha-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importBackup = async (file: File) => {
    settingsRepository.importLocalBackup(await file.text());
    setBookmarks(bookmarkRepository.list());
  };

  return (
    <div className="page-grid two-columns">
      <section className="card">
        <h1>مساحتي</h1>
        <p className="muted">بدون تسجيل دخول. كل البيانات محفوظة محليًا على جهازك.</p>
        {last ? <p>آخر قراءة: سورة {quranRepository.getAyah(last.surahId, last.ayahNumber)?.surahName} — الآية {last.ayahNumber}</p> : <p>لا يوجد موضع قراءة محفوظ بعد.</p>}
        <div className="inline-actions">
          <button className="secondary-button" onClick={exportBackup}><Download /> Export JSON</button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload /> Import JSON</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importBackup(event.target.files[0])} />
        </div>
      </section>

      <section className="card">
        <h2>العلامات</h2>
        <div className="result-list">
          {bookmarks.map((bookmark) => {
            const ayah = quranRepository.getAyah(bookmark.surahId, bookmark.ayahNumber);
            return <article className="result-item" key={bookmark.id}><div><h3>{bookmark.label}</h3><p>{ayah ? `${ayah.surahName} — ${ayah.ayahNumber}` : `${bookmark.surahId}:${bookmark.ayahNumber}`}</p></div><button onClick={() => { bookmarkRepository.remove(bookmark.id); setBookmarks(bookmarkRepository.list()); }}>حذف</button></article>;
          })}
          {!bookmarks.length && <p className="muted">لا توجد علامات محفوظة.</p>}
        </div>
      </section>

      <section className="card">
        <h2>إحصائيات شخصية</h2>
        <div className="stats-grid">
          <div><strong>{bookmarks.length}</strong><span>Bookmarks</span></div>
          <div><strong>{last ? 1 : 0}</strong><span>موضع قراءة</span></div>
          <div><strong>محلي</strong><span>مزامنة</span></div>
        </div>
        <p className="muted">لا توجد Leaderboards أو مقارنات دينية بين المستخدمين.</p>
      </section>
    </div>
  );
}
