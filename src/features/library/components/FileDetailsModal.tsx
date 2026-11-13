import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { OrangeButton } from '@/components/OrangeButton';
import { SaveFolderOption } from '@/features/settings/types';
import { formatBytes } from '@/lib/formatBytes';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';

const FOLDERS: SaveFolderOption[] = ['Downloads', 'Videos', 'Music', 'Documents'];

type Props = {
  item: DownloadItemRecord | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
  onMoveFolder: (id: string, newFolder: SaveFolderOption) => void;
  onCopyUrl: (url: string) => void;
  onShare: (localUri: string) => void;
  onDelete: (id: string) => void;
};

export function FileDetailsModal({
  item,
  onClose,
  onRename,
  onMoveFolder,
  onCopyUrl,
  onShare,
  onDelete,
}: Props) {
  const [nameInput, setNameInput] = useState('');
  const [selectedFolder, setSelectedFolder] =
    useState<SaveFolderOption>('Downloads');

  useEffect(() => {
    if (item) {
      setNameInput(item.fileName);
      const validFolder = FOLDERS.includes(item.folder as SaveFolderOption)
        ? (item.folder as SaveFolderOption)
        : 'Downloads';
      setSelectedFolder(validFolder);
    }
  }, [item]);

  if (!item) {
    return null;
  }

  const handleSaveRename = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== item.fileName) {
      onRename(item.id, trimmed);
    }
    onClose();
  };

  const completedDate = new Date(
    item.completedAt ?? item.createdAt
  ).toLocaleDateString();

  return (
    <BottomSheet isVisible={Boolean(item)} title="File Details" onClose={onClose}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Rename File</Text>
        <View style={styles.renameRow}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            style={styles.input}
            accessibilityLabel="Rename file input"
          />
          <OrangeButton
            label="Save"
            variant="secondary"
            onPress={handleSaveRename}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Move to Folder</Text>
        <View style={styles.folderChips}>
          {FOLDERS.map((folder) => {
            const isSelected = selectedFolder === folder;
            return (
              <Pressable
                key={folder}
                onPress={() => {
                  setSelectedFolder(folder);
                  onMoveFolder(item.id, folder);
                }}
                accessibilityRole="button"
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

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Size</Text>
          <Text style={styles.metaValue}>{formatBytes(item.totalBytes)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Folder</Text>
          <Text style={styles.metaValue}>{selectedFolder}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaValue}>{item.mimeType}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Saved On</Text>
          <Text style={styles.metaValue}>{completedDate}</Text>
        </View>
      </View>

      <View style={styles.urlRow}>
        <View style={styles.urlCol}>
          <Text style={styles.label}>Source URL</Text>
          <Text style={styles.urlText} numberOfLines={2}>
            {item.url}
          </Text>
        </View>
        <Pressable
          onPress={() => onCopyUrl(item.url)}
          style={styles.copyBtn}
          accessibilityRole="button"
          accessibilityLabel="Copy source URL"
        >
          <Ionicons name="copy-outline" size={18} color={colors.accent} />
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <OrangeButton
          label="Share File"
          onPress={() => {
            onShare(item.localUri);
            onClose();
          }}
          style={styles.actionBtn}
        />
        <OrangeButton
          label="Delete"
          variant="danger"
          onPress={() => {
            onDelete(item.id);
            onClose();
          }}
          style={styles.actionBtn}
        />
      </View>
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
  renameRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: spacing.touchMin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  folderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  folderChip: {
    minHeight: 36,
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
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  metaItem: {
    width: '46%',
    gap: 2,
  },
  metaLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  metaValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  urlCol: {
    flex: 1,
    gap: 2,
  },
  urlText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  copyBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
