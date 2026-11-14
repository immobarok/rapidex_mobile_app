import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { triggerHaptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme';
import { VpnDnsPreset } from '../types';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  dnsPreset: VpnDnsPreset;
  isIpv4Only: boolean;
  isAutoConnectEnabled: boolean;
  excludedApps: string[];
  onChangeDns: (preset: VpnDnsPreset) => void;
  onToggleIpv4Only: (enabled: boolean) => void;
  onToggleAutoConnect: (enabled: boolean) => void;
  onAddExcludedApp: (pkg: string) => void;
  onRemoveExcludedApp: (pkg: string) => void;
  onOpenAddServer: () => void;
};

const DNS_OPTIONS: { id: VpnDnsPreset; label: string }[] = [
  { id: 'default', label: 'Config' },
  { id: 'cloudflare', label: '1.1.1.1' },
  { id: 'quad9', label: '9.9.9.9' },
  { id: 'adguard', label: 'AdGuard' },
];

export function VpnOptionsSheet({
  isVisible,
  onClose,
  dnsPreset,
  isIpv4Only,
  isAutoConnectEnabled,
  excludedApps,
  onChangeDns,
  onToggleIpv4Only,
  onToggleAutoConnect,
  onAddExcludedApp,
  onRemoveExcludedApp,
  onOpenAddServer,
}: Props) {
  const [packageDraft, setPackageDraft] = useState('');

  const handleAddPackage = () => {
    const clean = packageDraft.trim();
    if (!clean) return;
    triggerHaptic('selection');
    onAddExcludedApp(clean);
    setPackageDraft('');
  };

  return (
    <BottomSheet isVisible={isVisible} title="VPN Options" onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subLabel}>DNS Resolver</Text>
        <View style={styles.chipsRow}>
          {DNS_OPTIONS.map((option) => {
            const isSelected = dnsPreset === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  triggerHaptic('selection');
                  onChangeDns(option.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${option.label} DNS`}
                style={[styles.chip, isSelected && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>IPv4-Only Tunnel</Text>
            <Text style={styles.toggleSub}>Disable IPv6 routes for IPv4 peers</Text>
          </View>
          <Switch
            value={isIpv4Only}
            onValueChange={(val) => {
              triggerHaptic('selection');
              onToggleIpv4Only(val);
            }}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
            thumbColor={colors.textOnAccent}
            accessibilityLabel="IPv4 only tunnel"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Auto-Connect on Wi-Fi</Text>
            <Text style={styles.toggleSub}>Connect automatically on Wi-Fi</Text>
          </View>
          <Switch
            value={isAutoConnectEnabled}
            onValueChange={(val) => {
              triggerHaptic('selection');
              onToggleAutoConnect(val);
            }}
            trackColor={{ false: colors.borderSubtle, true: colors.accent }}
            thumbColor={colors.textOnAccent}
            accessibilityLabel="Auto connect on Wi-Fi"
          />
        </View>

        {Platform.OS === 'android' ? (
          <View style={styles.splitSection}>
            <Text style={styles.toggleTitle}>Bypass VPN (Android Apps)</Text>
            <View style={styles.addPkgRow}>
              <TextInput
                value={packageDraft}
                onChangeText={setPackageDraft}
                placeholder="com.example.bankingapp"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleAddPackage}
                style={styles.pkgInput}
                accessibilityLabel="Package name to bypass VPN"
              />
              <Pressable
                onPress={handleAddPackage}
                accessibilityRole="button"
                accessibilityLabel="Add excluded package"
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
            {excludedApps.length > 0 ? (
              <View style={styles.chipsRow}>
                {excludedApps.map((pkg) => (
                  <Pressable
                    key={pkg}
                    onPress={() => {
                      triggerHaptic('light');
                      onRemoveExcludedApp(pkg);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${pkg} exclusion`}
                    style={styles.pkgChip}
                  >
                    <Text style={styles.pkgChipText} numberOfLines={1}>
                      {pkg}
                    </Text>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            onClose();
            onOpenAddServer();
          }}
          accessibilityRole="button"
          accessibilityLabel="Add WireGuard profile or API"
          style={styles.manageRow}
        >
          <Text style={styles.manageText}>Import .conf or Set VPN API</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 440 },
  content: { gap: spacing.sm, paddingBottom: spacing.sm },
  subLabel: { ...typography.small, color: colors.textSecondary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: colors.textOnAccent, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  toggleTextCol: { flex: 1, paddingRight: spacing.sm },
  toggleTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  toggleSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  splitSection: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  addPkgRow: { flexDirection: 'row', gap: spacing.xs },
  pkgInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    ...typography.caption,
    color: colors.textPrimary,
  },
  addBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  pkgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pkgChipText: { ...typography.small, color: colors.textPrimary },
  manageRow: {
    minHeight: spacing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageText: { ...typography.bodyStrong, color: colors.accent },
});

