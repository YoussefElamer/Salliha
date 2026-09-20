import type { Bookmark, ReadingPosition } from '../core/types';
import { createId, storage } from '../core/storage';

export interface BookmarkRepository {
  list(): Bookmark[];
  add(surahId: number, ayahNumber: number, label?: string): Bookmark;
  remove(id: string): void;
  rename(id: string, label: string): Bookmark[];
  isBookmarked(surahId: number, ayahNumber: number): boolean;
  saveReadingPosition(position: Omit<ReadingPosition, 'updatedAt'>): ReadingPosition;
  getReadingPosition(): ReadingPosition | null;
}

const BOOKMARKS_KEY = 'bookmarks:v1';
const READING_KEY = 'reading-position:v1';

export class LocalBookmarkRepository implements BookmarkRepository {
  list(): Bookmark[] {
    return storage.get<Bookmark[]>(BOOKMARKS_KEY, []);
  }

  add(surahId: number, ayahNumber: number, label = 'علامة'): Bookmark {
    const existing = this.list();
    const duplicate = existing.find((item) => item.surahId === surahId && item.ayahNumber === ayahNumber);
    if (duplicate) return duplicate;
    const bookmark: Bookmark = { id: createId('bookmark'), surahId, ayahNumber, label, createdAt: new Date().toISOString() };
    storage.set(BOOKMARKS_KEY, [bookmark, ...existing]);
    return bookmark;
  }

  remove(id: string): void {
    storage.set(BOOKMARKS_KEY, this.list().filter((item) => item.id !== id));
  }

  rename(id: string, label: string): Bookmark[] {
    const next = this.list().map((item) => (item.id === id ? { ...item, label } : item));
    storage.set(BOOKMARKS_KEY, next);
    return next;
  }

  isBookmarked(surahId: number, ayahNumber: number): boolean {
    return this.list().some((item) => item.surahId === surahId && item.ayahNumber === ayahNumber);
  }

  saveReadingPosition(position: Omit<ReadingPosition, 'updatedAt'>): ReadingPosition {
    const next: ReadingPosition = { ...position, updatedAt: new Date().toISOString() };
    storage.set(READING_KEY, next);
    return next;
  }

  getReadingPosition(): ReadingPosition | null {
    return storage.get<ReadingPosition | null>(READING_KEY, null);
  }
}

export const bookmarkRepository = new LocalBookmarkRepository();
