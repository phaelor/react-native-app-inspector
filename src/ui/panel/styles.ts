import { StyleSheet } from 'react-native';

/** Minimal dark palette shared across the panel. */
export const colors = {
  bg: 'rgba(13, 15, 18, 0.97)',
  surface: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.07)',
  text: '#e7e9ee',
  muted: '#878d9c',
  faint: '#5b606e',
  accent: '#6aa8ff',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
};

/** Shared styles for the in-app panel and its tab views. */
export const panelStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    margin: 10,
    borderRadius: 16,
    backgroundColor: colors.bg,
    maxHeight: 320,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
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
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Tab bar
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
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
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },

  // Body
  body: {
    paddingHorizontal: 14,
  },
  bodyInner: {
    paddingVertical: 10,
  },
  sectionTitle: {
    color: colors.faint,
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
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    color: colors.faint,
    fontSize: 13,
    paddingVertical: 10,
    lineHeight: 18,
  },

  // Correlation banner
  cause: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: 10,
    padding: 9,
    marginBottom: 8,
  },
  causeText: {
    color: '#fca5a5',
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
    color: colors.faint,
    fontSize: 11,
    width: 46,
    fontVariant: ['tabular-nums'],
  },
  eventType: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    width: 32,
  },
  eventLabel: {
    color: colors.text,
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
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#06203d',
  },

  // Screen report row
  screenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  screenName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  screenMeta: {
    color: colors.muted,
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
    color: colors.muted,
  },
  problemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 9,
  },
  problemText: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },

  // Detail back link
  back: {
    paddingVertical: 6,
  },
  backText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});
