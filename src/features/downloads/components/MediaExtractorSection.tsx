import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrangeButton } from '@/components/OrangeButton';
import { useSettingsStore } from '@/features/settings/store';
import { SaveFolderOption } from '@/features/settings/types';
import { formatBytes } from '@/lib/formatBytes';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { enqueueNewDownload, resolveSmartFolder } from '../services/downloadService';
import {
  isValidExtractorEndpoint,
  MediaQualityPreference,
  MediaResolveResult,
  ResolvedMediaFormat,
  resolveMediaUrl,
} from '../services/mediaResolverService';

const QUALITY_OPTIONS: { key: MediaQualityPreference; label: string }[] = [
  { key: 'best', label: 'Best' },
  { key: '1080', label: '1080p' },
  { key: '720', label: '720p' },
  { key: '480', label: '480p' },
  { key: 'audio', label: 'Audio' },
];

type Props = {
  mediaUrl: string;
  selectedFolder: SaveFolderOption;
  hasManualFolderPick: boolean;
  onAutoFolderChange: (folder: SaveFolderOption) => void;
  customHeaders?: Record<string, string>;
  onCloseSheet: () => void;
};

function detectPlatformLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'Facebook';
  if (lower.includes('x.com') || lower.includes('twitter.com')) return 'X';
  return 'Media Link';
}

export function MediaExtractorSection({
  mediaUrl,
  selectedFolder,
  hasManualFolderPick,
  onAutoFolderChange,
  customHeaders,
  onCloseSheet,
}: Props) {
  const router = useRouter();
  const extractorApiUrl = useSettingsStore((s) => s.extractorApiUrl);
  const setExtractorApiUrl = useSettingsStore((s) => s.setExtractorApiUrl);
  const autoRouteFolders = useSettingsStore((s) => s.autoRouteFolders);
  const defaultFolder = useSettingsStore((s) => s.defaultFolder);

  const [quality, setQuality] = useState<MediaQualityPreference>('best');
  const [serverDraft, setServerDraft] = useState(extractorApiUrl);
  const [isEditingServer, setIsEditingServer] = useState(!extractorApiUrl);
  const [isResolving, setIsResolving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolved, setResolved] = useState<MediaResolveResult | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setServerDraft(extractorApiUrl);
    if (!extractorApiUrl) {
      setIsEditingServer(true);
    }
  }, [extractorApiUrl]);

  const runResolve = useCallback(
    async (endpoint: string, targetQuality: MediaQualityPreference) => {
      if (!isValidExtractorEndpoint(endpoint)) {
        setResolved(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsResolving(true);
      setErrorMsg(null);
      try {
        const result = await resolveMediaUrl(
          mediaUrl,
          targetQuality,
          endpoint,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setResolved(result);
          const first = result.formats[0];
          setSelectedFormatId(first?.id ?? '');
          if (first && autoRouteFolders && !hasManualFolderPick) {
            onAutoFolderChange(
              resolveSmartFolder(first.isAudioOnly ? 'audio' : 'video', defaultFolder)
            );
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResolved(null);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Failed to resolve downloadable stream.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsResolving(false);
        }
      }
    },
    [
      autoRouteFolders,
      defaultFolder,
      hasManualFolderPick,
      mediaUrl,
      onAutoFolderChange,
    ]
  );

  useEffect(() => {
    if (extractorApiUrl && isValidExtractorEndpoint(extractorApiUrl)) {
      runResolve(extractorApiUrl, quality);
    } else {
      setResolved(null);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [extractorApiUrl, mediaUrl, quality, runResolve]);

  const selectedFormat: ResolvedMediaFormat | undefined =
    resolved?.formats.find((f) => f.id === selectedFormatId) ??
    resolved?.formats[0];

  const handleSaveServer = () => {
    const trimmed = serverDraft.trim();
    if (!isValidExtractorEndpoint(trimmed)) {
      setErrorMsg('Enter a valid http:// or https:// Extractor Server URL.');
      return;
    }
    triggerHaptic('selection');
    setExtractorApiUrl(trimmed);
    setIsEditingServer(false);
    setErrorMsg(null);
  };

  const handleDownloadSelected = async () => {
    if (!selectedFormat) {
      return;
    }
    setIsDownloading(true);
    setErrorMsg(null);
    try {
      await enqueueNewDownload({
        url: selectedFormat.url,
        fileName: selectedFormat.fileName,
        folder: selectedFolder,
        totalBytes: selectedFormat.sizeBytes,
        mimeType: selectedFormat.mimeType,
        headers: customHeaders,
      });
      triggerHaptic('success');
      onCloseSheet();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not queue resolved stream.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInBrowser = () => {
    triggerHaptic('selection');
    onCloseSheet();
    router.push({ pathname: '/browser', params: { url: mediaUrl } });
  };

  return (
    <View style={styles.root}>
      <View style={styles.platformRow}>
        <View style={styles.platformBadge}>
          <Ionicons name="videocam" size={14} color={colors.accent} />
          <Text style={styles.platformText}>
            {detectPlatformLabel(mediaUrl)} Extractor
          </Text>
        </View>
        {extractorApiUrl ? (
          <Pressable
            onPress={() => setIsEditingServer((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Configure extractor server"
          >
            <Text style={styles.editServerLink}>
              {isEditingServer ? 'Hide Server' : 'Server URL'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.qualityRow}>
        {QUALITY_OPTIONS.map((opt) => {
          const isActive = quality === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                triggerHaptic('selection');
                setQuality(opt.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[styles.qualityChip, isActive && styles.qualityChipActive]}
            >
              <Text
                style={[
                  styles.qualityText,
                  isActive && styles.qualityTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isEditingServer ? (
        <View style={styles.serverCard}>
          <Text style={styles.serverTitle}>Extractor Server Required</Text>
          <Text style={styles.serverHint}>
            Paste your Cobalt or yt-dlp resolver API endpoint to extract direct video/audio streams from YouTube and TikTok links, or browse in-app.
          </Text>
          <View style={styles.serverInputRow}>
            <TextInput
              value={serverDraft}
              onChangeText={setServerDraft}
              placeholder="https://your-extractor-api.com/"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.serverInput}
              accessibilityLabel="Extractor server URL"
            />
            <Pressable
              onPress={handleSaveServer}
              style={styles.saveServerBtn}
              accessibilityRole="button"
              accessibilityLabel="Save extractor server URL"
            >
              <Text style={styles.saveServerText}>Save</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleOpenInBrowser}
            style={styles.browserFallbackBtn}
            accessibilityRole="button"
            accessibilityLabel="Open link in built-in browser"
          >
            <Ionicons name="globe-outline" size={16} color={colors.accent} />
            <Text style={styles.browserFallbackText}>Open in Built-in Browser</Text>
          </Pressable>
        </View>
      ) : null}

      {isResolving ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Resolving video streams...</Text>
        </View>
      ) : null}

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          {extractorApiUrl ? (
            <Pressable
              onPress={() => runResolve(extractorApiUrl, quality)}
              style={styles.retryPill}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {resolved && resolved.formats.length > 0 ? (
        <View style={styles.formatsList}>
          <Text style={styles.resolvedTitle} numberOfLines={2}>
            {resolved.title}
          </Text>
          {resolved.formats.map((fmt) => {
            const isSelected = fmt.id === selectedFormat?.id;
            return (
              <Pressable
                key={fmt.id}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedFormatId(fmt.id);
                }}
                style={[styles.formatRow, isSelected && styles.formatRowActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons
                  name={fmt.isAudioOnly ? 'musical-notes' : 'film-outline'}
                  size={18}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
                <View style={styles.formatInfo}>
                  <Text style={styles.formatLabel}>{fmt.label}</Text>
                  <Text style={styles.formatMeta} numberOfLines={1}>
                    {fmt.fileName}
                    {fmt.sizeBytes > 0 ? ` • ${formatBytes(fmt.sizeBytes)}` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isSelected ? colors.accent : colors.textMuted}
                />
              </Pressable>
            );
          })}
          <OrangeButton
            label={
              selectedFormat
                ? `Download ${selectedFormat.label}`
                : 'Start Download'
            }
            onPress={handleDownloadSelected}
            isLoading={isDownloading}
            isDisabled={!selectedFormat || isResolving}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  platformText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '700',
  },
  editServerLink: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  qualityChip: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  qualityText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  qualityTextActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  serverCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
  },
  serverTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  serverHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  serverInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  serverInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    ...typography.caption,
    color: colors.textPrimary,
  },
  saveServerBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveServerText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  browserFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    marginTop: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
  },
  browserFallbackText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  retryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  retryText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  formatsList: {
    gap: spacing.xs,
  },
  resolvedTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
    backgroundColor: colors.surfaceSubtle,
  },
  formatRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  formatInfo: {
    flex: 1,
    gap: 2,
  },
  formatLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  formatMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
});

