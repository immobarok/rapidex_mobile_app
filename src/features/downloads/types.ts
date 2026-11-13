import { ActiveProgressSnapshot, DownloadItemRecord } from '@/types';

export type DownloadsTab = 'active' | 'completed' | 'failed';

export type NewDownloadPayload = {
  url: string;
  fileName: string;
  folder: string;
  totalBytes: number;
  mimeType: string;
  headers?: Record<string, string>;
};

export type DownloadsStoreState = {
  items: DownloadItemRecord[];
  progressById: Record<string, ActiveProgressSnapshot>;
  isHydrated: boolean;
  isAddSheetOpen: boolean;
  prefilledUrl: string;
  errorBanner: string | null;

  setHydratedItems: (items: DownloadItemRecord[]) => void;
  upsertItem: (item: DownloadItemRecord) => void;
  updateItemFields: (id: string, patch: Partial<DownloadItemRecord>) => void;
  removeItem: (id: string) => void;
  removeCompletedItems: () => void;
  removeFailedItems: () => void;
  setProgressSnapshot: (id: string, snapshot: ActiveProgressSnapshot) => void;
  clearProgressSnapshot: (id: string) => void;
  openAddSheet: (prefillUrl?: string) => void;
  closeAddSheet: () => void;
  setErrorBanner: (message: string | null) => void;
};

