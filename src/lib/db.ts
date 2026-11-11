import * as SQLite from 'expo-sqlite';
import { DownloadItemRecord, DownloadStatus, FileCategory } from '@/types';
import { logError } from './logger';

type DbRow = {
  id: string;
  url: string;
  file_name: string;
  local_uri: string;
  folder: string;
  category: string;
  mime_type: string;
  total_bytes: number;
  downloaded_bytes: number;
  status: string;
  error_message: string | null;
  resume_data: string | null;
  created_at: number;
  completed_at: number | null;
  last_playback_position_ms: number;
  duration_ms: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('rapidex.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS downloads (
          id TEXT PRIMARY KEY NOT NULL,
          url TEXT NOT NULL,
          file_name TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          folder TEXT NOT NULL DEFAULT 'Downloads',
          category TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          total_bytes INTEGER NOT NULL DEFAULT 0,
          downloaded_bytes INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          error_message TEXT,
          resume_data TEXT,
          created_at INTEGER NOT NULL,
          completed_at INTEGER,
          last_playback_position_ms INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER NOT NULL DEFAULT 0
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

function mapRowToRecord(row: DbRow): DownloadItemRecord {
  return {
    id: row.id,
    url: row.url,
    fileName: row.file_name,
    localUri: row.local_uri,
    folder: row.folder,
    category: row.category as FileCategory,
    mimeType: row.mime_type,
    totalBytes: row.total_bytes,
    downloadedBytes: row.downloaded_bytes,
    status: row.status as DownloadStatus,
    errorMessage: row.error_message,
    resumeData: row.resume_data,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    lastPlaybackPositionMs: row.last_playback_position_ms,
    durationMs: row.duration_ms,
  };
}

export async function fetchAllDownloadsFromDb(): Promise<DownloadItemRecord[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<DbRow>(
      'SELECT * FROM downloads ORDER BY created_at DESC;'
    );
    return rows.map(mapRowToRecord);
  } catch (err) {
    logError('fetchAllDownloadsFromDb', err);
    return [];
  }
}

export async function upsertDownloadInDb(item: DownloadItemRecord): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO downloads (
        id, url, file_name, local_uri, folder, category, mime_type,
        total_bytes, downloaded_bytes, status, error_message, resume_data,
        created_at, completed_at, last_playback_position_ms, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        local_uri = excluded.local_uri,
        folder = excluded.folder,
        category = excluded.category,
        mime_type = excluded.mime_type,
        total_bytes = excluded.total_bytes,
        downloaded_bytes = excluded.downloaded_bytes,
        status = excluded.status,
        error_message = excluded.error_message,
        resume_data = excluded.resume_data,
        completed_at = excluded.completed_at,
        last_playback_position_ms = excluded.last_playback_position_ms,
        duration_ms = excluded.duration_ms;`,
      item.id,
      item.url,
      item.fileName,
      item.localUri,
      item.folder,
      item.category,
      item.mimeType,
      item.totalBytes,
      item.downloadedBytes,
      item.status,
      item.errorMessage,
      item.resumeData,
      item.createdAt,
      item.completedAt,
      item.lastPlaybackPositionMs,
      item.durationMs
    );
  } catch (err) {
    logError('upsertDownloadInDb', err);
  }
}

export async function updatePlaybackPositionInDb(
  id: string,
  positionMs: number,
  durationMs: number
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `UPDATE downloads
       SET last_playback_position_ms = ?, duration_ms = ?
       WHERE id = ?;`,
      Math.max(0, Math.floor(positionMs)),
      Math.max(0, Math.floor(durationMs)),
      id
    );
  } catch (err) {
    logError('updatePlaybackPositionInDb', err);
  }
}

export async function deleteDownloadFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM downloads WHERE id = ?;', id);
  } catch (err) {
    logError('deleteDownloadFromDb', err);
  }
}

export async function deleteCompletedDownloadsFromDb(): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync("DELETE FROM downloads WHERE status = 'completed';");
  } catch (err) {
    logError('deleteCompletedDownloadsFromDb', err);
  }
}

