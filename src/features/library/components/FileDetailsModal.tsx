import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { OrangeButton } from '@/components/OrangeButton';
import { formatBytes } from '@/lib/formatBytes';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';

type Props = {
  item: DownloadItemRecord | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
  onShare: (localUri: string) => void;
  onDelete: (id: string) => void;
};

export function FileDetailsModal({
  item,
  onClose,
  onRename,
  onShare,
  onDelete,
}: Props) {
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (item) {
      setNameInput(item.fileName);
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

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Size</Text>
          <Text style={styles.metaValue}>{formatBytes(item.totalBytes)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Folder</Text>
          <Text style={styles.metaValue}>{item.folder}</Text>
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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Source URL</Text>
        <Text style={styles.urlText} numberOfLines={2}>
          {item.url}
        </Text>
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
  urlText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});

