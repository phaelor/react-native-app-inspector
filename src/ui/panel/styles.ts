import { StyleSheet } from 'react-native';
import { darkTheme, useTheme } from '../theme';
import type { Theme } from '../theme';

/** Build the panel stylesheet for a given theme. */
export function makePanelStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    panel: {
      margin: 10,
      borderRadius: 16,
      backgroundColor: t.bg,
      maxHeight: 320,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.divider,
    },

    // Live summary strip — glanceable, always visible.
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 18,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
    },
    statusValue: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    statusLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: t.faint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Tab bar
    tabs: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    tabsSpacer: {
      flex: 1,
    },
    tab: {
      paddingVertical: 9,
      paddingHorizontal: 10,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: t.accent,
    },
    tabText: {
      color: t.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    tabTextActive: {
      color: t.text,
    },

    // Body
    body: {
      paddingHorizontal: 14,
    },
    bodyInner: {
      paddingVertical: 10,
    },
    sectionTitle: {
      color: t.faint,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 10,
      marginBottom: 4,
    },

    // Label / value row
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    rowLabel: {
      color: t.muted,
      fontSize: 13,
    },
    rowValue: {
      color: t.text,
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    empty: {
      color: t.faint,
      fontSize: 13,
      paddingVertical: 10,
      lineHeight: 18,
    },

    // Correlation banner
    cause: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(248, 113, 113, 0.14)',
      borderRadius: 10,
      padding: 9,
      marginBottom: 8,
    },
    causeIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.bad,
      alignItems: 'center',
      justifyContent: 'center',
    },
    causeIconText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },
    causeText: {
      flex: 1,
      color: t.bad,
      fontSize: 12,
      lineHeight: 16,
    },

    // Timeline event row
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 9,
    },
    eventTime: {
      color: t.faint,
      fontSize: 11,
      width: 46,
      fontVariant: ['tabular-nums'],
    },
    eventType: {
      color: t.accent,
      fontSize: 10,
      fontWeight: '700',
      width: 32,
    },
    eventLabel: {
      color: t.text,
      fontSize: 12,
      flex: 1,
    },

    // Filter chips
    filterRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 8,
    },
    chip: {
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: t.surface,
    },
    chipActive: {
      backgroundColor: t.accent,
    },
    chipText: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    chipTextActive: {
      color: t.accentText,
    },

    // Screen report row
    screenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    screenName: {
      color: t.text,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    screenMeta: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 8,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    screenScore: {
      fontSize: 15,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      width: 32,
      textAlign: 'right',
      marginLeft: 8,
    },
    scoreHeadline: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      paddingVertical: 6,
    },
    scoreBig: {
      fontSize: 30,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    scoreOutOf: {
      fontSize: 13,
      color: t.muted,
    },
    problemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      gap: 9,
    },
    problemText: {
      color: t.text,
      fontSize: 12,
      flex: 1,
    },

    // Detail back link
    back: {
      paddingVertical: 6,
    },
    backText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}

export type PanelStyles = ReturnType<typeof makePanelStyles>;

/** One stylesheet per theme, shared across every component instance. */
const styleCache = new Map<Theme, PanelStyles>();

export function panelStylesFor(theme: Theme): PanelStyles {
  let styles = styleCache.get(theme);
  if (!styles) {
    styles = makePanelStyles(theme);
    styleCache.set(theme, styles);
  }
  return styles;
}

/** Themed panel styles + the resolved theme. */
export function usePanelStyles(): { styles: PanelStyles; theme: Theme } {
  const theme = useTheme();
  return { styles: panelStylesFor(theme), theme };
}

/** Default (dark) instances kept for non-hook call sites. */
export const colors = darkTheme;
export const panelStyles = panelStylesFor(darkTheme);
