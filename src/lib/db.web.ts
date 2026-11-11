import { DownloadItemRecord } from '@/types';
import { logError } from './logger';
import { kvStorage } from './storage';

const WEB_DB_KEY = 'rapidex.web.downloads';

function readAllFromWebStorage(): DownloadItemRecord[] {
  try {
    const raw = kvStorage.getString(WEB_DB_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as DownloadItemRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logError('readAllFromWebStorage', err);
    return [];
  }
}

function writeAllToWebStorage(items: DownloadItemRecord[]): void {
  try {
    kvStorage.set(WEB_DB_KEY, JSON.stringify(items));
  } catch (err) {
    logError('writeAllToWebStorage', err);
  }
}

export async function fetchAllDownloadsFromDb(): Promise<DownloadItemRecord[]> {
  const items = readAllFromWebStorage();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function upsertDownloadInDb(item: DownloadItemRecord): Promise<void> {
  const items = readAllFromWebStorage();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) {
    items.unshift(item);
  } else {
    items[idx] = item;
  }
  writeAllToWebStorage(items);
}

export async function updatePlaybackPositionInDb(
  id: string,
  positionMs: number,
  durationMs: number
): Promise<void> {
  const items = readAllFromWebStorage();
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1 && items[idx]) {
    items[idx] = {
      ...items[idx],
      lastPlaybackPositionMs: Math.max(0, Math.floor(positionMs)),
      durationMs: Math.max(0, Math.floor(durationMs)),
    };
    writeAllToWebStorage(items);
  }
}

export async function deleteDownloadFromDb(id: string): Promise<void> {
  const items = readAllFromWebStorage().filter((i) => i.id !== id);
  writeAllToWebStorage(items);
}

export async function deleteCompletedDownloadsFromDb(): Promise<void> {
  const items = readAllFromWebStorage().filter((i) => i.status !== 'completed');
  writeAllToWebStorage(items);
}
