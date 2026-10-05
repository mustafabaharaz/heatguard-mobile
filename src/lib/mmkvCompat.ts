// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · MMKV compatibility layer
//
// react-native-mmkv v4 replaced `new MMKV({ id })` with `createMMKV({ id })`
// and renamed `.delete()` to `.remove()`. The app's storage modules were
// written for the old API, so this class keeps that API and delegates to v4.
// One shared native instance per id.
//
// Usage (unchanged from before):  const { MMKV } = require('<path>/lib/mmkvCompat');
//                                  const storage = new MMKV({ id: 'profile-storage' });
// ─────────────────────────────────────────────────────────────────────────────

import { createMMKV, type MMKV as MMKVInstance } from 'react-native-mmkv';

const DEFAULT_ID = 'mmkv.default';
const instances = new Map<string, MMKVInstance>();

function getInstance(id: string): MMKVInstance {
  let instance = instances.get(id);
  if (!instance) {
    instance = createMMKV({ id });
    instances.set(id, instance);
  }
  return instance;
}

export class MMKV {
  private readonly store: MMKVInstance;

  constructor(config?: { id?: string }) {
    this.store = getInstance(config?.id ?? DEFAULT_ID);
  }

  set(key: string, value: string | number | boolean): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.store.getString(key);
  }

  getNumber(key: string): number | undefined {
    return this.store.getNumber(key);
  }

  getBoolean(key: string): boolean | undefined {
    return this.store.getBoolean(key);
  }

  contains(key: string): boolean {
    return this.store.contains(key);
  }

  /** v3 name — kept so existing code works. */
  delete(key: string): void {
    this.store.remove(key);
  }

  remove(key: string): void {
    this.store.remove(key);
  }

  getAllKeys(): string[] {
    return this.store.getAllKeys();
  }

  clearAll(): void {
    this.store.clearAll();
  }
}
