import { useDownloadsStore } from '../store';

export function useDownloadProgress(id: string) {
  return useDownloadsStore((s) => s.progressById[id]);
}

