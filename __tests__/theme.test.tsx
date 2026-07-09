import { createElement } from 'react';
import { useColorScheme } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import {
  ThemeProvider,
  useTheme,
  darkTheme,
  lightTheme,
  fpsColor,
  scoreColor,
} from '../src/ui/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');
const mockScheme = useColorScheme as jest.Mock;

describe('useTheme', () => {
  afterEach(() => mockScheme.mockReset());

  it('follows the system scheme by default', () => {
    mockScheme.mockReturnValue('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });

  it('falls back to dark when the scheme is unknown', () => {
    mockScheme.mockReturnValue(null);
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(darkTheme);
  });

  it('honours an explicit ThemeProvider override', () => {
    mockScheme.mockReturnValue('light');
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) =>
        createElement(ThemeProvider, { value: darkTheme }, children),
    });
    expect(result.current).toBe(darkTheme);
  });
});

describe('colour helpers', () => {
  it('maps fps to the right threshold colour', () => {
    expect(fpsColor(darkTheme, 0)).toBe(darkTheme.muted);
    expect(fpsColor(darkTheme, 20)).toBe(darkTheme.bad);
    expect(fpsColor(darkTheme, 45)).toBe(darkTheme.warn);
    expect(fpsColor(darkTheme, 60)).toBe(darkTheme.good);
  });

  it('maps a 0–100 score to the right colour', () => {
    expect(scoreColor(lightTheme, 90)).toBe(lightTheme.good);
    expect(scoreColor(lightTheme, 60)).toBe(lightTheme.warn);
    expect(scoreColor(lightTheme, 20)).toBe(lightTheme.bad);
  });
});
