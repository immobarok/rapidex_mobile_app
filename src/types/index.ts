export type FileCategory = 'video' | 'audio' | 'document' | 'other';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed';

export type SortOption = 'date' | 'name' | 'size';

export type DownloadItemRecord = {
  id: string;
  url: string;
  fileName: string;
  localUri: string;
  folder: string;
  category: FileCategory;
  mimeType: string;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  errorMessage: string | null;
  resumeData: string | null;
  createdAt: number;
  completedAt: number | null;
  lastPlaybackPositionMs: number;
  durationMs: number;
};

export type ActiveProgressSnapshot = {
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
};

