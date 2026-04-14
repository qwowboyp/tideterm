# Coding Conventions

**Analysis Date:** 2026-04-14

## Naming Patterns

**Files:**

- TypeScript/TSX modules use kebab-case filenames in feature folders, for example `frontend/app/view/term/term-model.ts`, `frontend/app/aipanel/aipanelinput.tsx`, and `emain/emain-window.ts`.
- Go source follows package-oriented lowercase names with hyphen or suffix separation where needed, for example `cmd/server/main-server.go`, `pkg/remote/connparse/connparse_test.go`, and `pkg/waveproxy/handler/common_test.go`.
- Test files stay next to the area they validate and use `.test.ts` or `_test.go`, for example `frontend/layout/tests/layoutNode.test.ts` and `cmd/wsh/cmd/setmeta_test.go`.

**Functions:**

- TypeScript functions and methods use camelCase, for example `updateZoomFactor()` in `frontend/wave.ts`, `handleContextMenu()` in `frontend/app/app.tsx`, and `checkKeyPressed()` in `frontend/util/keyutil.ts`.
- React components use PascalCase, for example `App`, `AIPanelInput`, and `TerminalView` in `frontend/app/**`.
- Go exported functions use PascalCase and unexported helpers use camelCase/lowercase, for example `ParseURI()` in `pkg/remote/connparse` and `copyHeadersForUpstreamRequest()` in `pkg/waveproxy/handler/common.go` as exercised by `pkg/waveproxy/handler/common_test.go`.

**Variables:**

- Local variables use camelCase in TypeScript, for example `savedInitOpts`, `globalInitOpts`, `clipboardURL`, and `firstRenderPromise` in `frontend/wave.ts` and `frontend/app/app.tsx`.
- Constant values are usually PascalCase or descriptive camelCase depending on scope, for example `DefaultTermTheme` in `frontend/app/view/term/term-model.ts` and `KeyTypeCodeRegex` in `frontend/util/keyutil.ts`.
- Go table-driven tests prefer short names like `tt`, `got`, `want`, and `wantErr`, as seen in `cmd/wsh/cmd/setmeta_test.go`.

**Types:**

- Type/interface aliases use PascalCase, for example `WaveInitOpts`, `LayoutTreeState`, `AIPanelInputProps`, and `ViewModel`.
- Atom references are named with `Atom` suffix, for example `activeTabIdAtom` in `frontend/wave.ts`, `windowDataAtom` in `frontend/app/store/global-model.ts`, and `termThemeNameAtom` in `frontend/app/view/term/term-model.ts`.

## Code Style

**Formatting:**

- Use EditorConfig from `.editorconfig` as the baseline formatter contract.
- Use Prettier from `prettier.config.cjs` for JS/TS formatting.
- Key settings from `prettier.config.cjs`:
  - `printWidth: 120`
  - `trailingComma: "es5"`
  - `useTabs: false`
  - `prettier-plugin-jsdoc`
  - `prettier-plugin-organize-imports`
- Key settings from `.editorconfig`:
  - LF line endings for all files (`end_of_line = lf`)
  - final newline enabled except `CNAME`
  - UTF-8 for `*.{js,jsx,ts,tsx,cjs,json,yml,yaml,css,less,scss}`
  - 4-space indentation for TS/JS/SCSS/JSON/YAML-family files
- Follow the project note in `frontend/app/app.tsx`: keep `frontend/app/app.scss` imported before `frontend/tailwindsetup.css`, because Prettier organize-imports can reorder imports if the intentional blank line is removed.

**Linting:**

- TypeScript linting is configured in `eslint.config.js` with `@eslint/js`, `typescript-eslint`, and `eslint-config-prettier`.
- Treat ESLint as baseline correctness and Prettier-compatibility enforcement; there is no custom rule-heavy style layer in `eslint.config.js`.
- Go linting is governed by `.golangci.yml` and `staticcheck.conf`:
  - `.golangci.yml` disables `unused`
  - `staticcheck.conf` enables `all` checks except `ST1005`, `QF1003`, `ST1000`, `ST1003`, `ST1020`, `ST1021`, and `ST1022`
- TypeScript compiler settings in `tsconfig.json` are intentionally loose by project policy:
  - `strict: false`
  - `noEmit: true`
  - `moduleResolution: "bundler"`
  - `allowJs: true`
- Do not "improve" this repo by enabling strict mode or adding strict-only patterns; `AGENTS.md` explicitly says TypeScript strict mode stays off.

## Import Organization

**Order:**

1. Internal alias imports via `@/...`, for example `import { App } from "@/app/app";` in `frontend/wave.ts`
2. Relative imports for nearby files, for example `import { addChildAt } from "../lib/layoutNode";` in `frontend/layout/tests/layoutNode.test.ts`
3. Third-party packages, for example `react`, `react-dom/client`, `jotai`, `vitest`, and Node/Go standard library equivalents in each language area

**Path Aliases:**

- Use aliases from `tsconfig.json` instead of long relative traversals when code crosses frontend areas:
  - `@/app/*` → `frontend/app/*`
  - `@/builder/*` → `frontend/builder/*`
  - `@/util/*` → `frontend/util/*`
  - `@/layout/*` → `frontend/layout/*`
  - `@/store/*` → `frontend/app/store/*`
  - `@/view/*` → `frontend/app/view/*`
  - `@/element/*` → `frontend/app/element/*`
  - `@/shadcn/*` → `frontend/app/shadcn/*`
- Executor guidance: when adding frontend code under `frontend/`, prefer these aliases to maintain consistency with `frontend/wave.ts`, `frontend/app/app.tsx`, and `frontend/app/view/term/term-model.ts`.

## Error Handling

**Patterns:**

- Wrap async initialization boundaries in `try/catch/finally`, log through both browser console and app bridge, and always restore UI state. Example: `initWaveWrap()` in `frontend/wave.ts` catches errors, calls `getApi().sendLog(...)`, logs with `console.error(...)`, and resets document visibility in `finally`.
- Return `null` for non-fatal UI capability checks instead of throwing, for example `getClipboardURL()` in `frontend/app/app.tsx`.
- In Go tests, fail fast with `t.Fatalf(...)` for setup/contract violations and `t.Errorf(...)` for value mismatches that can continue, as shown in `pkg/waveproxy/handler/common_test.go`, `pkg/aiusechat/anthropic/anthropic-backend_test.go`, and `cmd/wsh/cmd/setmeta_test.go`.
- Shell test harnesses return non-zero and print captured stderr/stdout. `tests/copytests/runner.sh` captures command output and prints the failing case script body for diagnosis.

## Logging

**Framework:** debug + console in frontend/Electron, direct test logging in Go and shell.

**Patterns:**

- Frontend bootstrap uses `console.log(...)`, `console.error(...)`, and `getApi().sendLog(...)` in `frontend/wave.ts`.
- UI modules use `debug(...)` namespaces when structured local diagnostics are useful, for example `const dlog = debug("wave:app")` and `const focusLog = debug("wave:focus")` in `frontend/app/app.tsx`.
- Use explicit status text and icon state instead of silent failures in view models, for example `TermViewModel` in `frontend/app/view/term/term-model.ts` exposes status through atoms and header controls.
- Do not echo sensitive file contents into AI/tool chats; `AGENTS.md` marks this as a project anti-pattern tied to `pkg/aiusechat/usechat-prompts.go`.

## Comments

**When to Comment:**

- Keep copyright/SPDX headers at file top for source files, as seen across `frontend/wave.ts`, `frontend/layout/tests/*.ts`, and many Go files.
- Add comments when code depends on non-obvious tool behavior or UI behavior. Examples:
  - `frontend/app/app.tsx` documents the import-order requirement for Tailwind setup.
  - `frontend/wave.ts` documents the no-hover flicker workaround during reinit.
  - `frontend/util/keyutil.ts` documents uppercase key normalization and Space-key handling.
- Avoid narrating obvious code paths; most files prefer sparse, targeted comments.

**JSDoc/TSDoc:**

- Prettier is configured with `prettier-plugin-jsdoc`, but live TypeScript files are not heavily JSDoc-driven.
- Prefer clear naming and focused inline comments over adding noisy docblocks to every TS helper.
- Markdown and architecture guidance in `aiprompts/newview.md` act as the stronger convention source for frontend patterns.

## Function Design

**Size:**

- Large orchestration functions are acceptable at application boundaries, for example `initWave()` in `frontend/wave.ts`, when they coordinate startup flows.
- Feature logic tends to move into model classes and atoms instead of bloating React render bodies, for example `TermViewModel` in `frontend/app/view/term/term-model.ts`.

**Parameters:**

- Pass explicit typed objects for cross-layer coordination, such as `GlobalInitOptions` in `frontend/app/store/global-model.ts` and `WaveKeyboardEvent` in `frontend/util/keyutil.ts`.
- Tests use table-driven input structs in Go when validating multiple parsing cases, as shown in `cmd/wsh/cmd/setmeta_test.go`.

**Return Values:**

- UI/key handlers often return boolean to indicate whether the event was handled, for example `keydownWrapper(...)` and `checkKeyPressed(...)` patterns in `frontend/util/keyutil.ts`.
- Helper functions return `null` for unavailable optional values in frontend code instead of throwing, for example `getClipboardURL()` in `frontend/app/app.tsx`.
- Go parsing and conversion helpers use idiomatic `(value, error)` returns, validated in tests like `pkg/remote/connparse/connparse_test.go` and `pkg/aiusechat/anthropic/anthropic-backend_test.go`.

## Module Design

**Exports:**

- Prefer one main class/component/function per feature file with named exports, for example `export class TermViewModel` in `frontend/app/view/term/term-model.ts` and `export const AIPanelInput` in `frontend/app/aipanel/aipanelinput.tsx`.
- Keep singleton-style app coordinators explicit, for example `GlobalModel.getInstance()` in `frontend/app/store/global-model.ts`.

**Barrel Files:**

- Barrel usage is limited; direct file imports are common. Follow the existing local explicit-import style unless an area already exposes an index module, such as layout access through `@/layout/index` in `frontend/wave.ts`.

## Architectural Rules

**Model/View split:**

- Follow the model-view architecture documented in `aiprompts/newview.md`.
- Put state, derived atoms, RPC wiring, and view header configuration into a ViewModel class under `frontend/app/view/*/*-model.ts`.
- Keep React components focused on rendering and hook usage, for example `frontend/app/aipanel/aipanelinput.tsx` consumes atoms while `frontend/app/view/term/term-model.ts` owns behavior.

**State management:**

- Use Jotai atoms as the state contract for frontend runtime behavior.
- In non-React contexts, use `globalStore.get()` / `globalStore.set()`; do not call React hooks inside model methods. This rule is stated in `AGENTS.md` and demonstrated by `aiprompts/newview.md`.
- Preserve `Atom` suffix naming for atom-bearing fields and helpers.

**Block architecture:**

- Everything user-facing is a block-oriented feature. New frontend views belong under `frontend/app/view/` and integrate with block metadata and header APIs.
- Respect block metadata keys and connection semantics already used in `frontend/app/view/term/term-model.ts` and `frontend/app/app.tsx`.

**Frontend/backend ownership:**

- `aiprompts/layout-simplification.md` and `AGENTS.md` define frontend-owned layout fields: backend must not directly own `RootNode`, `FocusedNodeId`, or `MagnifiedNodeId` persistence semantics.
- Keep Electron/main-process logic in `emain/`, renderer logic in `frontend/`, Go backend in `cmd/server` + `pkg/`, and CLI/remote helper logic in `cmd/wsh`.

## Anti-Patterns

**Project-specific anti-patterns from `AGENTS.md`:**

- Do not export `currentValueAtom` for state setting; stale-state issues are associated with `frontend/util/util.ts`.
- Never use React hooks inside model methods; read/write through `globalStore` instead.
- Backend must not take ownership of layout-only fields `RootNode`, `FocusedNodeId`, and `MagnifiedNodeId`.
- Do not hardcode event types; source them from event-bus definitions.
- Do not store secrets in plaintext; follow `docs/docs/secrets.mdx` and use encrypted secret storage semantics.
- Do not echo file contents back through AI tool-call flows unless explicitly requested.

**Live-code anti-pattern still present and worth avoiding in new code:**

- Avoid adding new `as any` casts. `AGENTS.md` says not to use `as any` / `@ts-ignore`; there is still legacy usage such as `onSubmit(e as any);` in `frontend/app/aipanel/aipanelinput.tsx`, which should not be copied into new work.
- Avoid putting logic in render-time JSX that should live in atoms/model classes. Existing code keeps business logic mostly outside render bodies.

## Branch / Workflow Constraints

**Contribution workflow:**

- `CONTRIBUTING.md` requires feature work on a branch; do not work directly on `main`.
- For major work, open or reference an issue first.
- For anything beyond minor fixes, submit tests and documentation together.

**Build workflow:**

- Use `task` commands from `Taskfile.yml`; do not introduce Make-based instructions.
- Core setup/build commands used by this repo:
  - `task init`
  - `task dev`
  - `task start`
  - `task build:backend`
  - `task build:frontend:dev`
  - `task package`
  - `task generate`
- Frontend hot reload applies during `task dev`, but `CONTRIBUTING.md` notes that `emain/`, `cmd/server/`, and `cmd/wsh/` do not hot-reload and must be restarted manually.

## Project-Specific Implementation Rules

**Frontend:**

- Keep renderer entry at `frontend/wave.ts`; do not create a new `src/index.tsx` style entrypoint.
- Keep Electron main-process code in `emain/`; use the `getApi()` bridge and the preload/custom type contract described in `CONTRIBUTING.md`.
- Use path aliases from `tsconfig.json` and 4-space indentation from `.editorconfig`.
- Keep TypeScript compatible with `strict: false`; do not add strict-only annotations that ripple through unrelated files.

**Go/backend:**

- Keep server entry under `cmd/server/main-server.go` and business logic in `pkg/`.
- Expect linting through `.golangci.yml` and `staticcheck.conf`; do not assume `unused` failures are enforced here.

**Secrets and config:**

- Never place credentials in plaintext config or logs. `docs/docs/secrets.mdx` defines encrypted OS-keychain-backed secret handling.
- TideTerm-specific config/data environment variables use the `TIDETERM_*` prefix as documented in `AGENTS.md` and `README.md`.

**Verification expectation before claiming completion:**

- Minimum lightweight validation standard for frontend changes in this repo is clean LSP diagnostics; current scans of `frontend/`, `frontend/app/aipanel/aipanelinput.tsx`, and `emain/` report zero diagnostics.
- Use existing automated checks where the touched area supports them instead of inventing new ones.

---

_Convention analysis: 2026-04-14_
