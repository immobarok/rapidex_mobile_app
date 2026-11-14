import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { importSharedLocalFile } from '@/features/downloads/services/downloadService';
import { useDownloadsStore } from '@/features/downloads/store';
import { logError } from '@/lib/logger';
import { extractFirstHttpUrl, validateAnyHttpUrl } from '@/lib/validateUrl';

/**
 * Listens for incoming links/files from OS Share Sheet (`expo-share-intent`) and
 * `rapidex://` deep links, routing them into `AddLinkSheet` or the offline Library.
 */
export function ShareIntentListener() {
  const router = useRouter();
  const openAddSheet = useDownloadsStore((s) => s.openAddSheet);
  const setErrorBanner = useDownloadsStore((s) => s.setErrorBanner);
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntentContext();
  const linkingUrl = Linking.useLinkingURL();
  const lastHandledDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }

    const candidateUrl =
      shareIntent.webUrl?.trim() ||
      (shareIntent.text ? extractFirstHttpUrl(shareIntent.text) : null);

    if (candidateUrl) {
      const check = validateAnyHttpUrl(candidateUrl);
      if (check.isValid) {
        openAddSheet(check.normalizedUrl);
        resetShareIntent();
        return;
      }
    }

    const sharedFile = shareIntent.files?.[0];
    if (sharedFile?.path) {
      const fileUri = sharedFile.path;
      const fallbackName = fileUri.split('/').pop() || `shared_${Date.now()}`;
      importSharedLocalFile({
        sourceUri: fileUri,
        fileName: sharedFile.fileName || fallbackName,
        mimeType: sharedFile.mimeType || 'application/octet-stream',
        sizeBytes: sharedFile.size,
      })
        .then(() => {
          router.navigate('/(tabs)/library');
        })
        .catch((err) => {
          logError('ShareIntentListener-fileImport', err);
          setErrorBanner('Could not import shared file into Rapidex.');
        })
        .finally(() => {
          resetShareIntent();
        });
      return;
    }

    resetShareIntent();
  }, [
    hasShareIntent,
    openAddSheet,
    resetShareIntent,
    router,
    setErrorBanner,
    shareIntent,
  ]);

  useEffect(() => {
    if (!error) {
      return;
    }
    logError('ShareIntentListener-nativeError', error);
  }, [error]);

  useEffect(() => {
    if (!linkingUrl || linkingUrl.includes('dataUrl=')) {
      return;
    }
    if (lastHandledDeepLinkRef.current === linkingUrl) {
      return;
    }

    try {
      const parsed = Linking.parse(linkingUrl);
      const rawParam = parsed.queryParams?.url;
      const candidate = Array.isArray(rawParam) ? rawParam[0] : rawParam;
      if (typeof candidate === 'string' && candidate.trim()) {
        const extracted = extractFirstHttpUrl(candidate) ?? candidate.trim();
        const check = validateAnyHttpUrl(extracted);
        if (check.isValid) {
          lastHandledDeepLinkRef.current = linkingUrl;
          openAddSheet(check.normalizedUrl);
          if (Platform.OS !== 'web') {
            Linking.clearInitialURL();
          }
        }
      }
    } catch {
      // Ignore malformed linking URLs
    }
  }, [linkingUrl, openAddSheet]);

  return null;
}

