# Changelog

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
