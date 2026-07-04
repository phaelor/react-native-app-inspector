import { Pressable } from 'react-native';
import type { GestureResponderEvent, PressableProps } from 'react-native';
import type { ReactElement } from 'react';
import { AppInspector } from '../core';

export interface InspectorPressableProps extends PressableProps {
  /** Interaction name on the timeline, e.g. "Add to cart". */
  label: string;
}

/**
 * A drop-in `Pressable` that measures tap-to-response latency, from the native
 * touch timestamp to the first frame presented after the next React commit.
 */
export function InspectorPressable({
  label,
  onPressIn,
  ...rest
}: InspectorPressableProps): ReactElement {
  const handlePressIn = (event: GestureResponderEvent): void => {
    AppInspector.getInteractionTracker().begin(label, {
      nativeTimestampMs: event.nativeEvent.timestamp,
      completeOnCommit: true,
    });
    onPressIn?.(event);
  };

  return <Pressable {...rest} onPressIn={handlePressIn} />;
}
