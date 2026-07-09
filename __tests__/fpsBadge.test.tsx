import { act, fireEvent, render } from '@testing-library/react-native';
import { InspectorFpsBadge } from '../src/ui/InspectorFpsBadge';
import { AppInspector } from '../src/core';
import type { PerformanceSample } from '../src/core/types';

function pushSample(over: Partial<PerformanceSample>): void {
  act(() => {
    AppInspector.getStore().pushPerformance({
      timestamp: Date.now(),
      jsFps: 60,
      uiFps: 0,
      jankyFrames: 0,
      longestFrameMs: 16,
      ...over,
    });
  });
}

describe('<InspectorFpsBadge />', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('renders nothing when hidden', () => {
    const { toJSON } = render(<InspectorFpsBadge visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('shows placeholders until a sample arrives', () => {
    const { getByText, getAllByText } = render(<InspectorFpsBadge />);
    expect(getByText('n/a')).toBeTruthy(); // UI FPS
    expect(getAllByText('—').length).toBeGreaterThan(0); // JS / CPU / MEM
  });

  it('shows JS/UI FPS, CPU and memory from the latest sample', () => {
    const { getByText } = render(<InspectorFpsBadge />);
    pushSample({ jsFps: 58, uiFps: 55, cpuPercent: 12, usedMemoryMb: 130.6 });
    expect(getByText('58')).toBeTruthy();
    expect(getByText('55')).toBeTruthy();
    expect(getByText('12%')).toBeTruthy();
    expect(getByText('131')).toBeTruthy();
  });

  it('fires onPress on a tap', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<InspectorFpsBadge onPress={onPress} />);
    fireEvent.press(getByLabelText('Open inspector'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
