import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { InspectorRoot } from '../src/ui';
import { AppInspector } from '../src/core';
import type { NavigationStateLike } from '../src/modules/navigation';

/** A fake React Navigation container ref with a controllable state stream. */
function fakeNavigationRef(initialRoute: string) {
  let current = initialRoute;
  const listeners = new Set<
    (event: { data?: { state?: NavigationStateLike } }) => void
  >();
  return {
    getCurrentRoute: () => ({ name: current }),
    addListener: jest.fn(
      (
        _type: 'state',
        callback: (event: { data?: { state?: NavigationStateLike } }) => void,
      ) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    ),
    navigate(name: string) {
      current = name;
      const state: NavigationStateLike = { index: 0, routes: [{ name }] };
      listeners.forEach((cb) => cb({ data: { state } }));
    },
    listenerCount: () => listeners.size,
  };
}

describe('<InspectorRoot />', () => {
  beforeEach(() => {
    AppInspector.stop();
    AppInspector.configure();
    AppInspector.clear();
  });

  afterEach(() => {
    AppInspector.stop();
  });

  it('renders children and starts capture on mount, stops on unmount', () => {
    const { getByText, unmount } = render(
      <InspectorRoot>
        <Text>Hello app</Text>
      </InspectorRoot>,
    );
    expect(getByText('Hello app')).toBeTruthy();
    expect(AppInspector.isRunning()).toBe(true);
    unmount();
    expect(AppInspector.isRunning()).toBe(false);
  });

  it('is fully inert when disabled', () => {
    const { getByText, queryByLabelText } = render(
      <InspectorRoot enabled={false}>
        <Text>Hello app</Text>
      </InspectorRoot>,
    );
    expect(getByText('Hello app')).toBeTruthy();
    expect(AppInspector.isRunning()).toBe(false);
    expect(queryByLabelText('Open inspector')).toBeNull();
  });

  it('forwards config to configure()', () => {
    const configure = jest.spyOn(AppInspector, 'configure');
    const storage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
    render(
      <InspectorRoot
        storage={storage}
        maxEntries={99}
        modules={{ actions: false }}
      >
        <Text>app</Text>
      </InspectorRoot>,
    );
    expect(configure).toHaveBeenCalledWith({
      enabled: true,
      storage,
      maxEntries: 99,
      modules: { actions: false },
    });
    expect(AppInspector.getConfig().maxEntries).toBe(99);
    expect(AppInspector.getConfig().modules.actions).toBe(false);
    configure.mockRestore();
  });

  it('opens the panel from a badge tap and closes it again', () => {
    const { getByLabelText, getByText, queryByText } = render(
      <InspectorRoot>
        <Text>app</Text>
      </InspectorRoot>,
    );
    expect(queryByText('Inspector')).toBeNull();
    fireEvent.press(getByLabelText('Open inspector'));
    expect(getByText('Inspector')).toBeTruthy();
    fireEvent.press(getByText('Close'));
    expect(queryByText('Inspector')).toBeNull();
  });

  it('toggles the badge from the panel settings', () => {
    const { getByLabelText, getByText, queryByLabelText } = render(
      <InspectorRoot>
        <Text>app</Text>
      </InspectorRoot>,
    );
    fireEvent.press(getByLabelText('Open inspector'));
    fireEvent.press(getByText('Settings'));
    fireEvent(getByLabelText('Toggle floating badge'), 'valueChange', false);
    fireEvent.press(getByText('Close'));
    expect(queryByLabelText('Open inspector')).toBeNull();
  });

  it('tracks the initial route and later navigation from the ref alone', () => {
    const track = jest.spyOn(AppInspector, 'trackNavigation');
    const navRef = fakeNavigationRef('Home');
    const { unmount } = render(
      <InspectorRoot navigationRef={navRef}>
        <Text>app</Text>
      </InspectorRoot>,
    );
    expect(track).toHaveBeenCalledWith('Home');

    act(() => navRef.navigate('Checkout'));
    expect(track).toHaveBeenCalledWith('Checkout');
    expect(track).toHaveBeenCalledTimes(2);

    unmount();
    expect(navRef.listenerCount()).toBe(0);
    track.mockRestore();
  });

  it('records root render stats via the built-in profiler', () => {
    render(
      <InspectorRoot>
        <Text>app</Text>
      </InspectorRoot>,
    );
    const renders = AppInspector.getState().renders;
    expect(renders.some((stat) => stat.id === 'App')).toBe(true);
  });

  it('skips the root profiler when profileRoot is false', () => {
    render(
      <InspectorRoot profileRoot={false}>
        <Text>app</Text>
      </InspectorRoot>,
    );
    expect(AppInspector.getState().renders).toHaveLength(0);
  });
});
