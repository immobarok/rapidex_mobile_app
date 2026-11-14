import { create } from 'zustand';
import { kvStorage } from '@/lib/storage';
import { MaxConcurrentOption, SaveFolderOption, SettingsState } from './types';

const KEYS = {
  WIFI_ONLY: 'settings.wifiOnly',
  MAX_CONCURRENT: 'settings.maxConcurrent',
  DEFAULT_FOLDER: 'settings.defaultFolder',
  AUTO_ROUTE_FOLDERS: 'settings.autoRouteFolders',
  HAPTICS_ENABLED: 'settings.hapticsEnabled',
  NOTIFICATIONS_ENABLED: 'settings.notificationsEnabled',
  ONBOARDING_DONE: 'settings.hasCompletedOnboarding',
  EXTRACTOR_API_URL: 'settings.extractorApiUrl',
} as const;

const ENV_EXTRACTOR_URL = (process.env.EXPO_PUBLIC_EXTRACTOR_API_URL ?? '').trim();

function readInitialExtractorUrl(): string {
  const saved = kvStorage.getString(KEYS.EXTRACTOR_API_URL);
  if (typeof saved === 'string' && saved.trim().length > 0) {
    return saved.trim();
  }
  return ENV_EXTRACTOR_URL;
}

function readInitialMaxConcurrent(): MaxConcurrentOption {
  const saved = kvStorage.getNumber(KEYS.MAX_CONCURRENT);
  if (saved === 1 || saved === 2 || saved === 3 || saved === 4) {
    return saved;
  }
  return 2;
}

function readInitialFolder(): SaveFolderOption {
  const saved = kvStorage.getString(KEYS.DEFAULT_FOLDER);
  if (
    saved === 'Downloads' ||
    saved === 'Videos' ||
    saved === 'Music' ||
    saved === 'Documents'
  ) {
    return saved;
  }
  return 'Downloads';
}

export const useSettingsStore = create<SettingsState>((set) => ({
  wifiOnly: kvStorage.getBoolean(KEYS.WIFI_ONLY) ?? false,
  maxConcurrent: readInitialMaxConcurrent(),
  defaultFolder: readInitialFolder(),
  autoRouteFolders: kvStorage.getBoolean(KEYS.AUTO_ROUTE_FOLDERS) ?? true,
  hapticsEnabled: kvStorage.getBoolean(KEYS.HAPTICS_ENABLED) ?? true,
  notificationsEnabled: kvStorage.getBoolean(KEYS.NOTIFICATIONS_ENABLED) ?? false,
  hasCompletedOnboarding: kvStorage.getBoolean(KEYS.ONBOARDING_DONE) ?? false,
  extractorApiUrl: readInitialExtractorUrl(),

  setWifiOnly: (value) => {
    kvStorage.set(KEYS.WIFI_ONLY, value);
    set({ wifiOnly: value });
  },

  setMaxConcurrent: (value) => {
    kvStorage.set(KEYS.MAX_CONCURRENT, value);
    set({ maxConcurrent: value });
  },

  setDefaultFolder: (value) => {
    kvStorage.set(KEYS.DEFAULT_FOLDER, value);
    set({ defaultFolder: value });
  },

  setAutoRouteFolders: (value) => {
    kvStorage.set(KEYS.AUTO_ROUTE_FOLDERS, value);
    set({ autoRouteFolders: value });
  },

  setHapticsEnabled: (value) => {
    kvStorage.set(KEYS.HAPTICS_ENABLED, value);
    set({ hapticsEnabled: value });
  },

  setNotificationsEnabled: (value) => {
    kvStorage.set(KEYS.NOTIFICATIONS_ENABLED, value);
    set({ notificationsEnabled: value });
  },

  setExtractorApiUrl: (url) => {
    const trimmed = url.trim();
    kvStorage.set(KEYS.EXTRACTOR_API_URL, trimmed);
    set({ extractorApiUrl: trimmed });
  },

  completeOnboarding: () => {
    kvStorage.set(KEYS.ONBOARDING_DONE, true);
    set({ hasCompletedOnboarding: true });
  },

  hydrateSettings: () => {
    set({
      wifiOnly: kvStorage.getBoolean(KEYS.WIFI_ONLY) ?? false,
      maxConcurrent: readInitialMaxConcurrent(),
      defaultFolder: readInitialFolder(),
      autoRouteFolders: kvStorage.getBoolean(KEYS.AUTO_ROUTE_FOLDERS) ?? true,
      hapticsEnabled: kvStorage.getBoolean(KEYS.HAPTICS_ENABLED) ?? true,
      notificationsEnabled:
        kvStorage.getBoolean(KEYS.NOTIFICATIONS_ENABLED) ?? false,
      hasCompletedOnboarding:
        kvStorage.getBoolean(KEYS.ONBOARDING_DONE) ?? false,
      extractorApiUrl: readInitialExtractorUrl(),
    });
  },
}));
