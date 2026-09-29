import { act, fireEvent, render } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { InspectorModal } from '../src/ui';
import { resetModalInsetsCache } from '../src/ui/useModalInsets';
import { NativeMetricsModule } from '../src/native';
import { AppInspector } from '../src/core';

const INSETS = { top: 59, right: 0, bottom: 34, left: 0 };

function mockNativeInsets(): void {
  jest.spyOn(NativeMetricsModule, 'supportsWindowInsets').mockReturnValue(true);
  jest.spyOn(NativeMetricsModule, 'getWindowInsets').mockResolvedValue(INSETS);
}

function setPlatform(os: 'ios' | 'android'): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

async function renderPanel() {
  const utils = render(<InspectorModal visible />);
  await act(async () => {});
  const root = utils.getByTestId('inspector-panel-root');
  return {
    ...utils,
    root,
    padding: () => StyleSheet.flatten(root.props.style),
  };
}

describe('panel safe-area padding', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
    resetModalInsetsCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setPlatform('ios');
  });

  it('pads with the native window insets on iOS', async () => {
    mockNativeInsets();
    const { root, padding } = await renderPanel();
    expect(root.type).toBe('View');
    expect(padding()).toMatchObject({ paddingTop: 59, paddingBottom: 34 });
  });

  it('falls back to SafeAreaView on iOS without the native module', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { root, padding } = await renderPanel();
    expect(root.type).toBe('RCTSafeAreaView');
    expect(padding()).toMatchObject({ paddingTop: 0, paddingBottom: 0 });
    warn.mockRestore();
  });

  it('pads on Android only when the panel is drawn edge-to-edge', async () => {
    setPlatform('android');
    mockNativeInsets();
    const screen = Dimensions.get('screen').height;
    const { root, padding } = await renderPanel();
    expect(padding()).toMatchObject({ paddingTop: 0, paddingBottom: 0 });

    fireEvent(root, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: screen } },
    });
    expect(padding()).toMatchObject({ paddingTop: 59, paddingBottom: 34 });

    // The keyboard shrinks the Modal; the header must stay clear of the bar.
    fireEvent(root, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: screen - 300 } },
    });
    expect(padding()).toMatchObject({ paddingTop: 59, paddingBottom: 34 });
  });

  it('adds no padding on Android when the system keeps the panel inset', async () => {
    setPlatform('android');
    mockNativeInsets();
    const screen = Dimensions.get('screen').height;
    const { root, padding } = await renderPanel();
    fireEvent(root, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: screen - 72 } },
    });
    expect(padding()).toMatchObject({ paddingTop: 0, paddingBottom: 0 });
  });
});
