import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { useDownloads } from '@/features/downloads/hooks/useDownloads';
import { processDownloadQueue } from '@/features/downloads/services/downloadService';
import { isValidExtractorEndpoint } from '@/features/downloads/services/mediaResolverService';
import { formatBytes } from '@/lib/formatBytes';
import { logError } from '@/lib/logger';
import { colors, radius, spacing, typography } from '@/theme';
import { useSettingsStore } from '../store';
import { MaxConcurrentOption, SaveFolderOption } from '../types';

const CONCURRENCY_OPTIONS: MaxConcurrentOption[] = [1, 2, 3, 4];
const FOLDER_OPTIONS: SaveFolderOption[] = [
  'Downloads',
  'Videos',
  'Music',
  'Documents',
];
const PRIVACY_POLICY_URL = 'https://example.com/rapidex-privacy-policy';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { items, handleClearCompleted } = useDownloads();

  const wifiOnly = useSettingsStore((s) => s.wifiOnly);
  const maxConcurrent = useSettingsStore((s) => s.maxConcurrent);
  const defaultFolder = useSettingsStore((s) => s.defaultFolder);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const autoRouteFolders = useSettingsStore((s) => s.autoRouteFolders);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const extractorApiUrl = useSettingsStore((s) => s.extractorApiUrl);
  const setWifiOnly = useSettingsStore((s) => s.setWifiOnly);
  const setMaxConcurrent = useSettingsStore((s) => s.setMaxConcurrent);
  const setDefaultFolder = useSettingsStore((s) => s.setDefaultFolder);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const setAutoRouteFolders = useSettingsStore((s) => s.setAutoRouteFolders);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setExtractorApiUrl = useSettingsStore((s) => s.setExtractorApiUrl);

  const [freeDiskBytes, setFreeDiskBytes] = useState<number>(0);
  const [totalDiskBytes, setTotalDiskBytes] = useState<number>(0);
  const [extractorDraft, setExtractorDraft] = useState(extractorApiUrl);
  const [extractorStatus, setExtractorStatus] = useState<string | null>(null);

  useEffect(() => {
    setExtractorDraft(extractorApiUrl);
  }, [extractorApiUrl]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let mounted = true;
    Promise.all([
      FileSystem.getFreeDiskStorageAsync(),
      FileSystem.getTotalDiskCapacityAsync(),
    ])
      .then(([free, total]) => {
        if (mounted) {
          setFreeDiskBytes(free);
          setTotalDiskBytes(total);
        }
      })
      .catch((err) => logError('settings-disk-info', err));

    return () => {
      mounted = false;
    };
  }, [items.length]);

  const appUsedBytes = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.downloadedBytes || item.totalBytes || 0),
        0
      ),
    [items]
  );

  const completedCount = useMemo(
    () => items.filter((i) => i.status === 'completed').length,
    [items]
  );

  const storageFillRatio = useMemo(() => {
    if (totalDiskBytes <= 0) {
      return Math.min(1, appUsedBytes / (1024 * 1024 * 500));
    }
    return Math.min(1, Math.max(0.02, appUsedBytes / totalDiskBytes));
  }, [appUsedBytes, totalDiskBytes]);

  const handleToggleNotifications = async (nextVal: boolean) => {
    if (!nextVal) {
      setNotificationsEnabled(false);
      return;
    }
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (err) {
      logError('toggleNotifications', err);
      setNotificationsEnabled(false);
    }
  };

  const handleChangeConcurrency = (option: MaxConcurrentOption) => {
    setMaxConcurrent(option);
    processDownloadQueue().catch(() => undefined);
  };

  const handleSaveExtractorUrl = () => {
    const trimmed = extractorDraft.trim();
    if (!trimmed) {
      setExtractorApiUrl('');
      setExtractorStatus('Cleared extractor URL.');
      return;
    }
    if (!isValidExtractorEndpoint(trimmed)) {
      setExtractorStatus('Enter a valid http:// or https:// endpoint URL.');
      return;
    }
    setExtractorApiUrl(trimmed);
    setExtractorStatus('Saved extractor server URL.');
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <BackgroundBlobs>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.tabBarHeight + spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        <GlassCard enableBlur contentStyle={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Download Preferences</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Wi-Fi Only Downloads</Text>
              <Text style={styles.settingHint}>
                Pause transfers automatically when on cellular data
              </Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={(val) => {
                setWifiOnly(val);
                processDownloadQueue().catch(() => undefined);
              }}
              trackColor={{ false: colors.borderSubtle, true: colors.accent }}
              accessibilityLabel="Wi-Fi only downloads"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Smart Folder Routing</Text>
              <Text style={styles.settingHint}>
                Auto-sort videos, music, and documents into matching folders
              </Text>
            </View>
            <Switch
              value={autoRouteFolders}
              onValueChange={setAutoRouteFolders}
              trackColor={{ false: colors.borderSubtle, true: colors.accent }}
              accessibilityLabel="Smart folder routing"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Text style={styles.settingHint}>
                Subtle tactile feedback on buttons and gestures
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: colors.borderSubtle, true: colors.accent }}
              accessibilityLabel="Haptic feedback"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.blockSetting}>
            <Text style={styles.settingLabel}>Max Concurrent Downloads</Text>
            <View style={styles.chipsRow}>
              {CONCURRENCY_OPTIONS.map((opt) => {
                const isSelected = maxConcurrent === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => handleChangeConcurrency(opt)}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt} concurrent downloads`}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.optionChip, isSelected && styles.optionChipActive]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isSelected && styles.optionChipTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.blockSetting}>
            <Text style={styles.settingLabel}>Default Save Folder</Text>
            <View style={styles.chipsRow}>
              {FOLDER_OPTIONS.map((folder) => {
                const isSelected = defaultFolder === folder;
                return (
                  <Pressable
                    key={folder}
                    onPress={() => setDefaultFolder(folder)}
                    accessibilityRole="button"
                    accessibilityLabel={`Default folder ${folder}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.folderChip, isSelected && styles.optionChipActive]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isSelected && styles.optionChipTextActive,
                      ]}
                    >
                      {folder}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </GlassCard>

        <GlassCard contentStyle={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Media Extractor Server</Text>
          <Text style={styles.settingHint}>
            Connect a self-hosted Cobalt or yt-dlp JSON endpoint to extract downloadable streams from shared YouTube and TikTok links.
          </Text>
          <View style={styles.extractorRow}>
            <TextInput
              value={extractorDraft}
              onChangeText={(val) => {
                setExtractorDraft(val);
                if (extractorStatus) {
                  setExtractorStatus(null);
                }
              }}
              placeholder="https://your-extractor-api.com/"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.extractorInput}
              accessibilityLabel="Media extractor server URL"
            />
            <Pressable
              onPress={handleSaveExtractorUrl}
              accessibilityRole="button"
              accessibilityLabel="Save extractor server URL"
              style={styles.extractorSaveBtn}
            >
              <Text style={styles.extractorSaveText}>Save</Text>
            </Pressable>
          </View>
          {extractorStatus ? (
            <Text style={styles.extractorStatusText}>{extractorStatus}</Text>
          ) : null}
        </GlassCard>

        <GlassCard contentStyle={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Storage Usage</Text>

          <View style={styles.storageNumbersRow}>
            <Text style={styles.storageUsedText}>
              Rapidex Files: {formatBytes(appUsedBytes)}
            </Text>
            <Text style={styles.storageFreeText}>
              {freeDiskBytes > 0 ? `${formatBytes(freeDiskBytes)} free` : 'Local storage'}
            </Text>
          </View>

          <View style={styles.storageBarTrack}>
            <View
              style={[
                styles.storageBarFill,
                { width: `${Math.round(storageFillRatio * 100)}%` },
              ]}
            />
          </View>

          <OrangeButton
            label={`Clear Completed (${completedCount})`}
            variant="secondary"
            isDisabled={completedCount === 0}
            onPress={handleClearCompleted}
          />
        </GlassCard>

        <GlassCard contentStyle={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Notifications & About</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingLabel}>Completion Notifications</Text>
              <Text style={styles.settingHint}>
                Local alert when background downloads finish
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.borderSubtle, true: colors.accent }}
              accessibilityLabel="Completion notifications"
            />
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined)}
            accessibilityRole="link"
            accessibilityLabel="Open Privacy Policy"
            style={styles.linkRow}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.aboutBox}>
            <Text style={styles.settingLabel}>About rapidex</Text>
            <Text style={styles.settingHint}>
              A lightweight, fast direct-link download manager and offline media player. No tracking, no ads, and 100% local privacy.
            </Text>
            <Text style={styles.versionText}>Version {appVersion}</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  sectionCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  settingTextCol: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  settingHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  blockSetting: {
    gap: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionChip: {
    minWidth: 52,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  folderChip: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  optionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionChipText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  optionChipTextActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  storageNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageUsedText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  storageFreeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  storageBarTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  linkRow: {
    minHeight: spacing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aboutBox: {
    gap: spacing.xs,
  },
  versionText: {
    ...typography.small,
    color: colors.accent,
    marginTop: spacing.xxs,
  },
  extractorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  extractorInput: {
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
  extractorSaveBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractorSaveText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  extractorStatusText: {
    ...typography.small,
    color: colors.accent,
  },
});

