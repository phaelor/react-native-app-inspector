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
});
