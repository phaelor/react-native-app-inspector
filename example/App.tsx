/**
 * Demo app for react-native-app-inspector.
 *
 * The entire integration is this one wrapper: capture starts automatically,
 * the draggable FPS badge appears, and tapping it opens the inspector panel.
 * The Todo app inside (./src) produces real data to inspect — network
 * requests, actions, navigation, render stats, FPS drops and errors.
 *
 * @format
 */

import React from 'react';
import {InspectorRoot} from 'react-native-app-inspector';
import {DemoApp} from './src/DemoApp';

function App(): React.JSX.Element {
  return (
    <InspectorRoot badgeCorner="bottom-left">
      <DemoApp />
    </InspectorRoot>
  );
}

export default App;
