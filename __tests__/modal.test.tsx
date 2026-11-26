import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { InspectorModal } from '../src/ui';
import { splitUrl } from '../src/ui/panel/NetworkTab';
import { AppInspector } from '../src/core';

function pushRequest(over: Record<string, unknown> = {}): void {
  act(() => {
    AppInspector.getStore().pushNetwork({
      id: 'n1',
      method: 'POST',
      url: 'https://api.example.com/orders',
      status: 201,
      startedAt: Date.now(),
      durationMs: 840,
      ...over,
    });
  });
}

describe('<InspectorModal />', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('renders the header and tabs when visible', () => {
    const { getByText } = render(<InspectorModal visible />);
    expect(getByText('Inspector')).toBeTruthy();
    expect(getByText('Network')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('shows captured requests on the Network tab', () => {
    const { getByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    expect(getByText('/orders')).toBeTruthy();
    expect(getByText('201')).toBeTruthy();
  });

  it('freezes live data while paused', () => {
    const { getAllByText, getByText, queryByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('Settings'));
    fireEvent.press(getByText('Pause live updates'));
    // Header chip + the settings row status both flag the paused state.
    expect(getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
    fireEvent.press(getByText('Network'));
    pushRequest({ id: 'n2', url: 'https://api.example.com/after-pause' });
    expect(queryByText('/after-pause')).toBeNull();
  });

  it('clears via Settings and resumes so the wipe is visible', () => {
    const clear = jest.spyOn(AppInspector, 'clear');
    const { getByText, queryByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('Settings'));
    fireEvent.press(getByText('Pause live updates'));
    fireEvent.press(getByText('Clear session'));
    expect(clear).toHaveBeenCalled();
    // Clear resumes: new data streams in instead of the frozen snapshot.
    fireEvent.press(getByText('Network'));
    pushRequest({ id: 'n3', url: 'https://api.example.com/fresh' });
    expect(queryByText('/fresh')).toBeTruthy();
    clear.mockRestore();
  });

  it('shows live performance data on the Perf tab', () => {
    const { getAllByText, getByText, queryByText } = render(
      <InspectorModal visible initialTab="performance" />,
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
    expect(getAllByText('58').length).toBeGreaterThan(0);
    expect(getByText('40 ms')).toBeTruthy();
  });

  it('shows timeline events with the possible-cause summary and detail', () => {
    const { getByText, queryByText } = render(<InspectorModal visible />);
    expect(queryByText(/No events yet/)).toBeTruthy();

    act(() => {
      const timeline = AppInspector.getTimeline();
      timeline.trackNavigation('Checkout', 420);
      timeline.trackRender('CheckoutScreen', 600, 'update');
      timeline.trackFpsDrop(60, 25);
    });

    expect(getByText(/Possible cause/)).toBeTruthy();
    fireEvent.press(getByText(/FPS drop 60 → 25/));
    expect(getByText(/Back to timeline/)).toBeTruthy();
    expect(getByText(/CheckoutScreen render \(600ms\)/)).toBeTruthy();

    fireEvent.press(getByText(/Back to timeline/));
    expect(queryByText(/Back to timeline/)).toBeNull();
  });

  it('copies a request as cURL via a configured clipboard adapter', () => {
    const setString = jest.fn();
    AppInspector.configure({ clipboard: { setString } });
    const { getByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('/orders'));
    fireEvent.press(getByText('Copy cURL'));
    expect(setString).toHaveBeenCalledWith(
      expect.stringContaining("curl -X POST 'https://api.example.com/orders'"),
    );
    expect(getByText('Copied ✓')).toBeTruthy();
  });

  it('shows captured headers and puts request headers into the cURL', () => {
    const setString = jest.fn();
    AppInspector.configure({ clipboard: { setString } });
    const { getByText, getAllByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest({
      requestHeaders: {
        Authorization: '[redacted]',
        Accept: 'application/json',
      },
      responseHeaders: { 'content-type': 'application/json' },
    });
    fireEvent.press(getByText('/orders'));
    expect(getByText('Request headers')).toBeTruthy();
    // Once in the headers block and once inside the cURL.
    expect(getAllByText(/Authorization: \[redacted\]/)).toHaveLength(2);
    expect(getByText('Response headers')).toBeTruthy();
    fireEvent.press(getByText('Copy cURL'));
    expect(setString).toHaveBeenCalledWith(
      expect.stringContaining("-H 'Accept: application/json'"),
    );
  });

  it('hides Copy buttons when no clipboard is available', () => {
    const { getByText, queryByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('/orders'));
    expect(getByText('cURL')).toBeTruthy(); // detail is open
    expect(queryByText('Copy cURL')).toBeNull();
  });

  it('shows measured interactions on the Taps tab', () => {
    const { getByText } = render(
      <InspectorModal visible initialTab="interactions" />,
    );
    expect(getByText(/No taps measured yet/)).toBeTruthy();

    act(() => {
      AppInspector.getTimeline().trackInteraction('Add to cart', 250, 'Todos');
      AppInspector.getTimeline().trackInteraction('Toggle todo', 40);
    });

    expect(getByText('Add to cart')).toBeTruthy();
    expect(getByText('250ms')).toBeTruthy();
    expect(getByText('145ms / 250ms')).toBeTruthy(); // avg / worst
  });

  it('toggles the floating badge via the settings switch', () => {
    const onToggleBadge = jest.fn();
    const { getByText, getByLabelText } = render(
      <InspectorModal visible badgeVisible onToggleBadge={onToggleBadge} />,
    );
    fireEvent.press(getByText('Settings'));
    fireEvent(getByLabelText('Toggle floating badge'), 'valueChange', false);
    expect(onToggleBadge).toHaveBeenCalledTimes(1);
  });

  it('fires onClose from the Close control', () => {
    const onClose = jest.fn();
    const { getByText } = render(<InspectorModal visible onClose={onClose} />);
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the request path with the host underneath', () => {
    const { getByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest({ url: 'https://api.example.com/orders?page=2' });
    expect(getByText('/orders?page=2')).toBeTruthy();
    expect(getByText('api.example.com')).toBeTruthy();
  });

  it('filters failed requests and counts them on the Network tab', () => {
    const { getByText, queryByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    pushRequest({ id: 'n2', url: 'https://api.example.com/boom', status: 500 });
    pushRequest({
      id: 'n3',
      url: 'https://api.example.com/offline',
      status: undefined,
    });
    expect(getByText('ERR')).toBeTruthy();
    // Tab badge: the 500 plus the request that got no response.
    expect(getByText('2')).toBeTruthy();

    fireEvent.press(getByText('Failed'));
    expect(queryByText('/orders')).toBeNull();
    expect(getByText('/boom')).toBeTruthy();
    expect(getByText('/offline')).toBeTruthy();
  });

  it('system back leaves a detail view before closing the modal', () => {
    const onClose = jest.fn();
    const { getByText, queryByText, UNSAFE_getByType } = render(
      <InspectorModal visible initialTab="network" onClose={onClose} />,
    );
    pushRequest();
    fireEvent.press(getByText('/orders'));
    expect(getByText(/Back to network/)).toBeTruthy();

    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(queryByText(/Back to network/)).toBeNull();

    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the search bar while a detail view is open', () => {
    const { getByText, queryByPlaceholderText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    expect(queryByPlaceholderText('Search requests…')).toBeTruthy();
    fireEvent.press(getByText('/orders'));
    expect(queryByPlaceholderText('Search requests…')).toBeNull();
    fireEvent.press(getByText(/Back to network/));
    expect(queryByPlaceholderText('Search requests…')).toBeTruthy();
  });

  it('drops back to the list when the open request is cleared', () => {
    const { getByText, queryByPlaceholderText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('/orders'));
    act(() => AppInspector.clear());
    expect(queryByPlaceholderText('Search requests…')).toBeTruthy();
  });
});

describe('splitUrl', () => {
  it('splits absolute URLs into host and path', () => {
    expect(splitUrl('https://a.io/x/y?q=1#h')).toEqual({
      host: 'a.io',
      path: '/x/y?q=1#h',
    });
    expect(splitUrl('http://a.io:8080')).toEqual({
      host: 'a.io:8080',
      path: '/',
    });
  });

  it('keeps relative URLs whole', () => {
    expect(splitUrl('/orders')).toEqual({ host: '', path: '/orders' });
  });
});
