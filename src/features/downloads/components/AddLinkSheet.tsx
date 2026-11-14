import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { OrangeButton } from '@/components/OrangeButton';
import { useSettingsStore } from '@/features/settings/store';
import { SaveFolderOption } from '@/features/settings/types';
import { formatBytes } from '@/lib/formatBytes';
import { triggerHaptic } from '@/lib/haptics';
import {
  probeDirectUrl,
  UrlProbeMetadata,
  validateAnyHttpUrl,
  validateDirectUrl,
} from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { useDownloadsStore } from '../store';
import {
  enqueueNewDownload,
  resolveSmartFolder,
} from '../services/downloadService';
import { MediaExtractorSection } from './MediaExtractorSection';

const FOLDERS: SaveFolderOption[] = ['Downloads', 'Videos', 'Music', 'Documents'];

type SheetMode = 'single' | 'batch';

export function AddLinkSheet() {
  const isVisible = useDownloadsStore((s) => s.isAddSheetOpen);
  const prefilledUrl = useDownloadsStore((s) => s.prefilledUrl);
  const closeAddSheet = useDownloadsStore((s) => s.closeAddSheet);
  const defaultFolder = useSettingsStore((s) => s.defaultFolder);
  const autoRouteFolders = useSettingsStore((s) => s.autoRouteFolders);

  const [mode, setMode] = useState<SheetMode>('single');
  const [urlInput, setUrlInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFolder, setSelectedFolder] =
    useState<SaveFolderOption>(defaultFolder);
  const [hasManualFolderPick, setHasManualFolderPick] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headerAuth, setHeaderAuth] = useState('');
  const [headerReferer, setHeaderReferer] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [probeMeta, setProbeMeta] = useState<UrlProbeMetadata | null>(null);
  const [mediaPageUrl, setMediaPageUrl] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setMode('single');
      setUrlInput(prefilledUrl);
      setBatchInput('');
      setSelectedFolder(defaultFolder);
      setHasManualFolderPick(false);
      setShowAdvanced(false);
      setHeaderAuth('');
      setHeaderReferer('');
      setValidationError(null);
      setProbeMeta(null);
      setMediaPageUrl(null);
    }
  }, [defaultFolder, isVisible, prefilledUrl]);

  useEffect(() => {
    if (!isVisible || mode !== 'single') {
      return;
    }
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setValidationError(null);
      setProbeMeta(null);
      setMediaPageUrl(null);
      setFileName('');
      return;
    }

    const validation = validateAnyHttpUrl(trimmed);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage);
      setProbeMeta(null);
      setMediaPageUrl(null);
      return;
    }

    if (validation.isMediaPage) {
      setValidationError(null);
      setProbeMeta(null);
      setMediaPageUrl(validation.normalizedUrl);
      setFileName('');
      if (autoRouteFolders && !hasManualFolderPick) {
        setSelectedFolder('Videos');
      }
      return;
    }

    setMediaPageUrl(null);
    setValidationError(null);
    setFileName(validation.suggestedFileName);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsProbing(true);
      const metadata = await probeDirectUrl(
        validation.normalizedUrl,
        validation.suggestedFileName,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setProbeMeta(metadata);
        setFileName(metadata.fileName);
        if (autoRouteFolders && !hasManualFolderPick) {
          setSelectedFolder(resolveSmartFolder(metadata.category, defaultFolder));
        }
        if (!metadata.isDirectFile && metadata.warningMessage) {
          setValidationError(metadata.warningMessage);
        }
        setIsProbing(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setIsProbing(false);
    };
  }, [
    autoRouteFolders,
    defaultFolder,
    hasManualFolderPick,
    isVisible,
    mode,
    urlInput,
  ]);

  const parsedBatchLinks = useMemo(() => {
    if (mode !== 'batch') {
      return [];
    }
    return batchInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => validateDirectUrl(line));
  }, [batchInput, mode]);

  const validBatchLinks = useMemo(
    () =>
      parsedBatchLinks.filter(
        (res): res is Extract<typeof res, { isValid: true }> => res.isValid
      ),
    [parsedBatchLinks]
  );

  const buildCustomHeaders = (): Record<string, string> | undefined => {
    const headers: Record<string, string> = {};
    if (headerAuth.trim()) {
      headers.Authorization = headerAuth.trim();
    }
    if (headerReferer.trim()) {
      headers.Referer = headerReferer.trim();
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  const handleStartSingle = async () => {
    const validation = validateDirectUrl(urlInput);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage);
      return;
    }
    if (probeMeta && !probeMeta.isDirectFile) {
      setValidationError(
        probeMeta.warningMessage ??
          'This URL does not point to a direct downloadable file.'
      );
      return;
    }

    setIsStarting(true);
    try {
      await enqueueNewDownload({
        url: validation.normalizedUrl,
        fileName: fileName.trim() || validation.suggestedFileName,
        folder: selectedFolder,
        totalBytes: probeMeta?.sizeBytes ?? 0,
        mimeType: probeMeta?.mimeType ?? 'application/octet-stream',
        headers: buildCustomHeaders(),
      });
      triggerHaptic('success');
      closeAddSheet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start download.';
      setValidationError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartBatch = async () => {
    if (validBatchLinks.length === 0) {
      return;
    }
    setIsStarting(true);
    try {
      const headers = buildCustomHeaders();
      for (const link of validBatchLinks) {
        await enqueueNewDownload({
          url: link.normalizedUrl,
          fileName: link.suggestedFileName,
          folder: selectedFolder,
          totalBytes: 0,
          mimeType: 'application/octet-stream',
          headers,
        });
      }
      triggerHaptic('success');
      closeAddSheet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not queue batch.';
      setValidationError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <BottomSheet
      isVisible={isVisible}
      title={mediaPageUrl ? 'Save Video Link' : 'Add Link'}
      onClose={closeAddSheet}
    >
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeSwitch}>
          {(['single', 'batch'] as SheetMode[]).map((item) => {
            const isActive = mode === item;
            return (
              <Pressable
                key={item}
                onPress={() => {
                  triggerHaptic('selection');
                  setMode(item);
                  setValidationError(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={[styles.modePill, isActive && styles.modePillActive]}
              >
                <Text
                  style={[styles.modeText, isActive && styles.modeTextActive]}
                >
                  {item === 'single' ? 'Single Link' : 'Batch Import'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'single' ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Video or Direct File URL</Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="YouTube, TikTok, or direct .mp4/.pdf URL"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
                accessibilityLabel="Video or direct file URL"
              />
              {validationError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{validationError}</Text>
                </View>
              ) : null}
            </View>

            {mediaPageUrl ? (
              <MediaExtractorSection
                mediaUrl={mediaPageUrl}
                selectedFolder={selectedFolder}
                hasManualFolderPick={hasManualFolderPick}
                onAutoFolderChange={setSelectedFolder}
                customHeaders={buildCustomHeaders()}
                onCloseSheet={closeAddSheet}
              />
            ) : (
              <>
                <View style={styles.previewRow}>
                  <View style={styles.nameColumn}>
                    <Text style={styles.label}>File Name</Text>
                    <TextInput
                      value={fileName}
                      onChangeText={setFileName}
                      placeholder="filename.mp4"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      accessibilityLabel="File name"
                    />
                  </View>
                  <View style={styles.sizeBadge}>
                    <Text style={styles.label}>Size</Text>
                    <View style={styles.sizeBox}>
                      {isProbing ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.sizeValue} numberOfLines={1}>
                          {probeMeta && probeMeta.sizeBytes > 0
                            ? formatBytes(probeMeta.sizeBytes)
                            : 'Unknown'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {probeMeta ? (
                  <View style={styles.probeBadgeRow}>
                    <View style={styles.probePill}>
                      <Ionicons
                        name={
                          probeMeta.supportsRange
                            ? 'checkmark-circle'
                            : 'information-circle-outline'
                        }
                        size={14}
                        color={
                          probeMeta.supportsRange
                            ? colors.success
                            : colors.textSecondary
                        }
                      />
                      <Text style={styles.probePillText}>
                        {probeMeta.supportsRange
                          ? 'Resumable Transfer'
                          : 'Standard Transfer'}
                      </Text>
                    </View>
                    <View style={styles.probePill}>
                      <Text style={styles.probePillText}>
                        {probeMeta.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : (
          <View style={styles.fieldGroup}>
            <View style={styles.batchHeaderRow}>
              <Text style={styles.label}>Paste Multiple Direct URLs (one per line)</Text>
              <Text style={styles.batchCount}>
                {validBatchLinks.length} valid
              </Text>
            </View>
            <TextInput
              value={batchInput}
              onChangeText={setBatchInput}
              placeholder={
                'https://example.com/clip-1.mp4\nhttps://example.com/audio-2.mp3'
              }
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
              style={styles.batchTextArea}
              accessibilityLabel="Batch direct file URLs"
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Save Folder</Text>
          <View style={styles.folderChips}>
            {FOLDERS.map((folder) => {
              const isSelected = selectedFolder === folder;
              return (
                <Pressable
                  key={folder}
                  onPress={() => {
                    triggerHaptic('selection');
                    setHasManualFolderPick(true);
                    setSelectedFolder(folder);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Save to ${folder}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.folderChip, isSelected && styles.folderChipActive]}
                >
                  <Text
                    style={[
                      styles.folderChipText,
                      isSelected && styles.folderChipTextActive,
                    ]}
                  >
                    {folder}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setShowAdvanced((prev) => !prev)}
          style={styles.advancedToggle}
          accessibilityRole="button"
          accessibilityLabel="Toggle advanced HTTP headers"
        >
          <Text style={styles.advancedToggleText}>
            Advanced Headers (Optional)
          </Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {showAdvanced ? (
          <View style={styles.advancedBox}>
            <TextInput
              value={headerAuth}
              onChangeText={setHeaderAuth}
              placeholder="Authorization: Bearer ..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Authorization header"
            />
            <TextInput
              value={headerReferer}
              onChangeText={setHeaderReferer}
              placeholder="Referer: https://..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Referer header"
            />
          </View>
        ) : null}

        <View style={styles.legalNoticeBox}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.legalNoticeText}>
            Only download content you have the right to save.
          </Text>
        </View>

        {mode === 'single' ? (
          mediaPageUrl ? null : (
            <OrangeButton
              label="Start Download"
              onPress={handleStartSingle}
              isLoading={isStarting}
              isDisabled={!urlInput.trim() || Boolean(validationError)}
            />
          )
        ) : (
          <OrangeButton
            label={
              validBatchLinks.length > 0
                ? `Queue ${validBatchLinks.length} Files`
                : 'Queue Files'
            }
            onPress={handleStartBatch}
            isLoading={isStarting}
            isDisabled={validBatchLinks.length === 0}
          />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    maxHeight: 500,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  modeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modePill: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: colors.background,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    minHeight: spacing.touchMin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  batchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchCount: {
    ...typography.small,
    color: colors.accent,
  },
  batchTextArea: {
    minHeight: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  sizeBadge: {
    width: 100,
    gap: spacing.xs,
  },
  sizeBox: {
    minHeight: spacing.touchMin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  sizeValue: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  probeBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  probePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  probePillText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  folderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  folderChip: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  folderChipText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  folderChipTextActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
  },
  advancedToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  advancedBox: {
    gap: spacing.xs,
  },
  legalNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  legalNoticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});
