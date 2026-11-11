import { logError } from './logger';

type KeyValueStore = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string | number | boolean) => void;
  getBoolean: (key: string) => boolean | undefined;
  getNumber: (key: string) => number | undefined;
  delete: (key: string) => void;
};

const memoryFallback = new Map<string, string | number | boolean>();

function createStore(): KeyValueStore {
  try {
    // Dynamically initialize MMKV for native builds; gracefully fall back in unsupported environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkvModule = require('react-native-mmkv') as {
      MMKV?: new (config?: { id?: string }) => KeyValueStore;
      createMMKV?: (config?: { id?: string }) => KeyValueStore;
    };

    if (typeof mmkvModule.createMMKV === 'function') {
      return mmkvModule.createMMKV({ id: 'rapidex-storage' });
    }
    if (typeof mmkvModule.MMKV === 'function') {
      return new mmkvModule.MMKV({ id: 'rapidex-storage' });
    }
  } catch (err) {
    logError('mmkv-init', err);
  }

  return {
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
}

export const kvStorage = createStore();

