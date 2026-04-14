# Technology Stack - TideTerm

## Core Frameworks

- **Backend**: Go 1.24.6
- **Frontend**: React 19 (TypeScript)
- **Desktop Wrapper**: Electron 38.5.0
- **Build System**: Task (Taskfile.yml) + npm + Go build

## Backend (Go)

- **Server**: `wavesrv` (Go-based backend server)
- **CLI**: `wsh` (Shell extensions and remote helper)
- **Database**: SQLite (via `github.com/mattn/go-sqlite3` and `sqlx`)
- **Migrations**: `golang-migrate/migrate/v4`
- **RPC**: Custom RPC protocol over Unix sockets/WebSockets (`pkg/wshrpc`)
- **AI Integration**:
  - `google/generative-ai-go` (Gemini)
  - `sashabaranov/go-openai` (OpenAI/compatible)
  - `waveai` package for core AI logic
- **Networking**: `gorilla/mux`, `gorilla/websocket`
- **System/PTY**: `creack/pty`, `shirou/gopsutil`
- **Remote**: SSH config handling, WSL support (`ubuntu/gowsl`)

## Frontend (React/TS)

- **State Management**: Jotai 2.9.3
- **Styling**: Tailwind CSS v4 + SCSS
- **Terminal Rendering**: xterm.js (with WebGL, Fit, Search, Web Links addons)
- **Editor**: Monaco Editor
- **UI Components**: shadcn/ui (Radix UI based), Lucide icons
- **Data Fetching/AI**: `@ai-sdk/react`, `rxjs`
- **Markdown/Rendering**: `react-markdown`, `mermaid`, `shiki`, `katex`
- **Utilities**: `immer`, `dayjs`, `clsx`, `tailwind-merge`

## Desktop (Electron)

- **Main Process**: TypeScript (`emain/` directory)
- **IPC**: Custom IPC bridge between Electron Main and Renderer (`emain/emain-ipc.ts`)
- **Bundler**: `electron-vite` (Vite-based build tool for Electron)
- **Updater**: `electron-updater`

## Sub-modules

- **Tsunami**: A sandboxed mini-app engine with its own Go backend and React frontend, used for specialized blocks.
