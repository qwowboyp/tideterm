# Codebase Structure

**Analysis Date:** 2026-04-14

## Directory Layout

```text
tideterm/
├── cmd/                # Go entrypoints for wavesrv, wsh, generators, and internal test binaries
├── pkg/                # Core Go packages: services, RPC, remote, AI, config, persistence, proxy
├── emain/              # Electron main-process, preload, window, IPC, updater, wavesrv launcher
├── frontend/           # Main renderer app: React UI, block views, stores, layout engine, utilities
├── tsunami/            # Separate Go + frontend module for WaveApp/Tsunami sandbox and builder runtime
├── db/                 # SQLite migrations and database evolution assets
├── schema/             # Generated config/schema assets copied into builds
├── build/              # Packaging/build helpers and assets
├── docs/               # Docusaurus docs workspace
├── tests/              # Shell-style integration test assets (`tests/copytests/`)
├── testdriver/         # TestDriver AI fixtures such as `testdriver/onboarding.yml`
├── aiprompts/          # Prompt/reference markdown used to document or guide AI-related systems
├── public/             # Static assets loaded by the Electron renderer
├── assets/             # Branding/source image assets
└── .planning/codebase/ # Generated codebase mapping documents for future planning/execution
```

## Directory Purposes

**`cmd/`:**

- Purpose: top-level Go programs.
- Contains: `cmd/server/main-server.go`, `cmd/wsh/main-wsh.go`, schema/type generators, test executables.
- Key files: `cmd/server/main-server.go`, `cmd/wsh/main-wsh.go`

**`pkg/`:**

- Purpose: shared backend application logic.
- Contains: services, object models, persistence, web server, event bus, remote connection controllers, AI, MCP, proxy, config watchers.
- Key files: `pkg/service/service.go`, `pkg/web/web.go`, `pkg/web/ws.go`, `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `pkg/aiusechat/usechat.go`, `pkg/waveproxy/proxy.go`, `pkg/mcpconfig/service.go`

**`emain/`:**

- Purpose: Electron main process and preload layer.
- Contains: app startup, native window management, IPC handlers, wavesrv launcher, builder windows, updater integration.
- Key files: `emain/emain.ts`, `emain/preload.ts`, `emain/emain-ipc.ts`, `emain/emain-window.ts`, `emain/emain-wavesrv.ts`

**`frontend/`:**

- Purpose: main renderer application.
- Contains: React components, Jotai stores, block views, builder UI, layout engine, utility code, shared types.
- Key files: `frontend/wave.ts`, `frontend/app/app.tsx`, `frontend/app/store/global.ts`, `frontend/app/store/wshrpcutil.ts`, `frontend/app/store/wshrouter.ts`

**`frontend/app/view/`:**

- Purpose: block/view implementations.
- Contains: term, preview, webview, code editor, AI, proxy, config, help, tsunami, vdom views.
- Key files: `frontend/app/view/term/term.tsx`, `frontend/app/view/proxy/proxy.tsx`, `frontend/app/view/waveconfig/mcpcontent.tsx`

**`frontend/app/aipanel/`:**

- Purpose: AI chat and tool-use UI.
- Contains: message rendering, input, rate limit strip, feedback, tool-use UI, focus helpers.
- Key files: `frontend/app/aipanel/aipanel.tsx`, `frontend/app/aipanel/waveai-model.tsx`

**`frontend/layout/`:**

- Purpose: layout engine for pane and block placement.
- Contains: layout model exports, shared layout types, dedicated layout tests.
- Key files: `frontend/layout/index.ts`, `frontend/layout/lib/`, `frontend/layout/tests/`

**`tsunami/`:**

- Purpose: separate module for WaveApp/Tsunami runtime and builder support.
- Contains: Go engine, frontend app, templates, RPC types, UI/runtime helpers.
- Key files: `tsunami/go.mod`, `tsunami/frontend/`, `tsunami/engine/`, `tsunami/cmd/`

**`db/`:**

- Purpose: database schema migration assets.
- Contains: migration folders for TideTerm stores.
- Key files: `db/` subdirectories used by backend database initialization.

**`docs/`:**

- Purpose: documentation site workspace.
- Contains: Docusaurus app and published docs source.
- Key files: `docs/package.json`, `docs/docs/`

**`tests/`:**

- Purpose: non-unit automated verification assets.
- Contains: `tests/copytests/`
- Key files: `tests/copytests/`

## Key File Locations

**Entry Points:**

- `emain/emain.ts`: Electron main process entry and application bootstrap.
- `frontend/wave.ts`: renderer bootstrap for both normal windows and builder windows.
- `cmd/server/main-server.go`: Go backend server entry.
- `cmd/wsh/main-wsh.go`: CLI and remote helper entry.

**Configuration:**

- `package.json`: npm scripts, workspaces, Electron/Vite toolchain deps.
- `go.mod`: backend module and core Go dependencies.
- `Taskfile.yml`: canonical dev/build/package commands.
- `tsconfig.json`: frontend/emain TypeScript configuration and path aliases.
- `electron.vite.config.ts`: build graph for main/preload/renderer bundles.
- `eslint.config.js`: linting entrypoint.
- `prettier.config.cjs`: formatting configuration.

**Core Logic:**

- `pkg/service/service.go`: frontend service dispatch.
- `pkg/web/web.go`: HTTP API and file streaming surface.
- `pkg/web/ws.go`: WebSocket + routed RPC registration.
- `pkg/remote/conncontroller/conncontroller.go`: SSH connection orchestration.
- `pkg/wslconn/wslconn.go`: WSL connection orchestration.
- `pkg/aiusechat/usechat.go`: AI chat orchestration/tool execution.
- `pkg/waveproxy/proxy.go`: WaveProxy lifecycle and HTTP route registration.
- `pkg/mcpconfig/service.go`: MCP config persistence and app synchronization.

**Testing:**

- `vitest.config.ts`: frontend/unit test runner config.
- `frontend/layout/tests/`: layout-focused renderer tests.
- `pkg/aiusechat/tools_readdir_test.go`: example backend unit test placement.
- `tests/copytests/`: integration-style test assets.
- `testdriver/onboarding.yml`: TestDriver scenario fixture.

## Subsystem Ownership Boundaries

**Desktop shell boundary:**

- Owns: process startup, native windows, menu, updater, OS integration.
- Files: `emain/`
- Do not move backend business logic here; keep it limited to Electron-only responsibilities.

**Renderer boundary:**

- Owns: user interaction, local reactive state, block rendering, layout interactions.
- Files: `frontend/`
- Do not place persistence, remote transport, or provider secrets logic here.

**Backend boundary:**

- Owns: database, object model mutation, remote execution, config watchers, AI/provider execution, proxy hosting.
- Files: `pkg/`, `cmd/server/`
- Do not introduce renderer-only concepts such as DOM/layout nodes into this layer.

**Remote helper boundary:**

- Owns: command-line control and remote-side `connserver` functionality.
- Files: `cmd/wsh/`, `pkg/wshrpc/`, remote connection packages under `pkg/remote/` and `pkg/wslconn/`
- Treat this as a protocol surface shared by local backend, remote hosts, and CLI invocations.

**Tsunami boundary:**

- Owns: sandboxed app/builder subsystem.
- Files: `tsunami/`, renderer builder entrypaths in `frontend/wave.ts`, Electron builder window support in `emain/emain-builder.ts`
- Keep TideTerm main app code and Tsunami module code separated unless the change is explicitly cross-subsystem.

## Naming Conventions

**Files:**

- Lowercase kebab-case or descriptive lowercase with suffixes: `emain-wavesrv.ts`, `main-server.go`, `mcpcontent.tsx`, `wshrpctypes.go`.
- View implementation folders keep feature names as directory names: `frontend/app/view/term/`, `frontend/app/view/proxy/`, `frontend/app/view/webview/`.

**Directories:**

- Feature-oriented top-level grouping: `pkg/remote/`, `pkg/waveproxy/`, `frontend/app/aipanel/`, `frontend/app/store/`.
- Backend service packages use `*service` names under `pkg/service/`, for example `pkg/service/blockservice/` and `pkg/service/workspaceservice/`.

## Primary Entrypoints by Capability

**Workspace/window/tab lifecycle:**

- Renderer state/UI: `frontend/app/app.tsx`, `frontend/app/workspace/`, `frontend/app/tab/`
- Electron window coordination: `emain/emain-window.ts`, `emain/emain-tabview.ts`
- Backend services: `pkg/service/windowservice/`, `pkg/service/workspaceservice/`, `pkg/service/objectservice/`

**Terminal experience:**

- UI and model: `frontend/app/view/term/term.tsx`, `frontend/app/view/term/term-model.ts`, `frontend/app/view/term/term-wsh.tsx`
- Backend controller path: `pkg/blockcontroller/`, `pkg/service/blockservice/`, `pkg/wshrpc/`
- Remote support: `pkg/remote/`, `pkg/wslconn/`, `cmd/wsh/`

**Remote files / preview / editing:**

- Renderer views: `frontend/app/view/preview/`, `frontend/app/view/codeeditor/`, `frontend/app/view/webview/`
- Backend HTTP/file streaming: `pkg/web/web.go`, `pkg/remote/fileshare/`, `pkg/filestore/`
- Remote transport: `pkg/wshrpc/`, `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`

**AI panel and tool use:**

- Renderer UI: `frontend/app/aipanel/`, `frontend/app/view/waveai/`
- Backend orchestration: `pkg/aiusechat/`, `pkg/waveai/`, `pkg/secretstore/`
- Prompt/reference assets: `aiprompts/`

**MCP server management:**

- Renderer UI: `frontend/app/view/waveconfig/mcpcontent.tsx`
- Backend sync/persistence: `pkg/mcpconfig/service.go`, `pkg/mcpconfig/claude.go`, `pkg/mcpconfig/codex.go`, `pkg/mcpconfig/gemini.go`

**API Proxy:**

- Renderer UI: `frontend/app/view/proxy/proxy.tsx`, `frontend/app/view/proxy/proxy-dock.tsx`
- Backend service: `pkg/waveproxy/proxy.go`, `pkg/waveproxy/channel/`, `pkg/waveproxy/handler/`, `pkg/waveproxy/scheduler/`

**Layout engine:**

- Main model/export surface: `frontend/layout/index.ts`
- Internal layout logic: `frontend/layout/lib/`
- Tests: `frontend/layout/tests/`

## Where to Add New Code

**New Feature:**

- Primary code: put renderer-visible product UI in the closest feature folder under `frontend/app/` or `frontend/app/view/`; put backend logic in the corresponding `pkg/` subsystem.
- Tests: put frontend tests near the subsystem or in its `tests/` folder (for example `frontend/layout/tests/`); put Go tests next to the Go package as `*_test.go`.

**New Component/Module:**

- Implementation: add new block/view UIs under `frontend/app/view/{feature}/` when the feature is a block, or under `frontend/app/{feature}/` when it is part of shared application chrome.

**Utilities:**

- Shared frontend helpers: `frontend/util/` or feature-local utility files.
- Shared renderer state helpers: `frontend/app/store/`.
- Shared backend helpers: an appropriate package under `pkg/util/`, `pkg/wshutil/`, or the owning subsystem package.

**New backend service callable from renderer:**

- Add Go method in the relevant package under `pkg/service/`.
- Ensure it is reachable from `pkg/service/service.go`.
- Regenerate/update wrappers so `frontend/app/store/services.ts` stays aligned.

**New routed RPC command:**

- Define command/types in `pkg/wshrpc/wshrpctypes.go`.
- Implement handling in the relevant server/client package under `pkg/wshrpc/`.
- Wire renderer callers through `frontend/app/store/wshclientapi` / `frontend/app/store/wshrpcutil.ts` as needed.

## High-Signal File Areas for Common Work

**Need to understand startup:**

- `emain/emain.ts`
- `emain/emain-wavesrv.ts`
- `cmd/server/main-server.go`
- `frontend/wave.ts`

**Need to understand frontend state:**

- `frontend/app/store/global.ts`
- `frontend/app/store/global-model.ts`
- `frontend/app/store/wshrpcutil.ts`
- `frontend/app/store/wshrouter.ts`

**Need to understand renderer/backend contracts:**

- `frontend/app/store/services.ts`
- `pkg/service/service.go`
- `pkg/web/web.go`
- `pkg/web/ws.go`
- `pkg/wshrpc/wshrpctypes.go`

**Need to understand remote workflows:**

- `pkg/remote/conncontroller/conncontroller.go`
- `pkg/wslconn/wslconn.go`
- `pkg/wshrpc/wshserver/tmux.go`
- `cmd/wsh/`

**Need to understand AI/proxy/MCP:**

- `pkg/aiusechat/usechat.go`
- `pkg/waveai/waveai.go`
- `pkg/waveproxy/proxy.go`
- `pkg/mcpconfig/service.go`
- `frontend/app/aipanel/`
- `frontend/app/view/proxy/proxy.tsx`
- `frontend/app/view/waveconfig/mcpcontent.tsx`

## Special Directories

**`dist/`:**

- Purpose: build output for main/preload/frontend and packaged artifacts.
- Generated: Yes.
- Committed: No.

**`make/`:**

- Purpose: packaging output such as unpacked builds.
- Generated: Yes.
- Committed: No.

**`schema/`:**

- Purpose: generated/copied schema assets consumed by build/runtime.
- Generated: Yes.
- Committed: Yes.

**`docs/`:**

- Purpose: documentation workspace with its own npm package.
- Generated: No for source, Yes for `docs/build/` outputs.
- Committed: Source yes; generated build output depends on workflow.

**`tsunami/`:**

- Purpose: separate module with independent `go.mod` and frontend workspace.
- Generated: No.
- Committed: Yes.

**`.planning/codebase/`:**

- Purpose: generated architecture/structure/convention/testing/concerns references for GSD planning.
- Generated: Yes.
- Committed: Yes.

---

_Structure analysis: 2026-04-14_
