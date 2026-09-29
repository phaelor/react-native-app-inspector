import { act, fireEvent, render } from '@testing-library/react-native';
import { InspectorFpsBadge, dockBadge } from '../src/ui/InspectorFpsBadge';
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

  it('keeps a docked badge inside a resized window', () => {
    const badge = { width: 170, height: 48 };
    // Placed bottom-right in portrait, then the window turns to landscape.
    expect(
      dockBadge('bottom', true, badge, { width: 390, height: 850 }),
    ).toEqual({ x: 390 - 170 - 12, y: 850 - 48 - 40 });
    expect(dockBadge(762, true, badge, { width: 850, height: 390 })).toEqual({
      x: 850 - 170 - 12,
      y: 390 - 48 - 40,
    });
    expect(dockBadge(762, false, badge, { width: 850, height: 390 })).toEqual({
      x: 12,
      y: 390 - 48 - 40,
    });
    // Still fits: only the horizontal edge moves.
    expect(dockBadge(200, true, badge, { width: 850, height: 390 })).toEqual({
      x: 850 - 170 - 12,
      y: 200,
    });
  });
});
