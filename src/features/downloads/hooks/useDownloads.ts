import { useCallback } from 'react';
import * as Sharing from 'expo-sharing';
import { useDownloadsStore } from '../store';
import {
  clearAllCompletedDownloads,
  deleteDownloadItem,
  enqueueNewDownload,
  pauseDownload,
  renameDownloadedFile,
  resumeDownload,
  retryDownload,
} from '../services/downloadService';
import { NewDownloadPayload } from '../types';
import { logError } from '@/lib/logger';

export function useDownloads() {
  const items = useDownloadsStore((s) => s.items);
  const isHydrated = useDownloadsStore((s) => s.isHydrated);
  const errorBanner = useDownloadsStore((s) => s.errorBanner);
  const openAddSheet = useDownloadsStore((s) => s.openAddSheet);
  const closeAddSheet = useDownloadsStore((s) => s.closeAddSheet);
  const setErrorBanner = useDownloadsStore((s) => s.setErrorBanner);

  const handleStartDownload = useCallback(async (payload: NewDownloadPayload) => {
    return enqueueNewDownload(payload);
  }, []);

  const handlePause = useCallback((id: string) => {
    pauseDownload(id).catch((err) => logError('handlePause', err));
  }, []);

  const handleResume = useCallback((id: string) => {
    resumeDownload(id).catch((err) => logError('handleResume', err));
  }, []);

  const handleRetry = useCallback((id: string) => {
    retryDownload(id).catch((err) => logError('handleRetry', err));
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteDownloadItem(id).catch((err) => logError('handleDelete', err));
  }, []);

  const handleRename = useCallback((id: string, newName: string) => {
    renameDownloadedFile(id, newName).catch((err) => logError('handleRename', err));
  }, []);

  const handleClearCompleted = useCallback(() => {
    clearAllCompletedDownloads().catch((err) =>
      logError('handleClearCompleted', err)
    );
  }, []);

  const handleShareFile = useCallback(async (localUri: string) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setErrorBanner('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(localUri);
    } catch (err) {
      logError('handleShareFile', err);
    }
  }, [setErrorBanner]);

  return {
    items,
    isHydrated,
    errorBanner,
    openAddSheet,
    closeAddSheet,
    setErrorBanner,
    handleStartDownload,
    handlePause,
    handleResume,
    handleRetry,
    handleDelete,
    handleRename,
    handleClearCompleted,
    handleShareFile,
  };
}
