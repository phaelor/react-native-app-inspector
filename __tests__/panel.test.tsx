import { act, fireEvent, render } from '@testing-library/react-native';
import { InspectorPanel } from '../src/ui';
import { AppInspector } from '../src/core';

describe('<InspectorPanel />', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('renders nothing when hidden', () => {
    const { toJSON } = render(<InspectorPanel visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('shows live performance data pushed to the store', () => {
    const { getAllByText, getByText, queryByText } = render(
      <InspectorPanel visible initialTab="performance" />,
    );
    expect(queryByText('Waiting for samples…')).toBeTruthy();

    act(() => {
      AppInspector.getStore().pushPerformance({
        timestamp: 1,
        jsFps: 58,
        uiFps: 0,
        jankyFrames: 2,
        longestFrameMs: 40,
      });
    });

    // 58 shows in both the live status strip and the Perf tab's JS FPS row.
    expect(getAllByText('58').length).toBeGreaterThan(0);
    expect(getByText('40 ms')).toBeTruthy(); // longest frame
  });

  it('switches to the startup tab on press', () => {
    const { getByText } = render(<InspectorPanel visible />);
    fireEvent.press(getByText('Startup'));
    expect(getByText('time to interactive')).toBeTruthy();
  });

  it('shows timeline events and the possible-cause summary', () => {
    const { getByText, queryByText } = render(<InspectorPanel visible />);
    fireEvent.press(getByText('Timeline'));
    expect(queryByText(/No events yet/)).toBeTruthy();

    act(() => {
      const timeline = AppInspector.getTimeline();
      timeline.trackNetwork({
        method: 'POST',
        url: 'https://api.example.com/orders',
        durationMs: 1500,
      });
      timeline.trackFpsDrop(60, 28);
    });

    expect(getByText(/FPS drop 60 → 28/)).toBeTruthy();
    expect(getByText(/Possible cause/)).toBeTruthy();
  });

  it('opens an event detail with its own correlation on tap', () => {
    const { getByText, queryByText } = render(<InspectorPanel visible />);
    fireEvent.press(getByText('Timeline'));

    act(() => {
      const timeline = AppInspector.getTimeline();
      timeline.trackNavigation('Checkout', 420);
      timeline.trackRender('CheckoutScreen', 600, 'update');
      timeline.trackFpsDrop(60, 25);
    });

    fireEvent.press(getByText(/FPS drop 60 → 25/));
    expect(getByText(/Back to timeline/)).toBeTruthy();
    // The detail correlates this specific event with its causes.
    expect(getByText(/CheckoutScreen render \(600ms\)/)).toBeTruthy();

    fireEvent.press(getByText(/Back to timeline/));
    expect(queryByText(/Back to timeline/)).toBeNull();
  });
});
