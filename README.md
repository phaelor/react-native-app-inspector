# react-native-app-inspector

[![CI](https://github.com/phaelor/react-native-app-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/phaelor/react-native-app-inspector/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/react-native-app-inspector.svg)](https://www.npmjs.com/package/react-native-app-inspector)
[![license](https://img.shields.io/npm/l/react-native-app-inspector.svg)](./LICENSE)

> On-device performance & debug panel for React Native — **no Metro, no USB, no computer.**

Ship a debug panel **inside** your QA or staging build. When a tester hits jank
on a release build, on their own phone, three timezones away, they can open the
panel, see what's slow and **why**, and export the session — with zero external
tooling.

<div align="center">
<table>
<tr>
<td align="center"><img src="docs/screenshots/ios-timeline.png" width="200" alt="Timeline with cause correlation"><br><sub><b>Timeline</b> · cause correlation</sub></td>
<td align="center"><img src="docs/screenshots/ios-screens.png" width="200" alt="Per-screen performance scores"><br><sub><b>Screens</b> · 0–100 score</sub></td>
<td align="center"><img src="docs/screenshots/ios-perf.png" width="200" alt="Native FPS, CPU and memory"><br><sub><b>Perf</b> · FPS / CPU / RSS</sub></td>
</tr>
</table>
</div>

## Features

- **Performance Timeline** — one time-ordered log of actions, navigation,
  renders, network, FPS drops, memory and errors, with automatic **cause
  correlation**: tap an FPS drop and it tells you what caused it.
- **Slow Screen detector** — a per-screen profiler that scores every screen
  **0–100** and lists its concrete problems ("why it's slow").
- **Native metrics** — JS + UI-thread FPS, **CPU**, resident memory (RSS), jank
  and JS heap, on iOS & Android.
- **Automatic capture** — `fetch` / `XMLHttpRequest`, uncaught JS errors and
  `console.error` / `warn`, with no code changes.
- **Integrations** — React Navigation tracker, Redux middleware, and session
  persistence (plug in AsyncStorage to survive a crash/relaunch).
- **On-device & exportable** — a tabbed panel you toggle with a prop; export the
  session to JSON or the native share sheet.

## Install

```sh
npm install react-native-app-inspector
```

`react` and `react-native` are the only peer deps — there are no other runtime
dependencies. The native module (UI-FPS, CPU, RSS) autolinks; rebuild once after
installing:

```sh
cd ios && pod install && cd .. && npx react-native run-ios   # or run-android
```

Without a rebuild everything still works in JS — you just won't get the native
metrics.

## Quick start

```tsx
import { useEffect, useState } from 'react';
import { AppInspector, InspectorPanel } from 'react-native-app-inspector';

AppInspector.configure({ enabled: __DEV__ }); // gate to non-production builds

export default function App() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    AppInspector.start();
    return () => AppInspector.stop();
  }, []);

  return (
    <>
      {/* …your app… */}
      <InspectorPanel visible={open} initialTab="timeline" />
    </>
  );
}
```

You decide when to show the panel via `visible` — a header button, a shake, a
hidden multi-tap, your dev menu, anything.

## Recipes

<details>
<summary><b>React Navigation + crash-surviving persistence</b></summary>

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { AppInspector, createNavigationTracker } from 'react-native-app-inspector';

AppInspector.configure({ storage: AsyncStorage }); // last session survives a crash

const navRef = useNavigationContainerRef();
const tracker = createNavigationTracker(navRef);

<NavigationContainer ref={navRef} {...tracker}>
  {/* every screen change is logged and profiled automatically */}
</NavigationContainer>;
```
</details>

<details>
<summary><b>Manual tracking</b></summary>

```ts
AppInspector.trackNavigation('Checkout'); // sets the active screen
AppInspector.trackAction('add_to_cart', { sku: 'A-123' });
AppInspector.trackNetwork({ method: 'POST', url: '/orders', status: 201, durationMs: 840 });

// Redux — log every dispatch:
applyMiddleware(AppInspector.getActionLogger().middleware());
```
</details>

<details>
<summary><b>Profiling a component or a screen</b></summary>

```tsx
import { InspectorProfiler, InspectorScreen } from 'react-native-app-inspector';

// Track one subtree's render cost:
<InspectorProfiler id="ProductList">
  <ProductList />
</InspectorProfiler>;

// Or score a whole screen (when you're not using React Navigation):
<InspectorScreen name="Checkout">
  <Checkout />
</InspectorScreen>;
```
</details>

<details>
<summary><b>Exporting a session</b></summary>

```ts
import { exportLogs, shareLogs } from 'react-native-app-inspector';

const json = exportLogs(); // serialized snapshot string
await shareLogs(); // open the native share sheet
```
</details>

## Example app

[`example/`](example) is a small Todo app wired up for inspection — using it
produces real timeline, screen-score and network data. Run it:

```sh
cd example && npm install && npm run ios   # or npm run android
```

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit (strict)
npm run lint
npm test            # jest (logic + UI)
npm run build       # bob → lib/ (CJS + ESM + types)
```

<details>
<summary>Project structure</summary>

```
src/
  core/        controller, observable store, shared types (no react-native)
  modules/     timeline, performance, screens, render, startup,
               network, actions, errors, navigation, persistence, deviceInfo
  native/      bridge to the iOS/Android native module
  ui/          in-app panel + tabs
  export/      snapshot + serialization
  index.ts     public API
example/       demo Todo app
__tests__/     unit tests (logic + UI)
```
</details>


## License

MIT © [phaelor](https://github.com/phaelor)
