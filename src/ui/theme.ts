import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/** Semantic colour tokens shared across every inspector surface. */
export interface Theme {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  divider: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentText: string;
  /** Soft accent wash for chips and tags. */
  accentSoft: string;
  good: string;
  warn: string;
  bad: string;
  /** Soft danger wash for banners. */
  badSoft: string;
}

export const darkTheme: Theme = {
  scheme: 'dark',
  bg: 'rgba(13, 15, 18, 0.97)',
  surface: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.07)',
  text: '#e7e9ee',
  muted: '#878d9c',
  faint: '#5b606e',
  accent: '#6aa8ff',
  accentText: '#06203d',
  accentSoft: 'rgba(106, 168, 255, 0.14)',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
  badSoft: 'rgba(248, 113, 113, 0.14)',
};

export const lightTheme: Theme = {
  scheme: 'light',
  bg: 'rgba(255, 255, 255, 0.98)',
  surface: 'rgba(0, 0, 0, 0.04)',
  divider: 'rgba(0, 0, 0, 0.08)',
  text: '#1a1d24',
  muted: '#5b606e',
  faint: '#9aa0ad',
  accent: '#2563eb',
  accentText: '#ffffff',
  accentSoft: 'rgba(37, 99, 235, 0.10)',
  good: '#059669',
  warn: '#d97706',
  bad: '#dc2626',
  badSoft: 'rgba(220, 38, 38, 0.10)',
};

const ThemeContext = createContext<Theme | null>(null);

/** Force a theme on the subtree, overriding the system colour scheme. */
export const ThemeProvider = ThemeContext.Provider;

/** Resolve the active theme: explicit override, else the system scheme. */
export function useTheme(): Theme {
  const override = useContext(ThemeContext);
  const scheme = useColorScheme();
  if (override) {
    return override;
  }
  return scheme === 'light' ? lightTheme : darkTheme;
}

/** Colour for an FPS reading against the usual 30/50 thresholds. */
export function fpsColor(theme: Theme, fps: number): string {
  if (fps <= 0) {
    return theme.muted;
  }
  if (fps < 30) {
    return theme.bad;
  }
  if (fps < 50) {
    return theme.warn;
  }
  return theme.good;
}

/** Colour for a 0–100 quality score (screens, etc). */
export function scoreColor(theme: Theme, score: number): string {
  if (score >= 80) {
    return theme.good;
  }
  if (score >= 50) {
    return theme.warn;
  }
  return theme.bad;
}
