import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { OrangeButton } from '@/components/OrangeButton';
import { useDownloadsStore } from '@/features/downloads/store';
import { triggerHaptic } from '@/lib/haptics';
import { navigateBackOrHome } from '@/lib/navigation';
import { validateAnyHttpUrl } from '@/lib/validateUrl';
import { colors, glassBevelStyle, radius, spacing, typography } from '@/theme';
import { resolveSearchOrUrl, useBrowserStore } from '../store';
import { MEDIA_SNIFFER_SCRIPT, parseSniffedMediaMessage } from '../utils/browserSniffer';
import {
  extractIntentFallbackUrl,
  getWebEmbedUrl,
  isInAppWebScheme,
} from '../utils/browserUrl';

type WebViewHandle = {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
};

const NativeWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewHandle> }
>;

const WEBVIEW_ALLOW_ALL_ORIGINS = ['*'];
const IOS_SAFARI_UA_SUFFIX = 'Version/18.0 Safari/604.1';

function getRouteIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function getStreamSummary(streamUrl: string, index: number): string {
  try {
    const parsed = new URL(streamUrl);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    const label = segment ? decodeURIComponent(segment) : parsed.hostname;
    return `Stream ${index + 1} · ${label}`;
  } catch {
    return `Stream ${index + 1}`;
  }
}

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

  const [webSourceUrl, setWebSourceUrl] = useState(resolvedInitial);
  const [currentUrl, setCurrentUrl] = useState(resolvedInitial);
  const [addressInput, setAddressInput] = useState(resolvedInitial);
  const [pageTitle, setPageTitle] = useState(resolvedInitial);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [detectedMediaUrls, setDetectedMediaUrls] = useState<string[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const lastRouteIdentityRef = useRef(getRouteIdentity(resolvedInitial));

  const resetSniffedMediaIfNavigated = useCallback((nextUrl: string) => {
    const nextIdentity = getRouteIdentity(nextUrl);
    if (nextIdentity !== lastRouteIdentityRef.current) {
      lastRouteIdentityRef.current = nextIdentity;
      setDetectedMediaUrls([]);
      setIsMediaPickerOpen(false);
    }
  }, []);

  useEffect(() => {
    setWebSourceUrl(resolvedInitial);
    setCurrentUrl(resolvedInitial);
    setAddressInput(resolvedInitial);
    setPageTitle(resolvedInitial);
    lastRouteIdentityRef.current = getRouteIdentity(resolvedInitial);
    setDetectedMediaUrls([]);
    setIsMediaPickerOpen(false);
  }, [resolvedInitial]);

  const webEmbedUrl = useMemo(
    () => (Platform.OS === 'web' ? getWebEmbedUrl(currentUrl) : null),
    [currentUrl]
  );

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.url === currentUrl),
    [bookmarks, currentUrl]
  );

  const navigateInApp = useCallback(
    (nextUrl: string) => {
      resetSniffedMediaIfNavigated(nextUrl);
      if (nextUrl === webSourceUrl) {
        webViewRef.current?.reload();
      } else {
        setWebSourceUrl(nextUrl);
      }
      setCurrentUrl(nextUrl);
      setAddressInput(nextUrl);
    },
    [resetSniffedMediaIfNavigated, webSourceUrl]
  );

  const handleSubmitAddress = () => {
    const next = resolveSearchOrUrl(addressInput);
    setIsEditingAddress(false);
    navigateInApp(next);
  };

  const handleNavStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setIsLoading(navState.loading);

    if (navState.url) {
      resetSniffedMediaIfNavigated(navState.url);
      setCurrentUrl(navState.url);
      if (!isEditingAddress) {
        setAddressInput(navState.url);
      }
      if (navState.title) {
        setPageTitle(navState.title);
      }
      if (!navState.loading) {
        addHistoryEntry(navState.title || navState.url, navState.url);
      }
    }
  };

  const handleShouldStartLoad: NonNullable<
    WebViewProps['onShouldStartLoadWithRequest']
  > = (request) => {
    const url = request.url?.trim();
    if (!url) {
      return false;
    }

    if (isInAppWebScheme(url)) {
      return true;
    }

    // Keep social/video sites inside the app instead of jumping to external apps or stores.
    if (request.isTopFrame !== false) {
      const fallbackUrl = extractIntentFallbackUrl(url);
      if (fallbackUrl) {
        navigateInApp(fallbackUrl);
      }
    }

    return false;
  };

  const handleOpenWindow: NonNullable<WebViewProps['onOpenWindow']> = (event) => {
    const targetUrl = event.nativeEvent?.targetUrl;
    if (targetUrl && isInAppWebScheme(targetUrl)) {
      navigateInApp(targetUrl);
    }
  };

  const openUrlInAddSheet = useCallback(
    (candidateUrl: string) => {
      const check = validateAnyHttpUrl(candidateUrl);
      if (check.isValid) {
        openAddSheet(check.normalizedUrl);
      } else {
        openAddSheet();
      }
    },
    [openAddSheet]
  );

  const handleWebViewMessage: NonNullable<WebViewProps['onMessage']> = (event) => {
    const rawData = event.nativeEvent?.data;
    if (!rawData) {
      return;
    }
    const incoming = parseSniffedMediaMessage(rawData);
    if (incoming.length === 0) {
      return;
    }
    setDetectedMediaUrls((prev) => {
      const merged = new Set(prev);
      let added = false;
      for (const url of incoming) {
        if (!merged.has(url)) {
          merged.add(url);
          added = true;
        }
      }
      return added ? Array.from(merged) : prev;
    });
  };

  const handleSaveDirectFile = () => {
    triggerHaptic('light');
    if (detectedMediaUrls.length === 1) {
      openUrlInAddSheet(detectedMediaUrls[0]);
      return;
    }
    if (detectedMediaUrls.length > 1) {
      setIsMediaPickerOpen(true);
      return;
    }
    openUrlInAddSheet(currentUrl);
  };

  return (
    <BackgroundBlobs>
      <View style={[styles.root, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigateBackOrHome(router)}
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
              onFocus={() => setIsEditingAddress(true)}
              onBlur={() => setIsEditingAddress(false)}
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

        {isLoading && loadProgress > 0 && loadProgress < 1 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(loadProgress * 100)}%` },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.webContainer}>
          {Platform.OS === 'web' ? (
            webEmbedUrl ? (
              <View style={styles.webEmbedWrap}>
                {React.createElement('iframe', {
                  src: webEmbedUrl,
                  title: pageTitle || 'Embedded Player',
                  allow:
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
                  allowFullScreen: true,
                  style: {
                    width: '100%',
                    height: '100%',
                    border: 0,
                  },
                })}
              </View>
            ) : (
              <View style={styles.webFallback}>
                <GlassCard contentStyle={styles.webFallbackCard}>
                  <Ionicons name="globe-outline" size={40} color={colors.accent} />
                  <Text style={styles.webFallbackTitle}>In-App Browser</Text>
                  <Text style={styles.webFallbackDesc} numberOfLines={2}>
                    {currentUrl}
                  </Text>
                  <Text style={styles.webFallbackNote}>
                    YouTube and TikTok open directly inside the iOS and Android app. Web browsers block full-site embedding via X-Frame-Options, so web preview opens them in a browser tab.
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
            )
          ) : (
            <NativeWebView
              ref={webViewRef}
              source={{ uri: webSourceUrl }}
              originWhitelist={WEBVIEW_ALLOW_ALL_ORIGINS}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onOpenWindow={handleOpenWindow}
              onNavigationStateChange={handleNavStateChange}
              onLoadProgress={(event) =>
                setLoadProgress(event.nativeEvent.progress)
              }
              injectedJavaScript={MEDIA_SNIFFER_SCRIPT}
              onMessage={handleWebViewMessage}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              allowsPictureInPictureMediaPlayback
              allowsAirPlayForMediaPlayback
              allowsBackForwardNavigationGestures
              mediaPlaybackRequiresUserAction={false}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              pullToRefreshEnabled
              mixedContentMode="compatibility"
              applicationNameForUserAgent={
                Platform.OS === 'ios' ? IOS_SAFARI_UA_SUFFIX : undefined
              }
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingFallback}>
                  <ActivityIndicator size="large" color={colors.accent} />
                </View>
              )}
              renderError={(_, __, errorDesc) => (
                <View style={styles.webFallback}>
                  <GlassCard contentStyle={styles.webFallbackCard}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={40}
                      color={colors.accent}
                    />
                    <Text style={styles.webFallbackTitle}>
                      Couldn&apos;t load page
                    </Text>
                    <Text style={styles.webFallbackDesc} numberOfLines={3}>
                      {errorDesc || currentUrl}
                    </Text>
                    <OrangeButton
                      label="Retry"
                      onPress={() => webViewRef.current?.reload()}
                    />
                  </GlassCard>
                </View>
              )}
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
            accessibilityLabel={
              detectedMediaUrls.length > 0
                ? `Save ${detectedMediaUrls.length} detected media streams`
                : 'Add download link'
            }
          >
            <Ionicons
              name="cloud-download-outline"
              size={18}
              color={colors.textOnAccent}
            />
            <Text style={styles.downloadPillText}>
              {detectedMediaUrls.length > 0
                ? `Save (${detectedMediaUrls.length})`
                : 'Save File'}
            </Text>
          </Pressable>
        </View>
      </View>

      <BottomSheet
        isVisible={isMediaPickerOpen}
        title="Detected Media Streams"
        onClose={() => setIsMediaPickerOpen(false)}
      >
        <ScrollView
          style={styles.streamList}
          contentContainerStyle={styles.streamListContent}
          showsVerticalScrollIndicator={false}
        >
          {detectedMediaUrls.map((streamUrl, index) => (
            <Pressable
              key={streamUrl}
              onPress={() => {
                triggerHaptic('selection');
                setIsMediaPickerOpen(false);
                openUrlInAddSheet(streamUrl);
              }}
              style={styles.streamRow}
              accessibilityRole="button"
              accessibilityLabel={`Download ${getStreamSummary(streamUrl, index)}`}
            >
              <View style={styles.streamRowTextWrap}>
                <Text style={styles.streamTitle} numberOfLines={1}>
                  {getStreamSummary(streamUrl, index)}
                </Text>
                <Text style={styles.streamUrl} numberOfLines={1}>
                  {streamUrl}
                </Text>
              </View>
              <Ionicons name="download-outline" size={20} color={colors.accent} />
            </Pressable>
          ))}

          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setIsMediaPickerOpen(false);
              openUrlInAddSheet(currentUrl);
            }}
            style={styles.streamFallbackRow}
            accessibilityRole="button"
            accessibilityLabel="Extract Page URL"
          >
            <View style={styles.streamRowTextWrap}>
              <Text style={styles.streamTitle}>Extract Page URL</Text>
              <Text style={styles.streamUrl} numberOfLines={1}>
                {currentUrl}
              </Text>
            </View>
            <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          </Pressable>
        </ScrollView>
      </BottomSheet>
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
  progressTrack: {
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  webEmbedWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  webFallbackNote: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
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
  streamList: {
    maxHeight: 360,
  },
  streamListContent: {
    gap: spacing.xs,
  },
  streamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glassBackgroundStrong,
    ...glassBevelStyle,
  },
  streamFallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBackground,
  },
  streamRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  streamTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  streamUrl: {
    ...typography.micro,
    color: colors.textSecondary,
  },
});
