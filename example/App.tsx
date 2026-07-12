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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {InspectorRoot} from 'react-native-app-inspector';
import {DemoApp} from './src/DemoApp';
import {inspectorStorages, seedDemoStorage} from './src/storages';

seedDemoStorage();

function App(): React.JSX.Element {
  return (
    <InspectorRoot
      badgeCorner="bottom-left"
      storage={AsyncStorage}
      storages={inspectorStorages}>
      <DemoApp />
    </InspectorRoot>
  );
}

export default App;
