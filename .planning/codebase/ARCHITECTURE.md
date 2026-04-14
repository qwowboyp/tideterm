# Architecture Overview - TideTerm

## System Overview

TideTerm follows a hybrid architecture combining a Go-based backend (`wavesrv`) with an Electron-based frontend. It is designed around a "Block" architecture where every UI element (terminal, file browser, AI chat) is an independent, draggable block.

## Runtime Boundaries

1.  **Electron Main Process (`emain/`)**: Manages window lifecycle, native menus, and acts as a bridge between the frontend and the Go backend.
2.  **Go Backend (`wavesrv`)**: The core engine. Handles PTY management, remote connections (SSH/WSL), database persistence, AI proxying, and file system operations.
3.  **Frontend Renderer (`frontend/`)**: A React application running in Electron's renderer process. Communicates with the Go backend via RPC over WebSockets/Unix sockets.
4.  **Remote Helper (`wsh`)**: A lightweight Go binary installed on remote hosts to enable advanced features like remote file browsing and terminal resume (via tmux).
5.  **Tsunami Sandbox (`tsunami/`)**: A separate runtime for sandboxed mini-apps that run within TideTerm blocks.

## Directory Structure

- `cmd/`: Entry points for Go binaries (`server`, `wsh`, code generators).
- `pkg/`: Core Go logic (~45 modules).
  - `pkg/wcore/`: Core application logic.
  - `pkg/remote/`: SSH and remote connection management.
  - `pkg/wshrpc/`: RPC protocol definitions.
  - `pkg/waveai/`: AI integration and prompt management.
  - `pkg/wstore/`: SQLite database management.
- `emain/`: Electron main process code (TypeScript).
- `frontend/`: React frontend application.
  - `frontend/app/`: UI components and application logic.
  - `frontend/layout/`: Grid and pane management system.
  - `frontend/store/`: Jotai state atoms.
- `tsunami/`: Sub-module for sandboxed apps.
- `db/`: SQLite migrations and database schema.
- `schema/`: JSON schema definitions for configuration.
- `aiprompts/`: AI prompt templates and architectural documentation.

## Key Architectural Patterns

- **Block-Based UI**: Everything is a block. Blocks are managed by a custom layout engine (`frontend/layout/`).
- **wsh RPC**: A custom RPC protocol facilitates communication between the frontend and the Go backend, supporting both local and remote operations.
- **Hybrid State**: UI state is managed via Jotai in the frontend, while persistent state (connections, history, settings) is stored in SQLite by the Go backend.
- **Remote-First**: Designed to treat remote SSH/WSL connections as first-class citizens, with `wsh` providing local-like performance for remote file operations.
- **AI-Native**: Deep integration of AI throughout the terminal, including a dedicated AI panel, command suggestions, and an AI API proxy (`WaveProxy`).

---

## Detailed Architecture Analysis (Legacy)

**Overall:** Hybrid Electron shell with a Go backend, React renderer, routed RPC/WebSocket messaging, and block-oriented workspace state.

**Key Characteristics:**

- Electron main process in `emain/` owns native window lifecycle, launches `wavesrv`, and bridges privileged APIs to the renderer through preload IPC.
- Go backend in `cmd/server/main-server.go` plus `pkg/` owns persistence, remote connections, object updates, AI execution, proxy services, and WebSocket/HTTP endpoints.
- Renderer in `frontend/wave.ts` and `frontend/app/` initializes Jotai-backed client state, opens a per-tab routed WebSocket, and renders blocks/views based on backend-managed `WaveObj` data.

## Layers

**Electron main process:**

- Purpose: Bootstrap the desktop app, start `wavesrv`, manage `BrowserWindow` and `WebContentsView` state, and expose native capabilities.
- Location: `emain/emain.ts`, `emain/emain-wavesrv.ts`, `emain/emain-window.ts`, `emain/emain-ipc.ts`, `emain/preload.ts`
- Contains: app startup, process supervision, IPC handlers, window/tab view orchestration, updater hooks, native dialogs.
- Depends on: Electron APIs, generated frontend RPC client imports from `frontend/app/store/wshclientapi`, backend endpoints exported by `wavesrv` startup.
- Used by: renderer code through `window.api` from `emain/preload.ts`, plus backend-directed window events handled in `emain/emain.ts`.

**Renderer application:**

- Purpose: Render the TideTerm UI, maintain client-side reactive state, and route user actions to backend services/RPC commands.
- Location: `frontend/wave.ts`, `frontend/app/app.tsx`, `frontend/app/store/global.ts`, `frontend/app/store/wshrpcutil.ts`, `frontend/app/store/wshrouter.ts`
- Contains: React app shell, Jotai atoms, block/view components, layout engine bindings, AI panel UI, proxy UI, MCP settings UI.
- Depends on: preload API from `emain/preload.ts`, WebSocket endpoint from `pkg/web/ws.go`, backend service facade from `frontend/app/store/services.ts`, Wave object store in `frontend/app/store/wos`.
- Used by: end users and Electron windows created in `emain/emain-window.ts`.

**Backend service layer:**

- Purpose: Expose object/service operations to the renderer over HTTP and feed object updates back over events/WebSocket RPC.
- Location: `pkg/service/service.go`, `pkg/web/web.go`, `pkg/web/ws.go`
- Contains: reflective service dispatch (`ServiceMap`), HTTP handlers, file streaming handlers, WebSocket upgrade and route registration.
- Depends on: service packages in `pkg/service/*`, auth validation in `pkg/authkey`, routing in `pkg/wshutil`, event distribution in `pkg/eventbus`.
- Used by: renderer service calls from `frontend/app/store/services.ts` and routed RPC clients from `frontend/app/store/wshrpcutil.ts`.

**Wave object and event model:**

- Purpose: Represent tabs, windows, workspaces, blocks, layouts, and runtime metadata as shared objects synchronized between backend and renderer.
- Location: `frontend/app/store/wos`, `frontend/app/store/global.ts`, `pkg/waveobj/`, `pkg/wps/`, `pkg/wstore/`
- Contains: object caching, update application, scoped event subscriptions, persisted workspace/window/tab/block data.
- Depends on: backend object services and wave event publishing.
- Used by: almost every renderer subsystem, especially `frontend/wave.ts`, `frontend/app/app.tsx`, and block views under `frontend/app/view/`.

**Remote execution layer:**

- Purpose: Establish SSH/WSL connections, install/start `wsh`, bridge remote shell/file operations, and preserve routed remote capabilities.
- Location: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `pkg/wshrpc/`, `cmd/wsh/`, `pkg/remote/fileshare/`
- Contains: connection state machines, connection events, domain-socket or router-based RPC bridging, tmux management, remote file streaming.
- Depends on: SSH/WSL client libraries, `wshrpc` command contracts, router registration in `pkg/wshutil`.
- Used by: terminal blocks, file/preview blocks on remote hosts, tmux manager, remote proxy synchronization, and remote-aware AI/tooling flows.

**AI and integration layer:**

- Purpose: Run chat/AI workflows, resolve model backends, enforce tool approval, manage MCP sync, and host the local WaveProxy service.
- Location: `pkg/aiusechat/usechat.go`, `pkg/waveai/waveai.go`, `pkg/mcpconfig/service.go`, `pkg/waveproxy/proxy.go`, `frontend/app/aipanel/`, `frontend/app/view/proxy/`, `frontend/app/view/waveconfig/mcpcontent.tsx`
- Contains: streaming AI sessions, backend selection, tool execution, MCP config persistence/sync, local HTTP proxy server, corresponding UI surfaces.
- Depends on: secrets/config stores, telemetry, SSE helpers in `pkg/web/sse`, RPC commands in `pkg/wshrpc/wshrpctypes.go`.
- Used by: AI panel, API Proxy block, Settings → MCP Servers, and backend automation flows.

## Data Flow

**Desktop startup flow:**

1. `emain/emain.ts` starts first, configures Electron state, initializes IPC, and calls `runWaveSrv()` from `emain/emain-wavesrv.ts`.
2. `emain/emain-wavesrv.ts` spawns the `wavesrv` binary and waits for the `WAVESRV-ESTART` stderr line to publish HTTP and WebSocket endpoints into process env.
3. `cmd/server/main-server.go` initializes config, persistence, remote/WSH services, telemetry/background loops, and web servers from `pkg/web/`.
4. Electron creates `WaveBrowserWindow` instances from `emain/emain-window.ts`; preload exposes `window.api` via `emain/preload.ts`.
5. `frontend/wave.ts` receives `wave-init`, initializes global atoms/models, opens a routed WebSocket through `initWshrpc()`, preloads key objects/config, and renders `frontend/app/app.tsx`.

**Renderer service + object update flow:**

1. Generated client methods in `frontend/app/store/services.ts` call `WOS.callBackendService(...)`.
2. HTTP requests hit `handleService()` in `pkg/web/web.go`.
3. `pkg/service/service.go` resolves `service + method` from `ServiceMap` and invokes backend service methods reflectively.
4. Backend returns `WaveObjUpdate` payloads alongside data.
5. Renderer applies updates via wave event subscriptions in `frontend/app/store/global.ts` and object-store helpers in `frontend/app/store/wos`.

**Routed RPC and event flow:**

1. `frontend/app/store/wshrpcutil.ts` creates a `WshRouter` from `frontend/app/store/wshrouter.ts` and connects to `/ws` with a route such as `tab:{id}` or `builder:{id}`.
2. `pkg/web/ws.go` validates auth, upgrades the socket, creates a `wshutil.WshRpcProxy`, and registers the route in `wshutil.DefaultRouter`.
3. Commands and responses are routed by route ID instead of a single monolithic socket consumer; `WshRouter` tracks request/response route pairs.
4. Events such as `waveobj:update`, `config`, `waveai:modeconfig`, `userinput`, and `waveai:ratelimit` are delivered to the renderer through the same routed channel and handled in `frontend/app/store/global.ts`.
5. Electron-only events like `electron:newwindow` are emitted by `wavesrv`, parsed by `emain/emain-wavesrv.ts`, and handled in `emain/emain.ts`.

**Remote connection workflow:**

1. Renderer requests connection actions through RPC/service commands defined in `pkg/wshrpc/wshrpctypes.go`.
2. SSH connections are managed by `pkg/remote/conncontroller/conncontroller.go`; WSL connections are managed by `pkg/wslconn/wslconn.go`.
3. Both connection managers verify or install `wsh`, start a remote `connserver`, and establish a reusable route/domain-socket bridge for later remote commands.
4. Remote file access is streamed through commands like `Command_RemoteStreamFile` and HTTP handlers in `pkg/web/web.go`.
5. Remote tmux management is executed through `pkg/wshrpc/wshserver/tmux.go`, which resolves either SSH or WSL shell clients before invoking `tmux` commands.

**AI request flow:**

1. Renderer AI surfaces in `frontend/app/aipanel/` collect prompts and call RPC commands from `frontend/app/store/wshclientapi`.
2. Backend chat orchestration in `pkg/aiusechat/usechat.go` resolves model settings, secrets, prompts, and tool definitions.
3. Tool calls run through approval/validation logic in `pkg/aiusechat/usechat.go` and associated tool files under `pkg/aiusechat/`.
4. Streaming output is sent back through SSE helpers or RPC channels; rate limit updates are published onto the wave event bus.
5. Lower-level provider dispatch for non-usechat streaming lives in `pkg/waveai/waveai.go`, which selects Anthropic, Google, Perplexity, OpenAI, or TideTerm cloud backends.

**State Management:**

- Use Jotai atoms rooted in `frontend/app/store/global.ts` and `frontend/app/store/jotaiStore` for renderer state.
- Treat backend `WaveObj` records as the source of truth for persistent workspace/window/tab/block state.
- Use `globalStore.set()` / `globalStore.get()` outside React components, as seen throughout `frontend/wave.ts` and documented by project guidance.

## Key Abstractions

**Wave objects (`WaveObj`):**

- Purpose: Canonical shared entities for client, window, workspace, tab, block, layout, and related runtime data.
- Examples: `frontend/app/store/wos`, `pkg/waveobj/`, `pkg/wstore/`
- Pattern: Backend persists and mutates objects; renderer caches them and applies incremental `waveobj:update` events.

**Route-based RPC:**

- Purpose: Address commands/events to windows, tabs, builders, frontend blocks, Electron, and remote connections without hard-wiring a single endpoint.
- Examples: `frontend/app/store/wshrouter.ts`, `frontend/app/store/wshrpcutil.ts`, `pkg/web/ws.go`, `pkg/wshrpc/wshrpctypes.go`
- Pattern: Every client announces a route ID, request IDs are tracked, and replies/events are routed back by route metadata.

**Block architecture:**

- Purpose: Encapsulate product capabilities as blocks that can be created, moved, persisted, and rendered inside workspaces.
- Examples: `frontend/app/view/term/`, `frontend/app/view/preview/`, `frontend/app/view/webview/`, `frontend/app/view/proxy/`, `frontend/app/view/waveai/`
- Pattern: Renderer reads block metadata and selects a view; backend manages block creation, controller status, and persisted metadata.

**Service facade:**

- Purpose: Provide stable frontend-to-backend method calls without hand-writing request plumbing per method.
- Examples: `pkg/service/service.go`, `frontend/app/store/services.ts`
- Pattern: Go service methods are exposed reflectively and TS wrappers are generated into `frontend/app/store/services.ts`.

**Connection controllers:**

- Purpose: Normalize SSH and WSL remote lifecycle behind similar connection status, event publishing, and `wsh` bootstrapping behavior.
- Examples: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`
- Pattern: Long-lived controller objects maintain status, connection handles, remote RPC bridge data, and event emission.

## Entry Points

**Electron app entry:**

- Location: `emain/emain.ts`
- Triggers: Electron startup via `electron.vite.config.ts` main bundle input `emain/emain.ts`.
- Responsibilities: initialize app process, wire IPC, launch `wavesrv`, react to backend-emitted Electron events, manage quit/relaunch behavior.

**Renderer entry:**

- Location: `frontend/wave.ts`
- Triggers: `index.html` renderer bundle entry configured in `electron.vite.config.ts`.
- Responsibilities: initialize bare DOM, receive `wave-init`/`builder-init`, connect routed WebSocket, load config/object state, render `App` or `BuilderApp`.

**Backend server entry:**

- Location: `cmd/server/main-server.go`
- Triggers: spawned by `emain/emain-wavesrv.ts` or built directly via Task commands in `Taskfile.yml`.
- Responsibilities: load env/config, initialize stores/services, start web servers, telemetry/diagnostics/cleanup loops, remote/WSH runtime.

**CLI / remote helper entry:**

- Location: `cmd/wsh/main-wsh.go`
- Triggers: local CLI usage and remote `wsh connserver` bootstrap.
- Responsibilities: provide TideTerm command-line operations and act as the remote RPC/file/session helper process.

**Tsunami builder/runtime entry:**

- Location: `tsunami/` module, with renderer builder startup routed from `frontend/wave.ts` → `BuilderApp` and builder windows managed by `emain/emain-builder.ts`
- Triggers: builder window open flows and sandboxed app development/runtime paths.
- Responsibilities: support the separate WaveApp/Tsunami subsystem without mixing its source tree into the main renderer path.

## Error Handling

**Strategy:** Defensive long-running process handling with panic recovery in Go, guarded async wrappers in Electron/renderer, and route-level validation before privileged actions.

**Patterns:**

- Go background loops and connection handlers use `panichandler.PanicHandler(...)`, visible in `cmd/server/main-server.go` and `pkg/web/ws.go`.
- WebSocket and HTTP boundaries validate auth and required parameters early in `pkg/web/ws.go` and `pkg/web/web.go`.
- Electron main wraps asynchronous event handlers with `fireAndForget()` and process-level `uncaughtException` handling in `emain/emain.ts`.
- Renderer startup wraps `initWave()` / `initBuilder()` and reports failures through `getApi().sendLog(...)` in `frontend/wave.ts`.

## Cross-Cutting Concerns

**Logging:**

- Electron redirects `console.log` to `emain/emain-log.ts` from `emain/emain.ts`.
- Go services log through `log.Printf` and block-scoped logs via helpers such as `pkg/blocklogger`.

**Validation:**

- Incoming WebSocket connections are authenticated in `pkg/web/ws.go` using `pkg/authkey`.
- MCP server specs are validated before persistence in `pkg/mcpconfig/service.go`.
- AI tool calls validate inputs and approval state in `pkg/aiusechat/usechat.go`.

**Authentication:**

- Renderer ↔ backend local HTTP/WebSocket communication relies on auth-key validation wired from `emain/authkey.ts`, `emain/emain-wavesrv.ts`, and `pkg/authkey`.
- Remote connections use SSH/WSL connection controllers in `pkg/remote/conncontroller/conncontroller.go` and `pkg/wslconn/wslconn.go`.

## High-Risk Cross-Boundary Systems

**Electron ↔ renderer bridge:**

- Files: `emain/preload.ts`, `emain/emain-ipc.ts`, `frontend/wave.ts`, `frontend/types/custom.d.ts`
- Risk: every exposed preload API creates a security and compatibility boundary; changes require matching updates on both sides and careful privilege review.

**Renderer ↔ backend routed RPC:**

- Files: `frontend/app/store/wshrpcutil.ts`, `frontend/app/store/wshrouter.ts`, `pkg/web/ws.go`, `pkg/wshrpc/wshrpctypes.go`
- Risk: route announce/unannounce, request tracking, reconnect handling, and event delivery are tightly coupled; broken route logic can strand windows, tabs, builders, or remote connections.

**Remote connection bootstrap:**

- Files: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `cmd/wsh/`, `pkg/wshrpc/wshserver/tmux.go`
- Risk: SSH/WSL lifecycle, `wsh` installation/version checks, tmux bootstrapping, and route healing all cross trust and process boundaries; regressions usually affect remote terminals, files, and proxy sync together.

**Wave object synchronization:**

- Files: `frontend/app/store/global.ts`, `frontend/app/store/wos`, `pkg/service/service.go`, `pkg/wps/`, `pkg/wstore/`
- Risk: backend updates and frontend cache invalidation must remain aligned; stale or malformed object updates destabilize layout, block rendering, and window/tab state.

**AI/tool execution pipeline:**

- Files: `pkg/aiusechat/usechat.go`, `pkg/aiusechat/tools*.go`, `frontend/app/aipanel/`, `pkg/waveai/waveai.go`
- Risk: this path combines secrets, network providers, streaming, tool approvals, and user-visible side effects; small contract changes can break both UI and backend behavior.

**Proxy and MCP integration surfaces:**

- Files: `pkg/waveproxy/proxy.go`, `frontend/app/view/proxy/proxy.tsx`, `pkg/mcpconfig/service.go`, `frontend/app/view/waveconfig/mcpcontent.tsx`
- Risk: these features bridge TideTerm state into external AI clients and external HTTP callers, so config shape changes affect persistence, UI, and outside-tool compatibility.

## Constraints to Preserve

- Keep the backend/frontend/main-process split intact: Electron owns native shell concerns, `wavesrv` owns business logic and persistence, renderer owns view state.
- Preserve route ID semantics such as `tab:{id}`, `builder:{id}`, connection routes, and announced routes from `frontend/app/store/wshrouter.ts` and `pkg/web/ws.go`.
- Keep generated service wrappers in `frontend/app/store/services.ts` aligned with backend service methods in `pkg/service/service.go`.
- Treat `frontend/app/store/global.ts` atoms plus `WaveObj` updates as the established state model; avoid introducing parallel ownership for the same persisted entities.
- Preserve remote helper assumptions in `pkg/remote/conncontroller/conncontroller.go` and `pkg/wslconn/wslconn.go`, especially `wsh` version checks, route/domain-socket setup, and status/event publication.

---

_Architecture analysis: 2026-04-14_
