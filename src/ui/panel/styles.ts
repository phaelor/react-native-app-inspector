import { StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { Theme } from '../theme';

/** Build the inspector stylesheet for a given theme. */
export function makePanelStyles(t: Theme) {
  return StyleSheet.create({
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
      backgroundColor: t.badSoft,
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
      paddingVertical: 7,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 9,
    },
    eventTime: {
      color: t.faint,
      fontSize: 11,
      width: 46,
      fontVariant: ['tabular-nums'],
    },
    tagChip: {
      backgroundColor: t.accentSoft,
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
      minWidth: 40,
      alignItems: 'center',
      marginRight: 9,
    },
    tagText: {
      color: t.accent,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    eventLabel: {
      color: t.text,
      fontSize: 13,
      flex: 1,
    },
    eventMeta: {
      color: t.faint,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      marginLeft: 8,
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

    // Full-screen modal
    fullscreen: {
      flex: 1,
      backgroundColor: t.bg,
    },
    bodyFill: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
    },
    title: {
      color: t.text,
      fontSize: 24,
      fontWeight: '800',
      flex: 1,
      letterSpacing: -0.4,
    },
    headerBtn: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBtnText: {
      color: t.accent,
      fontSize: 14,
      fontWeight: '700',
    },

    // Live status card
    statusCard: {
      backgroundColor: t.surface,
      borderRadius: 14,
      marginHorizontal: 16,
      marginBottom: 10,
    },

    // Paused indicator in the header
    pausedChip: {
      backgroundColor: t.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginRight: 6,
    },
    pausedChipText: {
      color: t.warn,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Settings rows
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    settingLabel: {
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    settingValue: {
      color: t.muted,
      fontSize: 13,
      fontWeight: '600',
    },

    // Pill tab bar
    tabsRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: 19,
      backgroundColor: t.surface,
      paddingHorizontal: 15,
      marginRight: 8,
      justifyContent: 'center',
    },
    tabPillActive: {
      backgroundColor: t.accent,
    },
    tabPillText: {
      color: t.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    tabPillTextActive: {
      color: t.accentText,
    },
    tabCount: {
      backgroundColor: t.bad,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabCountText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },

    // Search field
    search: {
      backgroundColor: t.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: t.text,
      fontSize: 13,
      marginBottom: 8,
    },

    // Perf sparklines
    chartRow: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    chartHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 4,
    },
    chartLabel: {
      color: t.faint,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chartValue: {
      color: t.text,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    // Network rows
    netRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    methodChip: {
      backgroundColor: t.accentSoft,
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
      minWidth: 48,
      alignItems: 'center',
    },
    methodText: {
      color: t.accent,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    netUrl: {
      color: t.text,
      fontSize: 13,
      flex: 1,
    },
    netMeta: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    netStatus: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      width: 30,
      textAlign: 'right',
    },
    copyBtn: {
      alignSelf: 'flex-start',
      backgroundColor: t.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 8,
    },
    copyBtnText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    codeBlock: {
      backgroundColor: t.surface,
      borderRadius: 8,
      padding: 8,
      marginTop: 4,
      marginBottom: 8,
    },
    codeText: {
      color: t.muted,
      fontSize: 11,
      fontFamily: 'Courier',
      lineHeight: 15,
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
