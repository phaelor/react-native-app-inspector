import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import type { InspectorState } from '../../core';
import { Row } from './Row';
import { panelStyles as styles } from './styles';

/** Time-to-interactive and ordered startup / navigation marks. */
export function StartupTab({ state }: { state: InspectorState }): ReactElement {
  const { startup } = state;
  return (
    <View>
      <Row
        label="time to interactive"
        value={
          startup.timeToInteractiveMs !== undefined
            ? `${startup.timeToInteractiveMs} ms`
            : 'not marked'
        }
      />
      {startup.marks.length === 0 ? (
        <Text style={styles.empty}>
          Call AppInspector.mark(name) to record timings.
        </Text>
      ) : (
        startup.marks.map((mark, i) => (
          <Row
            key={`${mark.name}-${i}`}
            label={mark.name}
            value={`${mark.sinceStartMs} ms`}
          />
        ))
      )}
    </View>
  );
}
