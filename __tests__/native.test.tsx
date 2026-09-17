import { NativeMetricsModule } from '../src/native';

// In the test environment the native module isn't linked, so the bridge should
// degrade to a harmless no-op. (Lives in the `ui` project for `react-native`.)
describe('NativeMetricsModule — native module not linked', () => {
  it('reports unavailable and returns zeroed metrics', () => {
    expect(NativeMetricsModule.isAvailable()).toBe(false);
    expect(NativeMetricsModule.getLatest()).toEqual({
      uiFps: 0,
      usedMemoryMb: 0,
      cpuPercent: 0,
    });
  });

  it('warns once when started, then stays quiet', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    NativeMetricsModule.start(1000);
    NativeMetricsModule.start(1000);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'react-native-app-inspector',
    );

    NativeMetricsModule.stop();
    warn.mockRestore();
  });

  it('resolves an undefined process start time', async () => {
    await expect(
      NativeMetricsModule.getProcessStartTime(),
    ).resolves.toBeUndefined();
  });

  it('resolves null for the next presented frame', async () => {
    await expect(NativeMetricsModule.watchNextFrame()).resolves.toBeNull();
  });
});

describe('NativeMetricsModule — network capture capability', () => {
  it('reports no native capture when the module is not linked', () => {
    expect(NativeMetricsModule.supportsNetworkCapture()).toBe(false);
  });

  const methods = () => ({
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    getProcessStartTime: jest.fn(),
    watchNextFrame: jest.fn(),
    startNetworkCapture: jest.fn(),
    stopNetworkCapture: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  });

  /** Registers a fake module on the legacy bridge and loads a fresh bridge. */
  function withLegacyModule<T>(
    module: Record<string, unknown>,
    run: (bridge: typeof NativeMetricsModule) => T,
  ): T {
    let result!: T;
    jest.isolateModules(() => {
      const rn =
        jest.requireActual<typeof import('react-native')>('react-native');
      rn.NativeModules.AppInspector = module;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        result = run(require('../src/native').NativeMetricsModule);
      } finally {
        delete rn.NativeModules.AppInspector;
      }
    });
    return result;
  }

  it('honours networkCaptureAvailable=false exposed as a legacy constant', () => {
    withLegacyModule({ ...methods(), networkCaptureAvailable: false }, (b) => {
      expect(b.isAvailable()).toBe(true);
      expect(b.supportsNetworkCapture()).toBe(false);
    });
  });

  it('honours networkCaptureAvailable via getConstants() (TurboModule)', () => {
    withLegacyModule(
      {
        ...methods(),
        getConstants: () => ({ networkCaptureAvailable: false }),
      },
      (b) => expect(b.supportsNetworkCapture()).toBe(false),
    );
    withLegacyModule(
      { ...methods(), getConstants: () => ({ networkCaptureAvailable: true }) },
      (b) => expect(b.supportsNetworkCapture()).toBe(true),
    );
  });

  it('assumes native capture is available when no constant is shipped', () => {
    withLegacyModule(methods(), (b) =>
      expect(b.supportsNetworkCapture()).toBe(true),
    );
  });

  it('forwards capture options to the native startNetworkCapture', () => {
    const module = methods();
    withLegacyModule(module, (b) => {
      b.startNetworkCapture(() => {}, {
        captureBodies: false,
        maxBodyBytes: 512,
        captureHeaders: true,
      });
    });
    expect(module.startNetworkCapture).toHaveBeenCalledWith(false, 512, true);
  });
});
