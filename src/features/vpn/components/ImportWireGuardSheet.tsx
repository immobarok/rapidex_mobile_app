import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { OrangeButton } from '@/components/OrangeButton';
import { triggerHaptic } from '@/lib/haptics';
import { validateAnyHttpUrl } from '@/lib/validateUrl';
import { colors, radius, spacing, typography } from '@/theme';
import { parseWireGuardConfig } from '../services/wireguardConfigParser';

type Props = {
  isVisible: boolean;
  initialApiUrl: string;
  onClose: () => void;
  onImportProfile: (
    rawConf: string,
    customName?: string
  ) => { ok: boolean; errorMessage?: string };
  onSyncApi: (
    apiUrl: string
  ) => Promise<{ ok: boolean; count: number; errorMessage?: string }>;
};

export function ImportWireGuardSheet({
  isVisible,
  initialApiUrl,
  onClose,
  onImportProfile,
  onSyncApi,
}: Props) {
  const [nameInput, setNameInput] = useState('');
  const [configText, setConfigText] = useState('');
  const [apiUrlInput, setApiUrlInput] = useState(initialApiUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setApiUrlInput(initialApiUrl);
  }, [initialApiUrl]);

  const preview = useMemo(() => {
    if (!configText.trim()) return null;
    return parseWireGuardConfig(configText, nameInput);
  }, [configText, nameInput]);

  const handlePickFile = async () => {
    triggerHaptic('selection');
    setErrorText(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      const content =
        Platform.OS === 'web' && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri);

      if (!nameInput.trim() && asset.name) {
        setNameInput(asset.name.replace(/\.conf$/i, ''));
      }
      setConfigText(content);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Unable to read selected .conf file.'
      );
    }
  };

  const handlePasteClipboard = async () => {
    triggerHaptic('selection');
    setErrorText(null);
    const clip = await Clipboard.getStringAsync().catch(() => '');
    if (!clip.trim()) {
      setErrorText('Clipboard is empty.');
      return;
    }
    setConfigText(clip);
  };

  const handleSaveConfig = () => {
    const res = onImportProfile(configText, nameInput);
    if (!res.ok) {
      setErrorText(res.errorMessage ?? 'Invalid WireGuard configuration.');
      return;
    }
    triggerHaptic('success');
    setNameInput('');
    setConfigText('');
    setErrorText(null);
    onClose();
  };

  const handleSyncServerApi = async () => {
    const trimmed = apiUrlInput.trim();
    if (!validateAnyHttpUrl(trimmed).isValid) {
      setErrorText('Enter a valid http:// or https:// VPN server API URL.');
      return;
    }
    triggerHaptic('selection');
    setIsSyncing(true);
    setErrorText(null);
    const res = await onSyncApi(trimmed);
    setIsSyncing(false);
    if (!res.ok) {
      setErrorText(res.errorMessage ?? 'Failed to load servers from API.');
      return;
    }
    triggerHaptic('success');
    onClose();
  };

  return (
    <BottomSheet isVisible={isVisible} title="Add VPN Server" onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quickRow}>
          <Pressable
            onPress={handlePickFile}
            accessibilityRole="button"
            accessibilityLabel="Pick WireGuard .conf file"
            style={styles.quickBtn}
          >
            <Ionicons name="document-outline" size={16} color={colors.accent} />
            <Text style={styles.quickBtnText}>Pick .conf File</Text>
          </Pressable>

          <Pressable
            onPress={handlePasteClipboard}
            accessibilityRole="button"
            accessibilityLabel="Paste WireGuard config from clipboard"
            style={styles.quickBtn}
          >
            <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
            <Text style={styles.quickBtnText}>Paste Config</Text>
          </Pressable>
        </View>

        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="Server label (optional)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="WireGuard profile name"
        />

        <TextInput
          value={configText}
          onChangeText={(val) => {
            setConfigText(val);
            if (errorText) setErrorText(null);
          }}
          placeholder={'[Interface]\nPrivateKey = ...\nAddress = 10.64.0.2/32\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0, ::/0'}
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          style={styles.configInput}
          accessibilityLabel="WireGuard .conf contents"
        />

        <OrangeButton
          label="Save & Connect .conf"
          isDisabled={!preview?.ok}
          onPress={handleSaveConfig}
        />

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.apiRow}>
          <TextInput
            value={apiUrlInput}
            onChangeText={(val) => {
              setApiUrlInput(val);
              if (errorText) setErrorText(null);
            }}
            placeholder="https://your-vpn-api.com/servers"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, styles.apiInput]}
            accessibilityLabel="VPN Server API URL"
          />
          <Pressable
            onPress={handleSyncServerApi}
            disabled={isSyncing}
            accessibilityRole="button"
            accessibilityLabel="Sync VPN API servers"
            style={styles.syncBtn}
          >
            <Text style={styles.syncBtnText}>
              {isSyncing ? 'Loading...' : 'Sync API'}
            </Text>
          </Pressable>
        </View>

        {errorText || (preview && !preview.ok) ? (
          <Text style={styles.errorText}>
            {errorText ?? (!preview?.ok ? preview?.errorMessage : '')}
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 490 },
  content: { gap: spacing.sm, paddingBottom: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSurface,
  },
  quickBtnText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    ...typography.caption,
    color: colors.textPrimary,
  },
  configInput: {
    minHeight: 120,
    maxHeight: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    padding: spacing.md,
    ...typography.small,
    color: colors.textPrimary,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  orText: { ...typography.small, color: colors.textMuted },
  apiRow: { flexDirection: 'row', gap: spacing.xs },
  apiInput: { flex: 1 },
  syncBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  errorText: { ...typography.caption, color: colors.danger },
});
