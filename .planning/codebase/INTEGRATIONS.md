# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**AI Providers:**

- TideTerm-hosted Wave AI endpoint - optional hosted/cloud AI path for provider `wave`
  - SDK/Client: internal backend mode resolution in `pkg/aiusechat/usechat-mode.go`
  - Auth: endpoint may be overridden by `TIDETERM_AI_ENDPOINT` in `pkg/aiusechat/usechat-mode.go`
- OpenAI - direct Responses or Chat Completions integration
  - SDK/Client: `github.com/sashabaranov/go-openai` in `go.mod`
  - Auth: secret name `OPENAI_KEY` in `pkg/aiusechat/usechat-mode.go`
  - Default endpoints: `https://api.openai.com/v1/responses` and `https://api.openai.com/v1/chat/completions` in `pkg/aiusechat/usechat-mode.go`
- OpenRouter - OpenAI-compatible upstream routing
  - SDK/Client: OpenAI-compatible backend flow in `pkg/aiusechat/usechat-mode.go`
  - Auth: secret name `OPENROUTER_KEY` in `pkg/aiusechat/usechat-mode.go`
  - Default endpoint: `https://openrouter.ai/api/v1/chat/completions` in `pkg/aiusechat/usechat-mode.go`
- Azure OpenAI / Azure legacy chat - Azure-hosted OpenAI-compatible APIs
  - SDK/Client: internal endpoint templates in `pkg/aiusechat/usechat-mode.go`
  - Auth: secret name `AZURE_OPENAI_KEY` in `pkg/aiusechat/usechat-mode.go`
  - Endpoint shape: `https://{resource}.openai.azure.com/...` in `pkg/aiusechat/usechat-mode.go`
- Google Gemini - direct Gemini streaming API
  - SDK/Client: `github.com/google/generative-ai-go` and `google.golang.org/api` in `go.mod`
  - Auth: secret name `GOOGLE_AI_KEY` in `pkg/aiusechat/usechat-mode.go`
  - Default endpoint: `https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent` in `pkg/aiusechat/usechat-mode.go`

**Distribution & Release Services:**

- GitHub Releases - package publishing and update source
  - SDK/Client: `electron-builder` GitHub publisher in `electron-builder.config.cjs`
  - Auth: GitHub Actions repository permissions/secrets in `.github/workflows/build-helper.yml`
- DigiCert KeyLocker - optional Windows signing in CI
  - SDK/Client: external MSI tooling invoked in `.github/workflows/build-helper.yml`
  - Auth: CI secrets `SM_API_KEY`, `SM_HOST`, `SM_CODE_SIGNING_CERT_SHA1_HASH`, `SM_CLIENT_CERT_FILE_B64`, `SM_CLIENT_CERT_PASSWORD` referenced in `.github/workflows/build-helper.yml`
- Apple signing/notarization - optional macOS signing path in CI
  - SDK/Client: electron-builder/macOS notarization flow in `.github/workflows/build-helper.yml`
  - Auth: CI secrets `PROD_MACOS_CERTIFICATE_2`, `PROD_MACOS_CERTIFICATE_PWD_2`, `PROD_MACOS_NOTARIZATION_APPLE_ID_2`, `PROD_MACOS_NOTARIZATION_PWD_2`, `PROD_MACOS_NOTARIZATION_TEAM_ID_2`

## Data Storage

**Databases:**

- SQLite
  - Connection: local filesystem under TideTerm data directory resolved by `TIDETERM_DATA_HOME` / Electron path setup in `emain/emain-platform.ts` and `pkg/wavebase/wavebase.go`
  - Client: `github.com/mattn/go-sqlite3`, `github.com/jmoiron/sqlx`, and `github.com/golang-migrate/migrate/v4` in `go.mod`

**File Storage:**

- Local filesystem for app data/config/cache (`pkg/wavebase/wavebase.go`, `emain/emain-platform.ts`)
- AWS S3-backed remote file access for `s3://` connections (`pkg/remote/awsconn/awsconn.go`, `pkg/remote/fileshare/s3fs/s3fs.go`)

**Caching:**

- Local filesystem cache directory resolved per OS by `pkg/wavebase/wavebase.go`
- In-memory managers for WaveProxy metrics, sessions, and recent request history in `pkg/waveproxy/proxy.go`

## Authentication & Identity

**Auth Provider:**

- Custom TideTerm auth/routing
  - Implementation: internal JWT/swap-token environment variables and auth routing in `pkg/wavebase/wavebase.go`, websocket/auth packages imported by `pkg/web/ws.go`, and RPC auth commands exposed in `frontend/app/store/wshclientapi.ts`

**AI/API credentials:**

- Provider API keys are stored via TideTerm secret/config systems; secret names are assigned in code by provider (`pkg/aiusechat/usechat-mode.go`)
- WaveProxy supports proxy-level `accessKey` and per-channel auth modes (`x-api-key`, `bearer`, `both`, Gemini `x-goog-api-key`) per `MODIFICATIONS.md` and `README.md`

**Remote system identity:**

- SSH authentication supports keys, passphrases, password auth, keyboard-interactive auth, agent auth, ProxyJump, and known_hosts verification in `pkg/remote/sshclient.go`
- WSL integration identifies distros as `wsl://<distro>` connections in `pkg/wslconn/wslconn.go`
- AWS identity comes from shared AWS config/credentials profiles parsed from local user config files in `pkg/remote/awsconn/awsconn.go`

## Monitoring & Observability

**Error Tracking:**

- No third-party error tracking service is wired by default in the analyzed files

**Logs:**

- Go backend and WaveProxy log through standard logging in files such as `cmd/server/main-server.go` and `pkg/waveproxy/proxy.go`
- Electron updater logs state transitions in `emain/updater.ts`
- Dev backend logs are written to `waveapp.log` in TideTerm data directories per `BUILD.md`
- WaveProxy exposes health, metrics, and request history managers in `pkg/waveproxy/proxy.go`

**Telemetry:**

- Telemetry exists but is disabled by default (`PRIVACY.md`, `MODIFICATIONS.md`)
- Diagnostic ping and telemetry loops are implemented in `cmd/server/main-server.go`
- Cloud AI modes require telemetry to be enabled according to `pkg/aiusechat/usechat.go` (referenced by repository search)

## CI/CD & Deployment

**Hosting:**

- Desktop distribution is packaged locally and published to GitHub Releases for `sanshao85/tideterm` (`electron-builder.config.cjs`, `RELEASES.md`)

**CI Pipeline:**

- GitHub Actions builds tagged releases on macOS/Linux/Windows in `.github/workflows/build-helper.yml`
- CI installs Zig, FPM, Task, Node 22, and Go 1.24, then runs `task package` across platforms (`.github/workflows/build-helper.yml`)

## Environment Configuration

**Required env vars:**

- `TIDETERM_CONFIG_HOME` - overrides TideTerm config directory (`README.md`, `pkg/wavebase/wavebase.go`, `emain/emain-platform.ts`)
- `TIDETERM_DATA_HOME` - overrides TideTerm data directory (`README.md`, `pkg/wavebase/wavebase.go`, `emain/emain-platform.ts`)
- `TIDETERM_ENVFILE` - optional env file path loaded by backend startup (`Taskfile.yml`, `cmd/server/main-server.go`)
- `TIDETERM_AI_ENDPOINT` - optional hosted Wave AI endpoint override (`pkg/aiusechat/usechat-mode.go`)
- `TIDETERM_NOPING` - disables diagnostic ping loop (`cmd/server/main-server.go`)
- `SM_CODE_SIGNING_CERT_SHA1_HASH` and related signing secrets - optional Windows signing in packaging/CI (`electron-builder.config.cjs`, `.github/workflows/build-helper.yml`)

**Secrets location:**

- Provider/API secrets are not committed in repository docs; runtime paths are managed through TideTerm config/secret handling and CI secret stores
- MCP sync writes into local app config files rather than repository-managed secrets: `~/.claude.json`, `~/.codex/config.toml`, `~/.gemini/settings.json` (`README.md`, `pkg/mcpconfig/paths.go`)

## Webhooks & Callbacks

**Incoming:**

- WebSocket endpoint `/ws` for renderer/backend command streaming in `pkg/web/ws.go`
- WaveProxy HTTP endpoints in `pkg/waveproxy/proxy.go`:
  - `/health`
  - `/v1/messages`
  - `/v1/messages/count_tokens`
  - `/v1/responses`
  - `/v1/responses/compact`
  - `/messages`
  - `/responses`
  - `/v1/models`, `/models`
  - `/v1beta/models/` for Gemini-compatible requests

**Outgoing:**

- AI provider HTTP requests to OpenAI, OpenRouter, Azure OpenAI, Google Gemini, and optional TideTerm-hosted Wave AI endpoints (`pkg/aiusechat/usechat-mode.go`)
- Auto-updater outbound checks against GitHub Releases when enabled (`emain/updater.ts`, `RELEASES.md`, `electron-builder.config.cjs`)
- Remote outbound SSH sessions and `wsh connserver` bootstrap to remote machines (`pkg/remote/sshclient.go`, `pkg/wslconn/wslconn.go`)
- MCP configuration sync writes to local Claude/Codex/Gemini config files for installed tools (`pkg/mcpconfig/service.go`, `pkg/mcpconfig/claude.go`, `pkg/mcpconfig/codex.go`, `pkg/mcpconfig/gemini.go`)

## Protocols & Provider-Specific Integrations

**Remote systems:**

- SSH - primary remote shell/file/control transport (`pkg/remote/sshclient.go`)
- WSL - Windows-local Linux distro integration (`pkg/wslconn/wslconn.go`)
- Domain sockets / WebSockets - wsh RPC transport between components and remote controllers (`CONTRIBUTING.md`, `pkg/web/ws.go`, `pkg/wslconn/wslconn.go`)

**MCP integrations:**

- TideTerm normalizes MCP servers into its own `mcp.json` format in `pkg/mcpconfig/service.go`
- Claude Code integration writes `mcpServers` into `~/.claude.json` (`pkg/mcpconfig/claude.go`, `pkg/mcpconfig/paths.go`)
- Codex CLI integration writes `mcp_servers` into `~/.codex/config.toml` (`pkg/mcpconfig/codex.go`, `pkg/mcpconfig/paths.go`)
- Gemini CLI integration writes `mcpServers` into `~/.gemini/settings.json` (`pkg/mcpconfig/gemini.go`, `pkg/mcpconfig/paths.go`)
- Supported MCP transports are `stdio`, `http`, and `sse` (`README.md`, `MODIFICATIONS.md`, `pkg/mcpconfig/claude.go`, `pkg/mcpconfig/gemini.go`)

**WaveProxy interactions:**

- WaveProxy is a built-in local/remote AI proxy service implemented in `pkg/waveproxy/`
- It manages separate channel groups for Anthropic Messages, OpenAI Responses, and Gemini-compatible traffic (`pkg/waveproxy/proxy.go`, `MODIFICATIONS.md`)
- It provides OpenAI-compatible aliases for clients that call root or `/v1` endpoints (`pkg/waveproxy/proxy.go`)
- It tracks metrics/history and uses scheduler/channel/session managers for failover and affinity routing (`pkg/waveproxy/proxy.go`)
- TideTerm UI and `wsh proxy` operate on the same persisted proxy config (`MODIFICATIONS.md`)

**Packaging/distribution dependencies:**

- electron-builder packages binaries and app assets for macOS/Linux/Windows (`electron-builder.config.cjs`)
- GitHub Actions builds and drafts releases on tag push (`.github/workflows/build-helper.yml`)
- Optional code signing/notarization depends on Apple and DigiCert external services (`.github/workflows/build-helper.yml`)

---

_Integration audit: 2026-04-14_
