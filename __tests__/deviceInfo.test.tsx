import { getDeviceInfo } from '../src/modules/deviceInfo';

// Lives in the `ui` project (react-native preset) because getDeviceInfo reads
// from `Platform`.
describe('getDeviceInfo', () => {
  it('reads real OS metadata from Platform', () => {
    const info = getDeviceInfo();
    expect(['ios', 'android', 'web', 'windows', 'macos']).toContain(info.os);
    expect(typeof info.osVersion).toBe('string');
    expect(typeof info.isEmulator).toBe('boolean');
    expect(info.deviceModel.length).toBeGreaterThan(0);
  });
});
