import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import {
  deleteCompletedDownloadsFromDb,
  deleteDownloadFromDb,
  fetchAllDownloadsFromDb,
  upsertDownloadInDb,
} from '@/lib/db';
import {
  detectFileCategory,
  inferMimeType,
  sanitizeFileName,
  sanitizeFolderName,
} from '@/lib/fileType';
import { logError } from '@/lib/logger';
import { useSettingsStore } from '@/features/settings/store';
import { DownloadItemRecord } from '@/types';
import { useDownloadsStore } from '../store';
import { NewDownloadPayload } from '../types';

const PROGRESS_THROTTLE_MS = 250;
const MIN_FREE_DISK_BYTES = 25 * 1024 * 1024; // 25 MB safety margin

type TaskMeta = {
  resumable: FileSystem.DownloadResumable;
  lastUiEmitMs: number;
  lastBytes: number;
  lastSampleMs: number;
  smoothedSpeed: number;
};

const activeTasks = new Map<string, TaskMeta>();
let isInitializing = false;

function getBaseDirectory(): string {
  return FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
}

async function ensureFolderExists(folder: string): Promise<string> {
  const safeFolder = sanitizeFolderName(folder);
  const baseDir = getBaseDirectory();
  if (!baseDir) {
    return '';
  }
  const dirUri = `${baseDir}rapidex/${safeFolder}/`;
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
  return dirUri;
}

async function buildSafeLocalUri(folder: string, fileName: string, id: string): Promise<string> {
  const dirUri = await ensureFolderExists(folder);
  const cleanName = sanitizeFileName(fileName);
  return `${dirUri}${id}_${cleanName}`;
}

async function verifyNetworkAllowsDownload(): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const netState = await Network.getNetworkStateAsync();
    if (netState.isConnected === false) {
      return {
        allowed: false,
        reason: 'No internet connection. Download queued until network returns.',
      };
    }
    const { wifiOnly } = useSettingsStore.getState();
    if (wifiOnly && netState.type !== Network.NetworkStateType.WIFI) {
      return {
        allowed: false,
        reason: 'Wi-Fi Only mode is enabled in Settings. Connect to Wi-Fi to start.',
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

async function verifySufficientStorage(expectedBytes: number): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const required = Math.max(expectedBytes, 0) + MIN_FREE_DISK_BYTES;
    return freeBytes > required;
  } catch {
    return true;
  }
}

async function notifyDownloadComplete(fileName: string): Promise<void> {
  const { notificationsEnabled } = useSettingsStore.getState();
  if (!notificationsEnabled || Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download Complete',
        body: `${fileName} is ready in your library.`,
      },
      trigger: null,
    });
  } catch (err) {
    logError('notifyDownloadComplete', err);
  }
}

export async function hydrateDownloadsAndRecoverQueue(): Promise<void> {
  if (isInitializing) {
    return;
  }
  isInitializing = true;
  try {
    const records = await fetchAllDownloadsFromDb();
    const normalized: DownloadItemRecord[] = [];

    for (const item of records) {
      if (item.status === 'downloading') {
        // Recover interrupted downloads as queued or paused with resumeData
        const recovered: DownloadItemRecord = {
          ...item,
          status: 'queued',
        };
        await upsertDownloadInDb(recovered);
        normalized.push(recovered);
      } else {
        normalized.push(item);
      }
    }

    useDownloadsStore.getState().setHydratedItems(normalized);
    await processDownloadQueue();
  } catch (err) {
    logError('hydrateDownloadsAndRecoverQueue', err);
    useDownloadsStore.getState().setHydratedItems([]);
  } finally {
    isInitializing = false;
  }
}

export async function enqueueNewDownload(payload: NewDownloadPayload): Promise<string> {
  const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanName = sanitizeFileName(payload.fileName);
  const safeFolder = sanitizeFolderName(payload.folder);
  const hasSpace = await verifySufficientStorage(payload.totalBytes);

  if (!hasSpace) {
    useDownloadsStore
      .getState()
      .setErrorBanner('Low device storage. Free up space before downloading this file.');
    throw new Error('Insufficient storage space on device.');
  }

  const localUri = await buildSafeLocalUri(safeFolder, cleanName, id);
  const mimeType = inferMimeType(cleanName, payload.mimeType);
  const category = detectFileCategory(cleanName, mimeType);

  const record: DownloadItemRecord = {
    id,
    url: payload.url,
    fileName: cleanName,
    localUri,
    folder: safeFolder,
    category,
    mimeType,
    totalBytes: payload.totalBytes,
    downloadedBytes: 0,
    status: 'queued',
    errorMessage: null,
    resumeData: null,
    createdAt: Date.now(),
    completedAt: null,
    lastPlaybackPositionMs: 0,
    durationMs: 0,
  };

  useDownloadsStore.getState().upsertItem(record);
  await upsertDownloadInDb(record);
  await processDownloadQueue();
  return id;
}

export async function processDownloadQueue(): Promise<void> {
  const store = useDownloadsStore.getState();
  const { maxConcurrent } = useSettingsStore.getState();

  const currentlyDownloadingCount = store.items.filter(
    (item) => item.status === 'downloading'
  ).length;

  if (currentlyDownloadingCount >= maxConcurrent) {
    return;
  }

  const queuedItems = store.items
    .filter((item) => item.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt);

  if (queuedItems.length === 0) {
    return;
  }

  const netCheck = await verifyNetworkAllowsDownload();
  if (!netCheck.allowed) {
    if (netCheck.reason) {
      store.setErrorBanner(netCheck.reason);
    }
    return;
  }

  store.setErrorBanner(null);
  const slotsAvailable = maxConcurrent - currentlyDownloadingCount;
  const toStart = queuedItems.slice(0, slotsAvailable);

  for (const item of toStart) {
    startDownloadTask(item).catch((err) => logError('startDownloadTask', err));
  }
}

async function startDownloadTask(item: DownloadItemRecord): Promise<void> {
  if (activeTasks.has(item.id)) {
    return;
  }

  const store = useDownloadsStore.getState();
  const updated: DownloadItemRecord = {
    ...item,
    status: 'downloading',
    errorMessage: null,
  };
  store.upsertItem(updated);
  await upsertDownloadInDb(updated);

  const onProgress = (data: FileSystem.DownloadProgressData) => {
    const meta = activeTasks.get(item.id);
    if (!meta) {
      return;
    }
    const now = Date.now();
    if (now - meta.lastUiEmitMs < PROGRESS_THROTTLE_MS) {
      return;
    }

    const elapsedSec = Math.max((now - meta.lastSampleMs) / 1000, 0.05);
    const deltaBytes = Math.max(0, data.totalBytesWritten - meta.lastBytes);
    const instantSpeed = deltaBytes / elapsedSec;
    const smoothedSpeed =
      meta.smoothedSpeed > 0
        ? meta.smoothedSpeed * 0.65 + instantSpeed * 0.35
        : instantSpeed;

    meta.lastUiEmitMs = now;
    meta.lastSampleMs = now;
    meta.lastBytes = data.totalBytesWritten;
    meta.smoothedSpeed = smoothedSpeed;

    const totalBytes =
      data.totalBytesExpectedToWrite > 0
        ? data.totalBytesExpectedToWrite
        : item.totalBytes;

    const remainingBytes = Math.max(0, totalBytes - data.totalBytesWritten);
    const etaSeconds =
      smoothedSpeed > 0 && totalBytes > 0 ? remainingBytes / smoothedSpeed : null;

    useDownloadsStore.getState().setProgressSnapshot(item.id, {
      downloadedBytes: data.totalBytesWritten,
      totalBytes,
      speedBytesPerSec: smoothedSpeed,
      etaSeconds,
    });

    useDownloadsStore.getState().updateItemFields(item.id, {
      downloadedBytes: data.totalBytesWritten,
      totalBytes,
    });
  };

  const resumable = FileSystem.createDownloadResumable(
    item.url,
    item.localUri,
    { sessionType: FileSystem.FileSystemSessionType.BACKGROUND },
    onProgress,
    item.resumeData ?? undefined
  );

  activeTasks.set(item.id, {
    resumable,
    lastUiEmitMs: 0,
    lastBytes: item.downloadedBytes,
    lastSampleMs: Date.now(),
    smoothedSpeed: 0,
  });

  try {
    const result = item.resumeData
      ? await resumable.resumeAsync()
      : await resumable.downloadAsync();

    activeTasks.delete(item.id);
    useDownloadsStore.getState().clearProgressSnapshot(item.id);

    const latestItem = useDownloadsStore
      .getState()
      .items.find((i) => i.id === item.id);

    if (!latestItem || latestItem.status === 'paused') {
      return;
    }

    if (!result || (result.status >= 400 && result.status < 600)) {
      const statusMsg = result
        ? `Server responded with status ${result.status}`
        : 'Download interrupted';
      const failedRecord: DownloadItemRecord = {
        ...latestItem,
        status: 'failed',
        errorMessage: statusMsg,
      };
      useDownloadsStore.getState().upsertItem(failedRecord);
      await upsertDownloadInDb(failedRecord);
      await processDownloadQueue();
      return;
    }

    let finalSize = latestItem.totalBytes || latestItem.downloadedBytes;
    try {
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && 'size' in info && typeof info.size === 'number') {
        finalSize = info.size;
      }
    } catch {
      // Ignore file stat error
    }

    const completedRecord: DownloadItemRecord = {
      ...latestItem,
      localUri: result.uri,
      totalBytes: finalSize,
      downloadedBytes: finalSize,
      status: 'completed',
      errorMessage: null,
      resumeData: null,
      completedAt: Date.now(),
    };

    useDownloadsStore.getState().upsertItem(completedRecord);
    await upsertDownloadInDb(completedRecord);
    await notifyDownloadComplete(completedRecord.fileName);
    await processDownloadQueue();
  } catch (err) {
    activeTasks.delete(item.id);
    useDownloadsStore.getState().clearProgressSnapshot(item.id);

    const current = useDownloadsStore.getState().items.find((i) => i.id === item.id);
    if (!current || current.status === 'paused') {
      return;
    }

    const message =
      err instanceof Error ? err.message : 'Network error while downloading file.';
    const failedRecord: DownloadItemRecord = {
      ...current,
      status: 'failed',
      errorMessage: message,
    };
    useDownloadsStore.getState().upsertItem(failedRecord);
    await upsertDownloadInDb(failedRecord);
    await processDownloadQueue();
  }
}

export async function pauseDownload(id: string): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return;
  }

  const meta = activeTasks.get(id);
  let resumeData: string | null = item.resumeData;

  if (meta) {
    activeTasks.delete(id);
    try {
      const pauseState = await meta.resumable.pauseAsync();
      resumeData = pauseState.resumeData ?? null;
    } catch (err) {
      logError('pauseDownload', err);
    }
  }

  store.clearProgressSnapshot(id);
  const updated: DownloadItemRecord = {
    ...item,
    status: 'paused',
    resumeData,
  };
  store.upsertItem(updated);
  await upsertDownloadInDb(updated);
  await processDownloadQueue();
}

export async function resumeDownload(id: string): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return;
  }

  const updated: DownloadItemRecord = {
    ...item,
    status: 'queued',
    errorMessage: null,
  };
  store.upsertItem(updated);
  await upsertDownloadInDb(updated);
  await processDownloadQueue();
}

export async function retryDownload(id: string): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return;
  }

  const updated: DownloadItemRecord = {
    ...item,
    status: 'queued',
    downloadedBytes: 0,
    resumeData: null,
    errorMessage: null,
  };
  store.upsertItem(updated);
  await upsertDownloadInDb(updated);
  await processDownloadQueue();
}

export async function deleteDownloadItem(id: string): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items.find((i) => i.id === id);

  const meta = activeTasks.get(id);
  if (meta) {
    activeTasks.delete(id);
    try {
      await meta.resumable.cancelAsync();
    } catch {
      // Ignore cancellation error
    }
  }

  if (item?.localUri) {
    try {
      await FileSystem.deleteAsync(item.localUri, { idempotent: true });
    } catch (err) {
      logError('deleteDownloadItem-file', err);
    }
  }

  store.removeItem(id);
  await deleteDownloadFromDb(id);
  await processDownloadQueue();
}

export async function renameDownloadedFile(
  id: string,
  newFileName: string
): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return;
  }

  const cleanName = sanitizeFileName(newFileName);
  const updated: DownloadItemRecord = {
    ...item,
    fileName: cleanName,
  };
  store.upsertItem(updated);
  await upsertDownloadInDb(updated);
}

export async function clearAllCompletedDownloads(): Promise<void> {
  const store = useDownloadsStore.getState();
  const completed = store.items.filter((i) => i.status === 'completed');

  for (const item of completed) {
    if (item.localUri) {
      try {
        await FileSystem.deleteAsync(item.localUri, { idempotent: true });
      } catch {
        // Ignore individual deletion failure
      }
    }
  }

  store.removeCompletedItems();
  await deleteCompletedDownloadsFromDb();
}
