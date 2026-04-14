# Technology Stack

**Analysis Date:** 2026-04-14

## Languages

**Primary:**

- Go 1.24.6 - backend services, RPC, remote connection handling, WaveProxy, MCP sync, storage, and CLI code in `cmd/`, `pkg/`, and `tsunami/` (`go.mod`, `cmd/server/main-server.go`)
- TypeScript 5.9.x - Electron main/preload code and React renderer in `emain/` and `frontend/` (`package.json`, `tsconfig.json`, `electron.vite.config.ts`)

**Secondary:**

- JavaScript/CommonJS - packaging configuration in `electron-builder.config.cjs`
- YAML - task orchestration and CI workflows in `Taskfile.yml` and `.github/workflows/build-helper.yml`
- SCSS + Tailwind CSS v4 - frontend styling pipeline configured through `electron.vite.config.ts` and dependencies in `package.json`
- Markdown/MDX - docs site content and AI prompt/reference material in `docs/` and `aiprompts/` (`docs/package.json`)

## Runtime

**Environment:**

- Node.js 22 LTS for Electron build/runtime tooling (`BUILD.md`, `.github/workflows/build-helper.yml`, `electron.vite.config.ts`)
- Electron 38.5.0 for desktop shell and renderer/main process hosting (`package.json`)
- Chromium 140 target for renderer bundles (`electron.vite.config.ts`)
- Go runtime 1.24.6 for `wavesrv`, `wsh`, generators, and Tsunami services (`go.mod`, `Taskfile.yml`)

**Package Manager:**

- npm 10.9.2 - root workspace package manager (`package.json`)
- Lockfile: present at `package-lock.json` (lockfileVersion 3)
- Go modules - dependency management for root module and Tsunami submodule (`go.mod`, `tsunami/go.mod`)

## Frameworks

**Core:**

- Electron + electron-vite - desktop app shell and build orchestration (`package.json`, `electron.vite.config.ts`)
- React 19.2.0 - TideTerm renderer UI in `frontend/` (`package.json`)
- Jotai 2.9.3 - frontend state management (`package.json`)
- Gorilla Mux + Gorilla WebSocket - backend HTTP routing and websocket transport in `pkg/web/ws.go` and service packages (`go.mod`, `pkg/web/ws.go`)
- Cobra 1.10.2 - CLI command framework for `wsh` and generators (`go.mod`)
- Tsunami submodule - separate Go + React app stack for sandboxed mini-apps (`go.mod`, `tsunami/frontend/package.json`)

**Testing:**

- Vitest 3.0.9 + Istanbul coverage - frontend test runner and coverage (`package.json`)
- Go test - backend/unit testing across Go packages (`BUILD.md`)

**Build/Dev:**

- Task v3 - canonical build task runner; use `task`, not Make (`Taskfile.yml`, `BUILD.md`)
- Vite 6.4.x - renderer and Tsunami frontend bundling (`package.json`, `tsunami/frontend/package.json`)
- SWC React plugin - React transform for Vite (`package.json`, `electron.vite.config.ts`)
- electron-builder 26 - packaging and release artifact generation (`package.json`, `electron-builder.config.cjs`)
- TypeScript compiler - project typechecking/transpile target configuration (`package.json`, `tsconfig.json`)

## Key Dependencies

**Critical:**

- `electron` / `electron-updater` - packaged desktop runtime and optional update delivery (`package.json`, `emain/updater.ts`)
- `react` / `react-dom` - renderer UI foundation (`package.json`)
- `jotai` - app state model in `frontend/app/store/` (`package.json`)
- `@xterm/xterm` plus addons fit/search/serialize/web-links/webgl - terminal rendering stack (`package.json`)
- `ai` and `@ai-sdk/react` - frontend AI SDK integration (`package.json`)
- `github.com/sashabaranov/go-openai` - OpenAI-compatible backend provider client (`go.mod`)
- `github.com/google/generative-ai-go` + `google.golang.org/api` - Google/Gemini provider integration (`go.mod`)
- `github.com/gorilla/websocket` - websocket transport between frontend/Electron/backend (`go.mod`, `pkg/web/ws.go`)

**Infrastructure:**

- `github.com/mattn/go-sqlite3` + `github.com/jmoiron/sqlx` + `github.com/golang-migrate/migrate/v4` - local SQLite storage and migrations (`go.mod`)
- `github.com/aws/aws-sdk-go-v2/config` + `service/s3` - AWS profile discovery and S3-backed file access (`go.mod`, `pkg/remote/awsconn/awsconn.go`)
- `golang.org/x/crypto/ssh` + `github.com/skeema/knownhosts` + `github.com/wavetermdev/ssh_config` - SSH connection/auth/known_hosts handling (`go.mod`, `pkg/remote/sshclient.go`)
- `github.com/ubuntu/gowsl` - Windows WSL integration (`go.mod`, `pkg/wslconn/wslconn.go`)
- `launchdarkly/eventsource` - SSE protocol support for integrations such as MCP and AI streaming paths (`go.mod`)
- `winston` - frontend/Electron logging dependency (`package.json`)
- `env-paths` - OS-specific config/data path resolution in Electron main (`package.json`, `emain/emain-platform.ts`)

## Configuration

**Environment:**

- Electron main computes config/data locations and exports them to backend through `TIDETERM_CONFIG_HOME`, `TIDETERM_DATA_HOME`, `TIDETERM_APP_PATH`, `TIDETERM_RESOURCES_PATH`, and related vars (`emain/emain-platform.ts`, `pkg/wavebase/wavebase.go`)
- Optional local env-file loading is supported via `TIDETERM_ENVFILE`; dev tasks point it at the repository `.env` file without reading secrets into docs (`Taskfile.yml`, `cmd/server/main-server.go`)
- AI provider defaults and secret names are derived in code, not hardcoded in docs/config files, via `pkg/aiusechat/usechat-mode.go`
- MCP manager persists TideTerm-managed MCP definitions to `mcp.json` in TideTerm config dir (`pkg/mcpconfig/service.go`)

**Build:**

- `Taskfile.yml` orchestrates dependency install, backend builds, schema generation, packaging, docs site, and quickdev variants
- `electron.vite.config.ts` defines main/preload/renderer bundles, path aliases, asset copying, and chunk strategy
- `electron-builder.config.cjs` defines cross-platform targets, signing hooks, update publishing target, and packaged file filters
- `.github/workflows/build-helper.yml` defines tagged-release CI for macOS/Linux/Windows
- `tsconfig.json` defines alias mapping for `frontend/` and `emain/`, bundler module resolution, and non-strict TS mode

## Storage

**Local Databases:**

- SQLite is the primary embedded data store through `github.com/mattn/go-sqlite3` and migration tooling (`go.mod`, `pkg/wavebase/wavebase.go`)

**Config/Data Files:**

- TideTerm config lives under `TIDETERM_CONFIG_HOME` / `~/.config/tideterm` and data under `TIDETERM_DATA_HOME` / OS-specific data dirs (`README.md`, `pkg/wavebase/wavebase.go`, `emain/emain-platform.ts`)
- WaveProxy config persists to `~/.config/tideterm/waveproxy.json` (`README.md`, `MODIFICATIONS.md`)
- MCP config persists to TideTerm config dir as `mcp.json` (`pkg/mcpconfig/service.go`)

## Transport Layers

**Internal app transport:**

- HTTP + WebSocket between Electron/renderer/backend using Gorilla WebSocket and custom RPC envelopes (`pkg/web/ws.go`, `CONTRIBUTING.md`)
- wsh RPC across local and remote contexts via domain sockets or websockets (`CONTRIBUTING.md`, `pkg/wslconn/wslconn.go`)

**Remote/protocol transport:**

- SSH for remote host control and `wsh connserver` bootstrap (`pkg/remote/sshclient.go`)
- WSL command/process integration on Windows (`pkg/wslconn/wslconn.go`)
- HTTP/SSE/stdio as supported MCP transport types (`pkg/mcpconfig/service.go`, `pkg/mcpconfig/claude.go`, `pkg/mcpconfig/codex.go`, `pkg/mcpconfig/gemini.go`)
- HTTP streaming endpoints for AI providers and WaveProxy routes (`pkg/aiusechat/usechat-mode.go`, `pkg/waveproxy/proxy.go`)
- AWS S3 API for S3-backed file operations (`pkg/remote/awsconn/awsconn.go`, `pkg/remote/fileshare/s3fs/`)

## Platform Requirements

**Development:**

- Node 22 LTS is required (`BUILD.md`, `.github/workflows/build-helper.yml`)
- Go 1.24.x is required (`go.mod`, `.github/workflows/build-helper.yml`)
- Zig is required on Windows and Linux for CGO static-link builds (`BUILD.md`, `Taskfile.yml`)
- Task v3 is required to run standard project commands (`BUILD.md`, `Taskfile.yml`)
- Linux packaging additionally depends on `zip`, `rpm`, `snapd`, `lxd`, `snapcraft`, `libarchive-tools`, `binutils`, `libopenjp2-tools`, and `squashfs-tools` (`BUILD.md`, `.github/workflows/build-helper.yml`)

**Production:**

- Desktop targets: macOS, Linux, Windows (`README.md`, `electron-builder.config.cjs`)
- macOS artifacts: `zip` and `dmg`; minimum system version 10.15.0 (`electron-builder.config.cjs`)
- Linux artifacts: `zip`, `deb`, `rpm`, `snap`, `AppImage`, `pacman` (`electron-builder.config.cjs`)
- Windows artifacts: `nsis`, `msi`, `zip` (`electron-builder.config.cjs`)
- Releases publish to GitHub Releases for `sanshao85/tideterm`; auto-update feed also targets GitHub when enabled (`electron-builder.config.cjs`, `RELEASES.md`, `.github/workflows/build-helper.yml`)

---

_Stack analysis: 2026-04-14_
