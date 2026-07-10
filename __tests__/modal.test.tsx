import { act, fireEvent, render } from '@testing-library/react-native';
import { InspectorModal } from '../src/ui';
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
    expect(getByText('Pause')).toBeTruthy();
  });

  it('shows captured requests on the Network tab', () => {
    const { getByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    expect(getByText('https://api.example.com/orders')).toBeTruthy();
    expect(getByText('201')).toBeTruthy();
  });

  it('freezes live data while paused', () => {
    const { getByText, queryByText } = render(
      <InspectorModal visible initialTab="network" />,
    );
    pushRequest();
    fireEvent.press(getByText('Pause'));
    pushRequest({ id: 'n2', url: 'https://api.example.com/after-pause' });
    expect(queryByText('https://api.example.com/after-pause')).toBeNull();
  });

  it('clears via the Clear control', () => {
    const clear = jest.spyOn(AppInspector, 'clear');
    const { getByText } = render(<InspectorModal visible />);
    fireEvent.press(getByText('Clear'));
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it('fires onClose from the Close control', () => {
    const onClose = jest.fn();
    const { getByText } = render(<InspectorModal visible onClose={onClose} />);
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
