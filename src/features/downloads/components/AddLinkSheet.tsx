import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import {
  probeDirectUrl,
  UrlProbeMetadata,
  validateDirectUrl,
} from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { useDownloadsStore } from '../store';
import { enqueueNewDownload } from '../services/downloadService';

const FOLDERS: SaveFolderOption[] = ['Downloads', 'Videos', 'Music', 'Documents'];

export function AddLinkSheet() {
  const isVisible = useDownloadsStore((s) => s.isAddSheetOpen);
  const prefilledUrl = useDownloadsStore((s) => s.prefilledUrl);
  const closeAddSheet = useDownloadsStore((s) => s.closeAddSheet);
  const defaultFolder = useSettingsStore((s) => s.defaultFolder);

  const [urlInput, setUrlInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<SaveFolderOption>(defaultFolder);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [probeMeta, setProbeMeta] = useState<UrlProbeMetadata | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setUrlInput(prefilledUrl);
      setSelectedFolder(defaultFolder);
      setValidationError(null);
      setProbeMeta(null);
    }
  }, [defaultFolder, isVisible, prefilledUrl]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setValidationError(null);
      setProbeMeta(null);
      setFileName('');
      return;
    }

    const validation = validateDirectUrl(trimmed);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage);
      setProbeMeta(null);
      return;
    }

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
  }, [isVisible, urlInput]);

  const handleStart = async () => {
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
      });
      closeAddSheet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start download.';
      setValidationError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <BottomSheet isVisible={isVisible} title="Add Direct Link" onClose={closeAddSheet}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Direct File URL</Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://example.com/media/sample.mp4"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          accessibilityLabel="Direct file URL"
        />
        {validationError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        ) : null}
      </View>

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
              <Text style={styles.sizeValue}>
                {probeMeta && probeMeta.sizeBytes > 0
                  ? formatBytes(probeMeta.sizeBytes)
                  : 'Unknown'}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Save Folder</Text>
        <View style={styles.folderChips}>
          {FOLDERS.map((folder) => {
            const isSelected = selectedFolder === folder;
            return (
              <Pressable
                key={folder}
                onPress={() => setSelectedFolder(folder)}
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

      <View style={styles.legalNoticeBox}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.legalNoticeText}>
          Only download content you have the right to save.
        </Text>
      </View>

      <OrangeButton
        label="Start Download"
        onPress={handleStart}
        isLoading={isStarting}
        isDisabled={!urlInput.trim() || Boolean(validationError)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
