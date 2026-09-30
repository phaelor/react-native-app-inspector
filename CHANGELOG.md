# Changelog

## 0.3.0 — 2026-09-29

### Added

- **Request and response bodies** in the network log, with the panel showing
  them formatted and a cURL you can copy. Controlled by the new `network`
  prop on `InspectorRoot`: `{ captureBodies, maxBodyBytes, captureHeaders }`.
- **Request and response headers**, with `Authorization`, `Cookie` and the
  like replaced by `[redacted]`.
- **Frozen-frame detection.** A gap of 700 ms or more between frames is
  reported as an error on the timeline and costs the screen 20 points of its
  quality score.
- **New Architecture support.** The native module is now a TurboModule,
  generated from a codegen spec, on both platforms. The legacy bridge keeps
  working, so `react-native >= 0.72` is still supported; the New Architecture
  path needs 0.74 or newer.
- **Automatic tap capture in release builds.** Production React never calls
  `Profiler.onRender`, which is what reported the commit a tap was waiting
  for, so every auto-captured tap used to be dropped. Import the package at
  the top of your entry file (`import 'react-native-app-inspector';` in
  `index.js`) to get the exact measurement; otherwise a tap ends at the first
  frame presented after its work. Per-component render statistics still need
  the profiler and stay development-only.

### Fixed

- iOS request bodies are read before the upload starts. They were read after
  completion, by which point the stream was consumed, so the body was
  practically always empty.
- Android native network capture works again on recent React Native.
  `OkHttpClientProvider`'s private factory field was renamed when it was
  rewritten in Kotlin, so the interceptor silently fell back to the JS patch.
- Secrets are matched by exact key instead of substring. `pin` no longer
  redacts `shipping`, and `Access-Control-Allow-Credentials` is left alone.
- Secret query parameters are redacted in headers whose value is a URL
  (`Location`, `Content-Location`, `Referer`). A server echoing the request
  URL back leaked keys that had already been removed from the entry's `url`.
- `maxBodyBytes` reaches the native interceptors instead of being capped at a
  hardcoded 32 KB.
- The panel no longer uses React Native's deprecated `SafeAreaView`. It pads
  itself from the window insets reported by the native module, which also
  fixes the header sitting under the status bar on Android with edge-to-edge.
- A long value in a detail row — a request URL, say — wraps in the space left
  over instead of overflowing across its label.
- The FPS badge returns to its edge when the window is resized. After a
  rotation it could end up off-screen, taking the only way into the panel
  with it.

### Internal

- The example app runs React Native 0.87.1 with the New Architecture.
- CI compiles the module against React Native 0.74, 0.76, 0.81 and 0.87, on
  both architectures where the version still supports the legacy one.

## 0.2.2 — 2026-09-12

### Fixed

- iOS network capture no longer replaces the host's
  `RCTSetCustomNSURLSessionConfigurationProvider`. The interceptor now joins
  every default/ephemeral session's `protocolClasses` at load, so it also
  survives a host that registers its own provider (SSL pinning, proxies).
- iOS interceptor reuses one shared `NSURLSession` instead of creating one per
  request, and logs redirect hops with their 3xx status instead of delivering
  the redirect response twice to the client.
- Android: if the OkHttp client factory cannot be read reflectively on some
  React Native version, the native interceptor is left uninstalled (the host's
  factory is never replaced blindly) and JS falls back to the XHR patch via the
  new `networkCaptureAvailable` module constant.
- Android: memory (`Debug.getMemoryInfo`, a binder call) and CPU sampling moved
  off the main thread so the monitor no longer perturbs the UI FPS it measures.
- JS heap is now reported on Hermes (via `HermesInternal.getInstrumentedStats`);
  previously it was always empty because Hermes lacks `performance.memory`.

### Internal

- CI compiles the Android and iOS native modules against the example app.

## 0.2.1 — 2026-07-19

### Fixed

- Tap dedup no longer collapses two distinct taps landing within 32 ms of
  each other — only an auto-captured and an explicit begin of the same touch
  dedup (the explicit label wins, as before).
- `AppInspector.beginInteraction()` called without a touch timestamp (e.g.
  after an `await` inside a press handler) adopts the pending auto-captured
  tap instead of double-counting it, so one tap yields one measurement
  anchored at the actual touch.
- Simultaneous taps (two fingers, two buttons) are now tracked independently:
  the tap detector keys pending touches by `nativeEvent.identifier` instead
  of a single slot that dropped both.

### Added

- `modules.taps` flag — automatic tap capture is now switchable through the
  standard module flags like every other capture module. The
  `autoCaptureTaps` prop on `InspectorRoot` still works; either switch
  disables capture.

## 0.2.0 — 2026-07-13

### Breaking

- **`InspectorPanel` removed.** Wrap the app in `InspectorRoot` instead — it
  starts capture, shows the floating FPS badge and opens the full-screen
  panel on badge tap:

  ```tsx
  // before
  AppInspector.configure({ enabled: __DEV__ });
  // …AppInspector.start() in an effect, <InspectorPanel visible={open} />

  // after
  <InspectorRoot enabled={__DEV__}>
    <App />
  </InspectorRoot>
  ```

  For a custom trigger use `<InspectorModal visible onClose={…} />`
  (a sibling of `InspectorRoot`) with `badge={false}`.

### Added

- **`InspectorRoot`** — single-wrapper integration: config, capture
  lifecycle, badge, panel, root render profiling and (with `navigationRef`)
  automatic React Navigation tracking.
- **Full-screen inspector panel** (`InspectorModal`) with pill tabs, status
  strip, search, per-tab virtualized lists, and a Settings tab
  (pause / share / clear / badge toggle).
- **Draggable FPS badge** (`InspectorFpsBadge`) — live JS/UI FPS, CPU and
  memory; snaps to corners; tap opens the panel.
- **Native network capture** — NSURLProtocol on iOS, OkHttp interceptor on
  Android; falls back to the XHR patch when the native module is absent.
- **Automatic tap capture** (`InspectorTapBoundary`, on by default in
  `InspectorRoot`) — tap→response latency for every pressable with labels
  from `testID` / accessibility label / text; RAIL-coded **Taps** tab with
  avg / worst / slow counts.
- **Storage tab** — browse, search, edit, delete and clear AsyncStorage /
  MMKV / any custom store; `asyncStorageAdapter`, `mmkvAdapter` and the
  `storages` config/prop; auto-derived from `storage` when it exposes
  `getAllKeys`.
- Copy-as-cURL and copy buttons throughout (`clipboard` adapter, with a core
  `Clipboard` fallback).
- `useInspectorState(active?)` — optional flag to pause the subscription.

### Fixed

- Inspector UI rendered inside the profiled subtree no longer feeds its own
  re-renders back into the render stats ("Maximum update depth exceeded");
  the badge subscribes only to the latest performance sample.
- Network tab shows rounded durations for natively captured requests.
- Podspec `:tag` now matches the `v`-prefixed release tags.

## 0.1.0 — 2026-07-01

Initial release: performance timeline with cause correlation, slow-screen
detector (0–100 score), native FPS/CPU/RSS metrics, automatic fetch/XHR and
error capture, React Navigation tracker, Redux middleware, session
persistence and JSON/share-sheet export.
