import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation, WebViewProps } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { useDownloadsStore } from '@/features/downloads/store';
import { triggerHaptic } from '@/lib/haptics';
import { validateDirectUrl } from '@/lib/validateUrl';
import { colors, glassBevelStyle, radius, spacing, typography } from '@/theme';
import { resolveSearchOrUrl, useBrowserStore } from '../store';

type WebViewHandle = {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
};

const NativeWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewHandle> }
>;

type Props = {
  initialUrl: string;
};

export function BrowserScreen({ initialUrl }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webViewRef = useRef<WebViewHandle>(null);

  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const addHistoryEntry = useBrowserStore((s) => s.addHistoryEntry);
  const toggleBookmark = useBrowserStore((s) => s.toggleBookmark);
  const openBrowserSheet = useBrowserStore((s) => s.openBrowserSheet);
  const openAddSheet = useDownloadsStore((s) => s.openAddSheet);

  const resolvedInitial = useMemo(
    () => resolveSearchOrUrl(initialUrl),
    [initialUrl]
  );

  const [currentUrl, setCurrentUrl] = useState(resolvedInitial);
  const [addressInput, setAddressInput] = useState(resolvedInitial);
  const [pageTitle, setPageTitle] = useState(resolvedInitial);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.url === currentUrl),
    [bookmarks, currentUrl]
  );

  const handleSubmitAddress = () => {
    const next = resolveSearchOrUrl(addressInput);
    setCurrentUrl(next);
    setAddressInput(next);
  };

  const handleNavStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setIsLoading(navState.loading);

    if (navState.url) {
      setCurrentUrl(navState.url);
      setAddressInput(navState.url);
      if (navState.title) {
        setPageTitle(navState.title);
      }
      if (!navState.loading) {
        addHistoryEntry(navState.title || navState.url, navState.url);
      }
    }
  };

  const handleSaveDirectFile = () => {
    triggerHaptic('light');
    const check = validateDirectUrl(currentUrl);
    if (check.isValid) {
      openAddSheet(check.normalizedUrl);
    } else {
      openAddSheet();
    }
  };

  return (
    <BackgroundBlobs>
      <View style={[styles.root, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close browser"
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.addressBox}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="lock-closed" size={14} color={colors.accent} />
            )}
            <TextInput
              value={addressInput}
              onChangeText={setAddressInput}
              onSubmitEditing={handleSubmitAddress}
              returnKeyType="go"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="Search Google or enter URL..."
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
              style={styles.addressInput}
              accessibilityLabel="Browser address bar"
            />
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                toggleBookmark(pageTitle, currentUrl);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isBookmarked ? 'Remove bookmark' : 'Bookmark this page'
              }
            >
              <Ionicons
                name={isBookmarked ? 'star' : 'star-outline'}
                size={18}
                color={isBookmarked ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => webViewRef.current?.reload()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reload page"
            style={styles.iconBtn}
          >
            <Ionicons name="refresh" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.webContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.webFallback}>
              <GlassCard contentStyle={styles.webFallbackCard}>
                <Ionicons name="globe-outline" size={40} color={colors.accent} />
                <Text style={styles.webFallbackTitle}>In-App Browser</Text>
                <Text style={styles.webFallbackDesc} numberOfLines={2}>
                  {currentUrl}
                </Text>
                <OrangeButton
                  label="Open in New Tab"
                  onPress={() => {
                    addHistoryEntry(pageTitle, currentUrl);
                    Linking.openURL(currentUrl).catch(() => undefined);
                  }}
                />
              </GlassCard>
            </View>
          ) : (
            <NativeWebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              onNavigationStateChange={handleNavStateChange}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              style={styles.webview}
            />
          )}
        </View>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, spacing.xs) },
          ]}
        >
          <Pressable
            onPress={() => webViewRef.current?.goBack()}
            disabled={!canGoBack}
            style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => webViewRef.current?.goForward()}
            disabled={!canGoForward}
            style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Go forward"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => openBrowserSheet('bookmarks')}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Open bookmarks"
          >
            <Ionicons name="bookmarks-outline" size={20} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => openBrowserSheet('history')}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Open history"
          >
            <Ionicons name="time-outline" size={21} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={handleSaveDirectFile}
            style={styles.downloadPill}
            accessibilityRole="button"
            accessibilityLabel="Add direct download link"
          >
            <Ionicons
              name="cloud-download-outline"
              size={18}
              color={colors.textOnAccent}
            />
            <Text style={styles.downloadPillText}>Save File</Text>
          </Pressable>
        </View>
      </View>
    </BackgroundBlobs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  iconBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    flex: 1,
    minHeight: spacing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
  },
  addressInput: {
    flex: 1,
    ...typography.caption,
    color: colors.textPrimary,
  },
  webContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  webFallbackCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  webFallbackTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  webFallbackDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.glassBackgroundStrong,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  navBtn: {
    width: spacing.touchMin,
    height: spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  downloadPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  downloadPillText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
});
