import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { usePanelStyles } from './styles';

export interface RowProps {
  label: string;
  value: string;
}

/** A label/value line shared across the panel tabs. */
export function Row({ label, value }: RowProps): ReactElement {
  const { styles } = usePanelStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
