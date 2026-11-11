import { Platform } from 'react-native';
import { logError } from './logger';

type KeyValueStore = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string | number | boolean) => void;
  getBoolean: (key: string) => boolean | undefined;
  getNumber: (key: string) => number | undefined;
  delete: (key: string) => void;
};

const memoryFallback = new Map<string, string | number | boolean>();

const fallbackStore: KeyValueStore = {
  getString: (key: string) => {
    const val = memoryFallback.get(key);
    return typeof val === 'string' ? val : undefined;
  },
  set: (key: string, value: string | number | boolean) => {
    memoryFallback.set(key, value);
  },
  getBoolean: (key: string) => {
    const val = memoryFallback.get(key);
    return typeof val === 'boolean' ? val : undefined;
  },
  getNumber: (key: string) => {
    const val = memoryFallback.get(key);
    return typeof val === 'number' ? val : undefined;
  },
  delete: (key: string) => {
    memoryFallback.delete(key);
  },
};

let nativeOrBrowserStore: KeyValueStore | null = null;

function canAccessDomStorage(): boolean {
  if (Platform.OS !== 'web') {
    return true;
  }
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getActiveStore(): KeyValueStore {
  if (!canAccessDomStorage()) {
    return fallbackStore;
  }
  if (nativeOrBrowserStore) {
    return nativeOrBrowserStore;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkvModule = require('react-native-mmkv') as {
      MMKV?: new (config?: { id?: string }) => KeyValueStore;
      createMMKV?: (config?: { id?: string }) => KeyValueStore;
    };

    if (typeof mmkvModule.createMMKV === 'function') {
      nativeOrBrowserStore = mmkvModule.createMMKV({ id: 'rapidex-storage' });
      return nativeOrBrowserStore;
    }
    if (typeof mmkvModule.MMKV === 'function') {
      nativeOrBrowserStore = new mmkvModule.MMKV({ id: 'rapidex-storage' });
      return nativeOrBrowserStore;
    }
  } catch (err) {
    logError('mmkv-init', err);
  }

  nativeOrBrowserStore = fallbackStore;
  return nativeOrBrowserStore;
}

export const kvStorage: KeyValueStore = {
  getString: (key: string) => {
    try {
      return getActiveStore().getString(key);
    } catch {
      return fallbackStore.getString(key);
    }
  },
  set: (key: string, value: string | number | boolean) => {
    try {
      getActiveStore().set(key, value);
    } catch {
      fallbackStore.set(key, value);
    }
  },
  getBoolean: (key: string) => {
    try {
      return getActiveStore().getBoolean(key);
    } catch {
      return fallbackStore.getBoolean(key);
    }
  },
  getNumber: (key: string) => {
    try {
      return getActiveStore().getNumber(key);
    } catch {
      return fallbackStore.getNumber(key);
    }
  },
  delete: (key: string) => {
    try {
      getActiveStore().delete(key);
    } catch {
      fallbackStore.delete(key);
    }
  },
};
