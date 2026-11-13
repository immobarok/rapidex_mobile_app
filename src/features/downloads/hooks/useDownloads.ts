import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { triggerHaptic } from '@/lib/haptics';
import { logError } from '@/lib/logger';
import { SaveFolderOption } from '@/features/settings/types';
import { useDownloadsStore } from '../store';
import {
  clearAllCompletedDownloads,
  clearAllFailedDownloads,
  deleteDownloadItem,
  enqueueNewDownload,
  moveDownloadedFileFolder,
  pauseAllDownloads,
  pauseDownload,
  renameDownloadedFile,
  resumeAllDownloads,
  resumeDownload,
  retryDownload,
} from '../services/downloadService';
import { NewDownloadPayload } from '../types';

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
    triggerHaptic('light');
    pauseDownload(id).catch((err) => logError('handlePause', err));
  }, []);

  const handlePauseAll = useCallback(() => {
    triggerHaptic('medium');
    pauseAllDownloads().catch((err) => logError('handlePauseAll', err));
  }, []);

  const handleResume = useCallback((id: string) => {
    triggerHaptic('light');
    resumeDownload(id).catch((err) => logError('handleResume', err));
  }, []);

  const handleResumeAll = useCallback(() => {
    triggerHaptic('medium');
    resumeAllDownloads().catch((err) => logError('handleResumeAll', err));
  }, []);

  const handleRetry = useCallback((id: string) => {
    triggerHaptic('light');
    retryDownload(id).catch((err) => logError('handleRetry', err));
  }, []);

  const handleDelete = useCallback((id: string) => {
    triggerHaptic('medium');
    deleteDownloadItem(id).catch((err) => logError('handleDelete', err));
  }, []);

  const handleRename = useCallback((id: string, newName: string) => {
    renameDownloadedFile(id, newName).catch((err) => logError('handleRename', err));
  }, []);

  const handleMoveFolder = useCallback((id: string, newFolder: SaveFolderOption) => {
    triggerHaptic('selection');
    moveDownloadedFileFolder(id, newFolder).catch((err) =>
      logError('handleMoveFolder', err)
    );
  }, []);

  const handleClearCompleted = useCallback(() => {
    triggerHaptic('medium');
    clearAllCompletedDownloads().catch((err) =>
      logError('handleClearCompleted', err)
    );
  }, []);

  const handleClearFailed = useCallback(() => {
    triggerHaptic('medium');
    clearAllFailedDownloads().catch((err) => logError('handleClearFailed', err));
  }, []);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await Clipboard.setStringAsync(url);
      triggerHaptic('selection');
    } catch (err) {
      logError('handleCopyUrl', err);
    }
  }, []);

  const handleShareFile = useCallback(
    async (localUri: string) => {
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
    },
    [setErrorBanner]
  );

  return {
    items,
    isHydrated,
    errorBanner,
    openAddSheet,
    closeAddSheet,
    setErrorBanner,
    handleStartDownload,
    handlePause,
    handlePauseAll,
    handleResume,
    handleResumeAll,
    handleRetry,
    handleDelete,
    handleRename,
    handleMoveFolder,
    handleClearCompleted,
    handleClearFailed,
    handleCopyUrl,
    handleShareFile,
  };
}
