import { Pressable } from 'react-native';
import type { GestureResponderEvent, PressableProps } from 'react-native';
import type { ReactElement } from 'react';
import { AppInspector } from '../core';

export interface InspectorPressableProps extends PressableProps {
  /** Interaction name on the timeline, e.g. "Add to cart". */
  label: string;
}

/**
 * A drop-in `Pressable` that measures tap-to-response latency, from the
 * press's native release timestamp to the first frame presented after the
 * next React commit. Cancelled presses (drag off) record nothing.
 */
export function InspectorPressable({
  label,
  onPress,
  ...rest
}: InspectorPressableProps): ReactElement {
  const handlePress = (event: GestureResponderEvent): void => {
    AppInspector.getInteractionTracker().begin(label, {
      nativeTimestampMs: event.nativeEvent.timestamp,
      completeOnCommit: true,
    });
    onPress?.(event);
  };

  return <Pressable {...rest} onPress={handlePress} />;
}
