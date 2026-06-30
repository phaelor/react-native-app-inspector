import {
  createNavigationTracker,
  getActiveRouteName,
  type NavigationStateLike,
} from '../src/modules/navigation';
import { AppInspector } from '../src/core';

const nested: NavigationStateLike = {
  index: 0,
  routes: [
    {
      name: 'Root',
      state: {
        index: 1,
        routes: [{ name: 'Home' }, { name: 'Details' }],
      },
    },
  ],
};

describe('getActiveRouteName', () => {
  it('resolves the focused leaf route', () => {
    expect(getActiveRouteName(nested)).toBe('Details');
  });
  it('handles undefined / empty state', () => {
    expect(getActiveRouteName(undefined)).toBeUndefined();
    expect(getActiveRouteName({ index: 0, routes: [] })).toBeUndefined();
  });
});

describe('createNavigationTracker', () => {
  beforeEach(() => {
    AppInspector.configure();
    AppInspector.clear();
  });

  it('records a navigation event per distinct screen, de-duping repeats', () => {
    const tracker = createNavigationTracker();
    tracker.onStateChange({ index: 0, routes: [{ name: 'Home' }] });
    tracker.onStateChange({ index: 0, routes: [{ name: 'Home' }] }); // dup
    tracker.onStateChange({ index: 0, routes: [{ name: 'Profile' }] });

    const navEvents = AppInspector.getState().timeline.filter(
      (e) => e.type === 'navigation',
    );
    expect(navEvents.map((e) => e.label)).toEqual(['Home', 'Profile']);
  });
});
