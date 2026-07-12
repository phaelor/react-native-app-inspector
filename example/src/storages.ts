import AsyncStorage from '@react-native-async-storage/async-storage';
import {MMKV} from 'react-native-mmkv';
import {asyncStorageAdapter, mmkvAdapter} from 'react-native-app-inspector';

export const mmkv = new MMKV();

export const inspectorStorages = [
  asyncStorageAdapter(AsyncStorage),
  mmkvAdapter(mmkv),
];

export function seedDemoStorage(): void {
  void AsyncStorage.setItem('auth/token', 'demo-jwt-abc123');
  void AsyncStorage.setItem(
    'settings',
    JSON.stringify({theme: 'dark', locale: 'en', pushEnabled: true}),
  );
  void AsyncStorage.setItem(
    'user',
    JSON.stringify({id: 42, name: 'Ada', plan: 'pro'}),
  );
  mmkv.set('launchCount', (mmkv.getNumber('launchCount') ?? 0) + 1);
  mmkv.set('darkMode', true);
  mmkv.set('lastRoute', '/todos');
}
