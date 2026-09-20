import type { TafsirEntry } from '../core/types';

export interface TafsirRepository {
  getTafsir(surahId: number, ayahNumber: number): Promise<TafsirEntry>;
}

export class AlQuranCloudTafsirRepository implements TafsirRepository {
  async getTafsir(surahId: number, ayahNumber: number): Promise<TafsirEntry> {
    const endpoint = `https://api.alquran.cloud/v1/ayah/${surahId}:${ayahNumber}/ar.muyassar`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error('تعذر تحميل التفسير من المصدر.');
    }
    const payload = (await response.json()) as { data?: { text?: string; edition?: { name?: string; englishName?: string } } };
    const text = payload.data?.text;
    if (!text) throw new Error('لم يرجع المصدر نص تفسير لهذه الآية.');
    return {
      sourceName: payload.data?.edition?.name ?? 'تفسير الميسر — King Fahad Quran Complex',
      sourceUrl: endpoint,
      surahId,
      ayahNumber,
      text
    };
  }
}

export const tafsirRepository = new AlQuranCloudTafsirRepository();
