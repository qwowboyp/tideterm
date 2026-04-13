# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-14
**Commit:** 50f7f8fa
**Branch:** main

## OVERVIEW
TideTerm — open-source AI-native terminal (fork of Wave Terminal). Block-based workspace: terminals, files, previews, web, editor, AI chat. Cross-platform (macOS/Linux/Windows). Hybrid Go backend + Electron/React frontend.

## STRUCTURE
```
tideterm/
├── cmd/           # Go entry points: server (wavesrv), wsh CLI, code generators
├── pkg/           # Go packages (~45 modules): core logic, RPC, AI, proxy, remote
├── emain/         # Electron main process (TypeScript)
├── frontend/      # React/TS renderer app
│   ├── app/       # UI components, views, store, i18n
│   ├── layout/    # Layout engine (grid/pane management)
│   ├── util/      # Shared utilities
│   └── types/     # TypeScript type definitions
├── tsunami/       # Sub-module: Go engine + standalone React frontend (sandboxed apps)
├── aiprompts/     # AI prompt templates (markdown)
├── db/            # SQLite migrations (wavesrv + wstore)
├── schema/        # Generated config schema (JSON)
├── build/         # Build scripts, icons, electron-builder assets
├── docs/          # Docusaurus documentation site (workspace)
├── tests/         # Shell-based integration tests (copytests)
└── testdriver/    # TestDriver.ai YAML fixtures
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new block type | `frontend/app/view/` | Each block type = subdirectory |
| Modify terminal rendering | `frontend/app/view/term/` | Uses xterm.js + WebGL addon |
| AI chat / AI panel | `frontend/app/aipanel/`, `pkg/waveai/`, `pkg/aiusechat/` | Frontend + Go backend |
| Remote connections (SSH/WSL) | `pkg/remote/`, `pkg/wslconn/`, `pkg/wshrpc/` | wsh RPC protocol |
| MCP server management | `pkg/mcpconfig/` | Config sync to Claude/Codex/Gemini |
| API proxy (WaveProxy) | `pkg/waveproxy/` | Multi-channel AI proxy |
| State management | `frontend/app/store/` | Jotai atoms |
| i18n (translations) | `frontend/app/i18n/` | English + Simplified Chinese |
| Electron IPC | `emain/emain-ipc.ts` | Main↔Renderer bridge |
| Go server lifecycle | `cmd/server/main-server.go` | Bootstrap, listeners, RPC |
| wsh CLI commands | `cmd/wsh/cmd/` | 39 Go files for CLI subcommands |
| Config/settings | `pkg/wconfig/` | Settings model + schema generation |
| Layout engine | `frontend/layout/` | Grid/pane layout with tests |
| Tsunami sandbox | `tsunami/` | Own go.mod, own frontend, used for sandboxed UI blocks |
| Database migrations | `db/migrations-wstore/` | SQLite schema evolution |

## CONVENTIONS

- **4-space indent** for TS/JS/SCSS/JSON/YAML (`.editorconfig`)
- **LF line endings** everywhere
- **Path aliases** in tsconfig: `@/app/*`, `@/util/*`, `@/store/*`, `@/view/*`, etc.
- **TypeScript strict mode OFF** (`strict: false`) — do not add strict checks
- **State**: Jotai atoms in `frontend/app/store/`; use `globalStore.get()`/`set()` in non-React contexts
- **Styling**: Tailwind CSS v4 + SCSS; shadcn components in `frontend/app/shadcn/`
- **Go linting**: golangci-lint with `unused` linter disabled
- **Build system**: Task (Taskfile.yml), NOT Make. Use `task` commands.
- **No `as any` / `@ts-ignore`** — fix properly

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT export `currentValueAtom`** for state setting — causes stale state issues (`frontend/util/util.ts`)
- **NEVER use React hooks in model methods** — use `globalStore.get()`/`set()` instead (`aiprompts/newview.md`)
- **Backend NEVER touches** `RootNode`, `FocusedNodeId`, `MagnifiedNodeId` — frontend-only persistence (`aiprompts/layout-simplification.md`)
- **DO NOT hardcode** event types — pull from eventbus definitions (`pkg/web/ws.go` has TODO)
- **DO NOT store secrets in plaintext** — always encrypted (`docs/docs/secrets.mdx`)
- **Do NOT work on main branch** — use feature branches (`CONTRIBUTING.md`)
- **AI tool calls: do NOT echo file content** in chat unless explicitly asked (`pkg/aiusechat/usechat-prompts.go`)

## UNIQUE STYLES

- **Block architecture**: Everything is a "block" (terminal, files, web, editor, AI chat). Blocks are draggable, resizable panels.
- **wsh RPC**: Custom RPC protocol over Unix sockets/WebSockets between Electron and Go backend
- **Tsunami sub-module**: Separate Go module with own frontend — builds sandboxed mini-apps that run inside TideTerm blocks
- **Fork identity**: TideTerm uses `TIDETERM_*` env vars and `~/.tideterm/` paths to coexist with upstream Wave Terminal
- **Electron main = `emain/`** (not standard `src/main/`)
- **Renderer entry = `frontend/wave.ts`** (not `src/index.tsx`)
- **Vite bundles Monaco, Mermaid, KaTeX, Shiki, Cytoscape** as separate chunks

## COMMANDS
```bash
# Setup
task init                  # Install all deps (npm + go + docs)

# Development
task dev                   # Hot-reload dev server (electron-vite)
task start                 # Standalone run (no reload)
task electron:winquickdev  # Windows quick dev (amd64 only, no wsh/generate)

# Build
task build:backend         # Build wavesrv + wsh (all platforms)
task build:frontend:dev    # Build frontend in dev mode
task package               # Full production build + package → make/

# Testing
npm test                   # Vitest (frontend)
npm run coverage           # Vitest with Istanbul coverage
go test ./pkg/...          # Go unit tests

# Code generation
task generate              # Generate TS bindings + Go code from schema

# Docs
task docsite               # Start Docusaurus dev server
```

## NOTES

- **Zig required** for CGO cross-compilation (static linking) on Windows/Linux
- **Node 22 LTS** required
- **Go 1.24.6** required
- Config locations use `TIDETERM_CONFIG_HOME` / `TIDETERM_DATA_HOME` env vars
- Remote helper installs to `~/.tideterm/bin/wsh` on remote machines
- Telemetry and auto-update **disabled by default** in this fork
- `waveconfig` settings are **deprecated** — use new config system
- macOS "damaged app" fix: `sudo xattr -dr com.apple.quarantine "/Applications/TideTerm.app"`
