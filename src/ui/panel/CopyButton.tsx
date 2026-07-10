import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { AppInspector } from '../../core';
import { usePanelStyles } from './styles';

/**
 * Small "Copy …" chip with transient "Copied ✓" feedback. Renders nothing
 * when no clipboard is available (no adapter and no RN fallback).
 */
export function CopyButton({
  label,
  getText,
}: {
  label: string;
  getText: () => string;
}): ReactElement | null {
  const { styles, theme } = usePanelStyles();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  if (!AppInspector.canCopy()) {
    return null;
  }

  const handlePress = (): void => {
    if (!AppInspector.copyToClipboard(getText())) {
      return;
    }
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={styles.copyBtn}
    >
      <Text style={[styles.copyBtnText, copied && { color: theme.good }]}>
        {copied ? 'Copied ✓' : label}
      </Text>
    </TouchableOpacity>
  );
}
