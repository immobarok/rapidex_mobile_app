import { useMemo } from 'react';
import { useDownloadsStore } from '../store';

export function useAggregateDownloadStats() {
  const items = useDownloadsStore((s) => s.items);
  const progressById = useDownloadsStore((s) => s.progressById);

  return useMemo(() => {
    let downloadingCount = 0;
    let pausedCount = 0;
    let queuedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let totalSpeedBytesPerSec = 0;
    let totalSavedBytes = 0;

    for (const item of items) {
      if (item.status === 'downloading') {
        downloadingCount += 1;
        totalSpeedBytesPerSec += progressById[item.id]?.speedBytesPerSec ?? 0;
      } else if (item.status === 'paused') {
        pausedCount += 1;
      } else if (item.status === 'queued') {
        queuedCount += 1;
      } else if (item.status === 'completed') {
        completedCount += 1;
        totalSavedBytes += item.totalBytes || item.downloadedBytes || 0;
      } else if (item.status === 'failed') {
        failedCount += 1;
      }
    }

    return {
      activeCount: downloadingCount + pausedCount + queuedCount,
      downloadingCount,
      pausedCount,
      queuedCount,
      completedCount,
      failedCount,
      totalSpeedBytesPerSec,
      totalSavedBytes,
    };
  }, [items, progressById]);
}
