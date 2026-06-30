import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { panelStyles as styles } from './styles';

export interface RowProps {
  label: string;
  value: string;
}

/** A label/value line shared across the panel tabs. */
export function Row({ label, value }: RowProps): ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
