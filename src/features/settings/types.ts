export type MaxConcurrentOption = 1 | 2 | 3 | 4;

export type SaveFolderOption = 'Downloads' | 'Videos' | 'Music' | 'Documents';

export type SettingsState = {
  wifiOnly: boolean;
  maxConcurrent: MaxConcurrentOption;
  defaultFolder: SaveFolderOption;
  autoRouteFolders: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  setWifiOnly: (value: boolean) => void;
  setMaxConcurrent: (value: MaxConcurrentOption) => void;
  setDefaultFolder: (value: SaveFolderOption) => void;
  setAutoRouteFolders: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  completeOnboarding: () => void;
  hydrateSettings: () => void;
};
