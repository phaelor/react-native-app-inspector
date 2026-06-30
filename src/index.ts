// Public API. Import from 'react-native-app-inspector', not from subpaths.
//
// This file also wires the react-native-dependent pieces (native metrics,
// device info) into the controller, which keeps `core` runtime-free.

import { AppInspector } from './core';
import { NativeMetricsModule } from './native';
import { getDeviceInfo } from './modules/deviceInfo';

AppInspector.setNativeMetricsProvider(NativeMetricsModule);
AppInspector.setDeviceInfoProvider(getDeviceInfo);

export { AppInspector } from './core';

// Components + state hook
export {
  InspectorPanel,
  InspectorProfiler,
  InspectorScreen,
  useInspectorState,
} from './ui';
export type {
  InspectorPanelProps,
  InspectorProfilerProps,
  InspectorScreenProps,
} from './ui';

// React Navigation integration
export {
  createNavigationTracker,
  getActiveRouteName,
} from './modules/navigation';
export type {
  NavigationTracker,
  NavigationStateLike,
  NavigationRefLike,
} from './modules/navigation';

// Export / sharing
export { exportLogs } from './export';
export { shareLogs } from './export/share';
export type { ExportFormat } from './export';

// Types
export type { InspectorState } from './core';
export type {
  AppInspectorConfig,
  ModuleFlags,
  PersistenceAdapter,
  InspectorSnapshot,
  NetworkLogEntry,
  ActionLogEntry,
  DeviceInfoSnapshot,
  PerformanceSample,
  RenderStat,
  StartupMark,
  StartupTimings,
  ScreenProfile,
  ScreenProblem,
  TimelineEvent,
  TimelineEventType,
  TimelineSeverity,
  TimelineCorrelation,
} from './core/types';
export type { NetworkEventInput } from './modules/timeline';
export type { PersistedSession } from './modules/persistence';
