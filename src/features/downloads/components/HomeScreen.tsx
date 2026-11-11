import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { EmptyState } from '@/components/EmptyState';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { SkeletonList } from '@/components/Skeleton';
import { validateDirectUrl } from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { DownloadItemRecord } from '@/types';
import { useDownloads } from '../hooks/useDownloads';
import { DownloadCard } from './DownloadCard';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    items,
    isHydrated,
    errorBanner,
    openAddSheet,
    setErrorBanner,
    handlePause,
    handleResume,
    handleRetry,
    handleDelete,
    handleShareFile,
  } = useDownloads();

  const [quickUrl, setQuickUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const activeItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'downloading' ||
          i.status === 'paused' ||
          i.status === 'queued'
      ),
    [items]
  );

  const recentCompleted = useMemo(
    () => items.filter((i) => i.status === 'completed').slice(0, 5),
    [items]
  );

  const handlePasteClipboard = async () => {
    Haptics.selectionAsync().catch(() => undefined);
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        setInputError('Clipboard is empty. Copy a direct file link first.');
        return;
      }
      setQuickUrl(text.trim());
      setInputError(null);
    } catch {
      setInputError('Unable to read clipboard.');
    }
  };

  const handlePressDownload = () => {
    const check = validateDirectUrl(quickUrl);
    if (!check.isValid) {
      setInputError(check.errorMessage);
      return;
    }
    setInputError(null);
    openAddSheet(check.normalizedUrl);
    setQuickUrl('');
  };

  const handleOpenItem = (item: DownloadItemRecord) => {
    if (item.category === 'video' || item.category === 'audio') {
      router.push(`/player/${item.id}`);
    } else {
      handleShareFile(item.localUri);
    }
  };

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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brandSubtitle}>FAST DIRECT DOWNLOADER</Text>
            <Text style={styles.title}>rapidex</Text>
          </View>
          <Pressable
            onPress={() => openAddSheet()}
            accessibilityRole="button"
            accessibilityLabel="Open add link sheet"
            style={styles.headerAction}
          >
            <Ionicons name="link-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>

        {errorBanner ? (
          <Pressable
            onPress={() => setErrorBanner(null)}
            style={styles.banner}
            accessibilityRole="alert"
          >
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.bannerText}>{errorBanner}</Text>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <GlassCard enableBlur intensity={42} contentStyle={styles.heroCard}>
          <Text style={styles.cardHeading}>Paste Direct File Link</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
            <TextInput
              value={quickUrl}
              onChangeText={(val) => {
                setQuickUrl(val);
                if (inputError) {
                  setInputError(null);
                }
              }}
              placeholder="https://example.com/file.mp4"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.urlInput}
              accessibilityLabel="Paste direct file URL"
            />
            {quickUrl.length > 0 ? (
              <Pressable
                onPress={() => setQuickUrl('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear URL input"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}

          <View style={styles.heroActions}>
            <OrangeButton
              label="Paste"
              variant="secondary"
              onPress={handlePasteClipboard}
              icon={<Ionicons name="clipboard-outline" size={18} color={colors.accent} />}
              style={styles.pasteBtn}
            />
            <OrangeButton
              label="Download"
              onPress={handlePressDownload}
              icon={<Ionicons name="arrow-down-circle-outline" size={18} color={colors.textOnAccent} />}
              style={styles.downloadBtn}
            />
          </View>
        </GlassCard>

        {!isHydrated ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Transfers</Text>
              <Text style={styles.sectionCount}>{activeItems.length}</Text>
            </View>

            {activeItems.length === 0 ? (
              <EmptyState
                icon="cloud-download-outline"
                title="No Active Downloads"
                description="Paste a direct file URL above or tap + to start saving videos, audio, or documents."
              />
            ) : (
              activeItems.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onShare={handleShareFile}
                  onOpenItem={handleOpenItem}
                />
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Files</Text>
              {recentCompleted.length > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/library')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all files in library"
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </Pressable>
              ) : null}
            </View>

            {recentCompleted.length === 0 ? (
              <EmptyState
                icon="folder-open-outline"
                title="No Recent Files Yet"
                description="Completed downloads will appear here for instant offline playback."
              />
            ) : (
              recentCompleted.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onShare={handleShareFile}
                  onOpenItem={handleOpenItem}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandSubtitle: {
    ...typography.small,
    color: colors.accent,
  },
  title: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  headerAction: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  heroCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeading: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  inputWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  urlInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pasteBtn: {
    flex: 1,
  },
  downloadBtn: {
    flex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.accent,
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  seeAllText: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
});
