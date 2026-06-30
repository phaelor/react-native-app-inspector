# Contributing

Bug reports and PRs are welcome.

## Setup

```sh
npm install
```

The library is in `src/`. The demo app in `example/` consumes it from `../src`
via a Metro/Babel alias, so library edits hot-reload there without a rebuild:

```sh
cd example && npm install && npm start   # then `npm run ios` / `npm run android`
```

## Before a PR

```sh
npm run typecheck && npm run lint && npm test
```

Add a test for new logic (`*.test.ts` for pure logic, `*.test.tsx` for
components). Keep `src/core` free of `react-native` imports, and don't add
runtime dependencies. If you touch `ios/` or `android/`, rebuild the example to
check it.
