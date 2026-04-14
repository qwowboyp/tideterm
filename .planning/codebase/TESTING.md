# Testing Patterns

**Analysis Date:** 2026-04-14

## Test Framework

**Runner:**

- Vitest `^3.0.9` for frontend tests, configured in `vitest.config.ts` and declared in `package.json`.
- Config: `vitest.config.ts`

**Assertion Library:**

- Vitest built-in `assert`/`test` style in frontend tests, for example `frontend/layout/tests/layoutNode.test.ts`, `frontend/layout/tests/layoutTree.test.ts`, and `frontend/layout/tests/utils.test.ts`.
- Go uses the standard `testing` package with `t.Fatalf`, `t.Errorf`, and `t.Run`, for example `pkg/waveproxy/handler/common_test.go`, `pkg/aiusechat/anthropic/anthropic-backend_test.go`, and `cmd/wsh/cmd/setmeta_test.go`.

**Run Commands:**

```bash
npm test                     # Run Vitest in watch/dev mode from repo root
npm run coverage            # Run Vitest once with Istanbul LCOV coverage output
go test ./pkg/...           # Run Go package tests under `pkg/`
go test ./cmd/wsh/...       # Run Go CLI tests such as `cmd/wsh/cmd/setmeta_test.go`
task package                # Full build/package validation used by CI and TestDriver build workflow
```

## Test File Organization

**Location:**

- Frontend tests are separate but close to the feature area under `frontend/layout/tests/`.
- Go tests are colocated with the packages they validate, using `_test.go`, for example:
  - `pkg/remote/connparse/connparse_test.go`
  - `pkg/waveproxy/handler/common_test.go`
  - `pkg/aiusechat/anthropic/anthropic-backend_test.go`
  - `cmd/wsh/cmd/setmeta_test.go`
- Shell integration tests live under `tests/copytests/` with executable case scripts in `tests/copytests/cases/`.
- UI automation fixtures live under `testdriver/` and are exercised by `.github/workflows/testdriver.yml`.

**Naming:**

- Frontend: `*.test.ts`, for example `layoutNode.test.ts`.
- Go: `*_test.go`, for example `common_test.go` and `connparse_test.go`.
- Shell cases: numbered scripts like `tests/copytests/cases/test000.sh` through `test019.sh`.

**Structure:**

```
frontend/layout/tests/*.test.ts      # Frontend unit tests (Vitest)
pkg/**/_test.go                      # Go unit tests per package
cmd/**/_test.go                      # Go CLI/command tests
tests/copytests/runner.sh            # Shell integration harness
tests/copytests/cases/*.sh           # Shell test cases
testdriver/*.yml                     # TestDriver.ai UI automation flows
```

## Test Structure

**Suite Organization:**

```typescript
import { assert, test } from "vitest";
import { determineDropDirection, reverseFlexDirection } from "../lib/utils";

test("determineDropDirection", () => {
  const dimensions: Dimensions = {
    top: 0,
    left: 0,
    height: 5,
    width: 5,
  };

  assert.equal(determineDropDirection(dimensions, { x: 2.5, y: 1.5 }), DropDirection.Top);
});
```

- This pattern comes directly from `frontend/layout/tests/utils.test.ts`.

**Patterns:**

- Frontend tests are function-level unit tests with direct imports from nearby library code, for example `../lib/layoutNode`, `../lib/layoutTree`, and `../lib/utils` in `frontend/layout/tests/*`.
- Assertions are explicit and verbose; many include a human-readable failure message, especially in `frontend/layout/tests/layoutNode.test.ts`.
- Go tests use both direct test functions and table-driven subtests. `cmd/wsh/cmd/setmeta_test.go` is the clearest reference for `tests := []struct{...}` plus `t.Run(tt.name, ...)`.
- Some Go tests use `t.Parallel()` when the code is safe for concurrent execution, for example `pkg/remote/connparse/connparse_test.go`.

## Mocking

**Framework:** Minimal mocking; direct function calls dominate.

**Patterns:**

```typescript
import { assert, test } from "vitest";
import { newLayoutNode } from "../lib/layoutNode";
import { computeMoveNode, moveNode } from "../lib/layoutTree";

test("layoutTreeStateReducer - compute move", () => {
  let treeState = newLayoutTreeState(newLayoutNode(undefined, undefined, undefined, { blockId: "root" }));
  const pendingAction = computeMoveNode(treeState, {
    type: LayoutTreeActionType.ComputeMove,
    nodeId: treeState.rootNode.id,
    nodeToMoveId: node1.id,
    direction: DropDirection.Bottom,
  });
  moveNode(treeState, pendingAction as LayoutTreeMoveNodeAction);
});
```

- The layout tests in `frontend/layout/tests/layoutTree.test.ts` favor pure-state setup over framework mocking.

```go
func TestCopyHeadersForUpstreamRequestFiltersAcceptEncoding(t *testing.T) {
	src := http.Header{}
	src.Set("Accept-Encoding", "gzip, deflate, br")
	dst := http.Header{}
	copyHeadersForUpstreamRequest(dst, src)
	if dst.Get("Accept-Encoding") != "" {
		t.Fatalf("expected Accept-Encoding to be filtered, got %q", dst.Get("Accept-Encoding"))
	}
}
```

- `pkg/waveproxy/handler/common_test.go` shows the Go pattern: build real inputs, call the real helper, assert output.

**What to Mock:**

- Prefer mocking only when crossing unstable external boundaries such as Electron APIs, RPC, remote hosts, or browser-only integrations.
- There is no evidence of a shared repo-wide Vitest mock harness for frontend unit tests; add one only when the touched area truly requires it.

**What NOT to Mock:**

- Do not mock pure layout/state helpers under `frontend/layout/lib/`; existing tests exercise them directly.
- Do not mock parsing helpers or header transformation functions when a real in-memory input object is cheap, as shown in `cmd/wsh/cmd/setmeta_test.go` and `pkg/waveproxy/handler/common_test.go`.

## Fixtures and Factories

**Test Data:**

```typescript
export function newLayoutTreeState(rootNode: LayoutNode): LayoutTreeState {
  return {
    rootNode,
    pendingBackendActions: [],
  };
}
```

- Shared frontend test fixture helper lives in `frontend/layout/tests/model.ts`.

```go
tests := []struct {
	name    string
	input   []string
	want    map[string]any
	wantErr bool
}{
	{
		name:  "basic types",
		input: []string{"str=hello", "num=42", "float=3.14", "bool=true", "null=null"},
	},
}
```

- Table-driven fixtures are the main Go data-factory style in `cmd/wsh/cmd/setmeta_test.go`.

**Location:**

- Frontend helpers: `frontend/layout/tests/model.ts`
- Shell fixture setup/cleanup: `tests/copytests/testutil.sh`
- UI automation scenario data: `testdriver/onboarding.yml`

## Coverage

**Requirements:** No enforced numeric threshold detected.

- `vitest.config.ts` enables Istanbul coverage with LCOV output and writes reports to `./coverage`.
- `vitest.config.ts` also emits JUnit XML to `test-results.xml`.
- There is no `coverageThreshold` block in `vitest.config.ts` and no CI rule found that rejects a low percentage.

**View Coverage:**

```bash
npm run coverage
```

## Test Types

**Unit Tests:**

- Frontend unit tests currently center on the layout engine in `frontend/layout/tests/`.
- Go unit tests cover utility/parsing/handler packages spread across `pkg/` and `cmd/wsh/`, including:
  - `pkg/remote/connparse/connparse_test.go`
  - `pkg/waveproxy/handler/common_test.go`
  - `pkg/aiusechat/anthropic/anthropic-backend_test.go`
  - `cmd/wsh/cmd/setmeta_test.go`

**Integration Tests:**

- Shell-based integration harness exists in `tests/copytests/`.
- `tests/copytests/runner.sh` iterates over `tests/copytests/cases/*.sh`, runs `setup_testcp`, executes each case, and prints per-case PASS/FAIL.
- `tests/copytests/testutil.sh` provisions a disposable `~/testcp` directory and cleans it afterward.
- These tests validate copy/file-operation style behavior through scripts rather than a language-specific test runner.

**E2E Tests:**

- TestDriver.ai is used for Windows UI automation through:
  - `.github/workflows/testdriver-build.yml`
  - `.github/workflows/testdriver.yml`
  - `testdriver/onboarding.yml`
- Current discovered flow is onboarding smoke coverage: click “Continue”, click “Get Started”, then assert the CPU usage graph is displayed.
- No Playwright/Cypress browser E2E suite was detected for the main app.

## Available Automated Checks

**Frontend checks:**

- `npm test` from `package.json` runs Vitest.
- `npm run coverage` from `package.json` runs `vitest run --coverage`.
- `vitest.config.ts` also enables `typecheck.tsconfig = "tsconfig.json"`, so Vitest can typecheck against root TS config during test runs.
- LSP diagnostics are clean for `frontend/`, `frontend/app/aipanel/aipanelinput.tsx`, and `emain/` in the current workspace snapshot.

**Go checks:**

- `go test ./pkg/...` is the documented package-test command in `AGENTS.md`.
- `go test ./cmd/wsh/...` is practical and supported by live `_test.go` files under `cmd/wsh/cmd/`.
- `.golangci.yml` and `staticcheck.conf` define lint/static-analysis behavior, even though no dedicated `task lint` target was found in `Taskfile.yml`.

**Build checks:**

- `task package` is the strongest repo-native integrated build verification path and is used by `.github/workflows/testdriver-build.yml` before UI automation.
- `task build:backend` validates Go server + `wsh` build output.
- `task build:frontend:dev` validates renderer/main bundling in development mode.
- `task generate` validates schema/code generation paths required before some backend builds.

## What Each Command Validates

**`task init`**

- Installs root npm dependencies, runs `go mod tidy`, and installs docs dependencies via `cd docs && npm install` as defined in `Taskfile.yml:424-429`.

**`task dev`**

- Builds backend dependencies and starts Electron/Vite hot reload. Good for iterative manual verification of renderer changes and startup integration.

**`task start`**

- Runs the standalone app path without dev-server hot reload. Useful when reproducing issues that only appear outside Vite dev flow.

**`npm test`**

- Executes frontend Vitest suites, currently concentrated in `frontend/layout/tests/`.

**`npm run coverage`**

- Executes the same frontend tests with Istanbul coverage and LCOV report generation into `coverage/`.

**`go test ./pkg/...`**

- Validates Go packages under `pkg/`, including parsing, handler, AI, and utility logic.

**`go test ./cmd/wsh/...`**

- Validates CLI-specific helper behavior such as metadata parsing in `cmd/wsh/cmd/setmeta_test.go`.

**`task package`**

- Sequentially cleans, installs deps, builds backend, builds tsunami scaffold, and runs `npm run build:prod` plus `electron-builder` packaging as defined in `Taskfile.yml:97-107`.
- This is the CI-grade end-to-end build check used by `.github/workflows/testdriver-build.yml` before uploading a Windows executable.

## LSP / Build / Test Expectations

**LSP expectation:**

- Treat clean LSP diagnostics as the minimum fast acceptance gate before claiming code is ready.
- Current diagnostics snapshot shows zero diagnostics for `X:\Projects\tideterm\frontend`, `X:\Projects\tideterm\emain`, and `X:\Projects\tideterm\frontend\app\aipanel\aipanelinput.tsx`.

**Build expectation:**

- Use `task` targets, not ad-hoc local build scripts.
- For renderer-only changes, `task dev` plus clean frontend LSP is the fastest discipline.
- For Electron/main-process, backend, packaging, or cross-layer changes, prefer escalating to `task build:backend`, `task build:frontend:dev`, or `task package` depending on touched scope.

**Test expectation:**

- Run existing tests in the touched subsystem when present.
- Do not invent test coverage claims for areas with no automated tests.
- If touching layout logic, run `npm test` because the strongest frontend automated coverage is in `frontend/layout/tests/`.
- If touching Go utilities/handlers/CLI parsing, run the relevant `go test` package path(s).

## Manual Verification Hotspots

**Hot-reload limitations:**

- `CONTRIBUTING.md` says `task dev` hot reload is reliable for most frontend styling/simple component changes.
- Changes affecting Jotai or layout state may put the frontend into a bad state; use `Cmd:Shift:R` / `Ctrl:Shift:R` to force reload.
- `emain/`, `cmd/server`, and `cmd/wsh` changes do not hot-reload; restart the dev instance manually.

**High-risk manual areas:**

- Layout and focus behavior under `frontend/layout/` and `frontend/app/` because the repo has architecture notes about layout state ownership and focus synchronization in `aiprompts/layout-simplification.md`.
- Terminal/connection flows under `frontend/app/view/term/` because `TermViewModel` coordinates connections, multi-session state, shell process state, and VDOM mode switching.
- Electron IPC and bootstrap flows spanning `frontend/wave.ts`, `frontend/app/app.tsx`, and `emain/` because these cross renderer/main boundaries.
- Remote connection and `wsh` setup flows described in `README.md` because route self-heal, tmux resume, and remote helper installation are operationally sensitive.
- Secrets UI and storage behavior tied to `docs/docs/secrets.mdx`; verify no plaintext leakage in logs/config paths.

**Documented manual smoke path:**

- `testdriver/onboarding.yml` defines a concrete onboarding smoke test:
  1. click “Continue”
  2. click “Get Started”
  3. assert the CPU usage graph is displayed

## Common Patterns

**Async Testing:**

```go
func TestConvertPartsToAnthropicBlocks_TextOnly(t *testing.T) {
	parts := []uctypes.UIMessagePart{{Type: "text", Text: "Hello world"}}
	blocks, err := convertPartsToAnthropicBlocks(parts, "user")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- Go tests use direct error-checking on returned values, as seen in `pkg/aiusechat/anthropic/anthropic-backend_test.go` and `pkg/remote/connparse/connparse_test.go`.

**Error Testing:**

```typescript
assert.throws(
  () => newLayoutNode(FlexDirection.Column),
  "Invalid node",
  undefined,
  "calls to the constructor without data or children should fail"
);
```

- This is the frontend error-case pattern in `frontend/layout/tests/layoutNode.test.ts`.

```go
if (err != nil) != tt.wantErr {
	t.Errorf("parseMetaValue() error = %v, wantErr %v", err, tt.wantErr)
	return
}
```

- This is the Go table-driven error expectation pattern from `cmd/wsh/cmd/setmeta_test.go`.

---

_Testing analysis: 2026-04-14_
