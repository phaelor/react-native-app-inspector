import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { StorageTab } from '../src/ui/panel/StorageTab';
import { AppInspector } from '../src/core';
import {
  asyncStorageAdapter,
  type AsyncStorageLike,
} from '../src/modules/storage';

function fakeAsyncStorage(
  seed: Record<string, string>,
): AsyncStorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getAllKeys: () => Promise.resolve([...map.keys()]),
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      map.clear();
      return Promise.resolve();
    },
  };
}

function setup(seed: Record<string, string>) {
  const store = fakeAsyncStorage(seed);
  AppInspector.configure({ storages: [asyncStorageAdapter(store)] });
  return store;
}

/** Press the destructive button of the last Alert.alert call. */
function confirmLastAlert(alert: jest.SpyInstance): void {
  const buttons = alert.mock.lastCall?.[2] as
    | Array<{ style?: string; onPress?: () => void }>
    | undefined;
  buttons?.find((b) => b.style === 'destructive')?.onPress?.();
}

let alert: jest.SpyInstance;

beforeEach(() => {
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alert.mockRestore();
  AppInspector.configure();
});

describe('<StorageTab />', () => {
  it('hints at wiring when no storage is configured', () => {
    AppInspector.configure();
    const { getByText } = render(<StorageTab />);
    expect(getByText(/No storage connected/)).toBeTruthy();
  });

  it('lists keys sorted with previews, sizes and a total', async () => {
    setup({ user: '{"id":1}', token: 'abc' });
    const { findByText, getByText } = render(<StorageTab />);
    await findByText('token');
    expect(getByText('user')).toBeTruthy();
    expect(getByText('{"id":1}')).toBeTruthy();
    expect(getByText('2 keys · 11 B')).toBeTruthy();
    expect(getByText('3 B')).toBeTruthy();
  });

  it('filters keys via the search prop', async () => {
    setup({ user: 'x', token: 'y' });
    const { findByText, queryByText } = render(<StorageTab search="tok" />);
    await findByText('token');
    expect(queryByText('user')).toBeNull();
  });

  it('shows a pretty-printed value in the detail view', async () => {
    setup({ user: '{"id":1}' });
    const { findByText } = render(<StorageTab />);
    fireEvent.press(await findByText('user'));
    expect(await findByText('{\n  "id": 1\n}')).toBeTruthy();
  });

  it('edits with an autofocused editor and saves back to the store', async () => {
    const store = setup({ note: 'old' });
    const { findByText, getByLabelText } = render(<StorageTab />);
    fireEvent.press(await findByText('note'));
    fireEvent.press(await findByText('Edit'));
    const editor = getByLabelText('Storage value editor');
    expect(editor.props.autoFocus).toBe(true);
    fireEvent.changeText(editor, 'new');
    fireEvent.press(await findByText('Save'));
    await waitFor(() => expect(store.map.get('note')).toBe('new'));
    expect(await findByText('new')).toBeTruthy();
  });

  it('deletes a key only after the alert is confirmed', async () => {
    const store = setup({ doomed: 'x', kept: 'y' });
    const { findByText, queryByText } = render(<StorageTab />);
    fireEvent.press(await findByText('doomed'));
    fireEvent.press(await findByText('Delete'));
    expect(alert).toHaveBeenCalledWith(
      'Delete key?',
      'doomed',
      expect.any(Array),
    );
    expect(store.map.has('doomed')).toBe(true);
    confirmLastAlert(alert);
    await waitFor(() => expect(store.map.has('doomed')).toBe(false));
    expect(await findByText('kept')).toBeTruthy();
    expect(queryByText('doomed')).toBeNull();
  });

  it('clears the whole store after the alert is confirmed', async () => {
    const store = setup({ a: '1', b: '2' });
    const { findByText } = render(<StorageTab />);
    fireEvent.press(await findByText('Clear all'));
    expect(alert).toHaveBeenCalledWith(
      'Clear AsyncStorage?',
      'All 2 keys will be removed.',
      expect.any(Array),
    );
    expect(store.map.size).toBe(2);
    confirmLastAlert(alert);
    await waitFor(() => expect(store.map.size).toBe(0));
    expect(await findByText('This store is empty.')).toBeTruthy();
  });

  it('dims the inspector’s own persistence key', async () => {
    setup({ '@app-inspector/last-session': '{}', normal: 'x' });
    const { findByText } = render(<StorageTab />);
    expect(await findByText('@app-inspector/last-session')).toBeTruthy();
  });
});
