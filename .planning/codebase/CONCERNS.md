# Codebase Concerns

**Analysis Date:** 2026-04-14

## Tech Debt

**Remote connection startup and routing:**

- Issue: Remote `connserver` startup still depends on sleeps, retries, route self-heal, and follow-up readiness checks instead of a single deterministic handshake.
- Files: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `cmd/wsh/cmd/wshcmd-connserver.go`, `pkg/wshutil/wshrouter.go`
- Impact: Remote SSH/WSL features can fail intermittently after reconnects or slow starts, especially for file browsing, remote editing, and any operation that depends on the `conn:*` route existing before UI actions fire.
- Fix approach: Preserve the current architecture, but replace fixed sleeps and post-hoc self-heal with an explicit ready/ack protocol from `connserver` to the router, then verify route registration before exposing the connection as usable.

**Legacy and current config systems coexist:**

- Issue: The Settings UI intentionally exposes deprecated config files alongside the current config surface, which means migration is incomplete and future work must handle both formats.
- Files: `frontend/app/view/waveconfig/waveconfig-model.ts`, `frontend/app/view/waveconfig/waveconfig.tsx`, `MODIFICATIONS.md`
- Impact: Changes touching settings, presets, or AI configuration have upgrade/migration risk and increase upstream merge friction because both current and deprecated paths must be kept coherent.
- Fix approach: Keep deprecated files readable until migration is complete, but funnel new behavior into the current config files and document any compatibility logic in the same change.

**Renderer state complexity in layout engine:**

- Issue: Layout logic still relies on local workarounds for drag-state freshness, ephemeral node handling, and z-index ordering.
- Files: `frontend/layout/lib/layoutTree.ts`, `frontend/layout/lib/layoutModel.ts`
- Impact: The block layout system remains difficult to modify safely; regressions are likely in drag/drop, resize, focus, or magnify behavior because state is distributed across persistent tree data and multiple transient UI atoms.
- Fix approach: Change layout behavior incrementally, backed by focused tests in `frontend/layout/tests/`, and avoid touching tree persistence and ephemeral rendering paths in the same change unless necessary.

**Shell/remote command assembly remains string-heavy:**

- Issue: Shell bootstrap and remote tmux/CWD setup still construct command text manually, with open TODOs around quoting correctness.
- Files: `pkg/shellexec/shellexec.go`, `pkg/blockcontroller/shellcontroller.go`
- Impact: Path quoting, shell portability, and remote startup behavior can regress from seemingly small string changes, especially across bash, zsh, fish, PowerShell, SSH, tmux, and WSL combinations.
- Fix approach: Treat command string assembly as a fragile boundary; add narrow tests before changing quoting or bootstrap flow, and prefer extending existing helper functions over adding more ad hoc string concatenation.

## Known Bugs

**Window title does not stay synced with tab renames:**

- Symptoms: Window title is initialized from the current tab name but does not keep tracking later tab name changes.
- Files: `frontend/wave.ts`
- Trigger: Rename a tab after initial load or after reinit; the title remains stale until a later reinitialization path runs.
- Workaround: Reopen or reinitialize the window/tab context; no dedicated continuous sync path is present yet.

**Proxy channel ping is not fully implemented:**

- Symptoms: Proxy health checks can report incomplete or misleading status because the RPC layer still contains a TODO placeholder for real ping behavior.
- Files: `pkg/waveproxy/rpc/rpc.go`
- Trigger: Use proxy channel ping/health features from the API Proxy block or RPC surface expecting true upstream verification.
- Workaround: Validate channels with real traffic or direct endpoint checks instead of trusting the placeholder ping path alone.

## Security Considerations

**Static JWT secret for internal auth:**

- Risk: Internal token signing uses a hard-coded secret string, which weakens trust boundaries if any local/remote channel unexpectedly exposes token material or if adjacent processes can forge compatible tokens.
- Files: `pkg/wavebase/wavebase.go`, `pkg/wshutil/wshutil.go`
- Current mitigation: TideTerm unsets `TIDETERM_JWT` and related env vars during server bootstrap/shutdown paths in `cmd/server/main-server.go`, reducing accidental inheritance.
- Recommendations: Generate and persist a per-install secret in protected config storage, rotate on demand, and keep token creation/validation isolated behind a single component.

**Optional env-file injection at server startup:**

- Risk: `TIDETERM_ENVFILE` allows the server to load an arbitrary env file path at startup, which is powerful for development but broadens the blast radius of misconfiguration.
- Files: `cmd/server/main-server.go`
- Current mitigation: The path is only used when explicitly set.
- Recommendations: Treat this as a trusted-development-only entry point, document it as such, and avoid building new features that depend on env-file side effects in production.

**AI/proxy configuration touches secrets and third-party credentials:**

- Risk: The codebase correctly routes many credentials through secret storage, but high-risk surfaces remain concentrated around AI providers, MCP sync, and WaveProxy channel configuration.
- Files: `pkg/aiusechat/usechat.go`, `pkg/buildercontroller/buildercontroller.go`, `frontend/app/view/waveconfig/secretscontent.tsx`, `pkg/waveproxy/`, `docs/docs/secrets.mdx`
- Current mitigation: Secret retrieval is centralized in secret-store paths, and user-facing docs explicitly forbid plaintext secret storage.
- Recommendations: Keep secrets out of logs, keep new proxy/auth features behind existing secret abstractions, and review any new config persistence fields for accidental plaintext storage.

## Performance Bottlenecks

**Renderer layout/focus interactions are sensitive to state churn:**

- Problem: The layout engine manages drag/drop, resize, focus, magnify, overlay, and persistence in one dense model.
- Files: `frontend/layout/lib/layoutModel.ts`, `frontend/layout/lib/layoutTree.ts`, `frontend/layout/tests/*.test.ts`
- Cause: Heavy in-memory state plus derived atoms and drag-layer workarounds make the renderer susceptible to regressions when interaction frequency spikes.
- Improvement path: Keep layout mutations small and test-covered; prefer profiling specific action paths before broad cleanup.

**Background loops rely on polling sleeps:**

- Problem: Core backend services use repeated `time.Sleep` polling loops for telemetry, diagnostics, backup cleanup, and parts of remote readiness handling.
- Files: `cmd/server/main-server.go`, `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`
- Cause: Periodic loops are simple but can mask race conditions, delay shutdown, and complicate reproducibility of timing bugs.
- Improvement path: Replace fixed-delay readiness and shutdown coordination with event-driven signaling where practical; keep coarse scheduled jobs but isolate them from connection readiness paths.

**Proxy scheduler emits verbose per-request logging:**

- Problem: Channel selection and circuit-breaker paths log frequently during request handling.
- Files: `pkg/waveproxy/scheduler/scheduler.go`
- Cause: The scheduler logs active channels, selection decisions, and breaker state transitions on hot paths.
- Improvement path: Keep debug value, but gate verbose logs behind a debug flag or lower-noise logger before increasing proxy traffic volume.

## Fragile Areas

**Remote SSH/WSL + wsh bootstrap:**

- Files: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `cmd/wsh/cmd/wshcmd-connserver.go`, `pkg/shellexec/shellexec.go`
- Why fragile: This path spans local Electron/Go state, remote binary installation, shell quoting, JWT handoff, route registration, tmux integration, and OS-specific behaviors.
- Safe modification: Change one layer at a time, preserve current retry/self-heal behavior until a replacement is verified, and manually validate SSH + WSL flows after edits.
- Test coverage: No dedicated tests were detected for `pkg/wslconn/` or the SSH connserver bootstrap path.

**WaveProxy feature stack:**

- Files: `pkg/waveproxy/`, `frontend/app/view/proxy/`, `cmd/wsh/cmd/wshcmd-proxy.go`
- Why fragile: The feature combines persistent config, per-channel auth modes, scheduling, metrics, request history, remote sync, and compatibility endpoints.
- Safe modification: Keep protocol handling, scheduler policy, and UI config changes separate; verify with real upstream providers before release.
- Test coverage: No dedicated tests were detected for `pkg/waveproxy/` or `frontend/app/view/proxy/`.

**WaveConfig migration surface:**

- Files: `frontend/app/view/waveconfig/waveconfig-model.ts`, `frontend/app/view/waveconfig/waveconfig.tsx`
- Why fragile: The same UI exposes current files, deprecated files, secrets, and MCP settings, so changes can affect both migration behavior and current settings UX.
- Safe modification: Add new settings only to the current config set unless a compatibility requirement is explicit; keep deprecated-file handling read-compatible.
- Test coverage: No dedicated tests were detected for the WaveConfig UI/model layer.

**Terminal block controller concurrency:**

- Files: `pkg/blockcontroller/shellcontroller.go`, `pkg/blockcontroller/tsunamicontroller.go`
- Why fragile: Runtime state is coordinated through mutexes, atomics, background goroutines, block files, and process lifecycle callbacks, with open TODOs about synchronization.
- Safe modification: Avoid changing process lifecycle, status updates, and input channel behavior in the same patch unless required.
- Test coverage: No direct controller-focused tests were detected.

## Scaling Limits

**Single-process desktop orchestration:**

- Current capacity: The app centralizes Electron main-process coordination, renderer state, Go backend services, proxy features, and remote connection management inside one desktop distribution.
- Limit: Feature growth increases coupling between `emain/`, `frontend/`, and `pkg/`; regressions can propagate across process boundaries without strong compile-time isolation on the TypeScript side.
- Scaling path: Keep features modular by preserving backend/frontend boundaries and avoid introducing more cross-layer special cases for fork-only behavior.

**Proxy reliability depends on in-process scheduler state:**

- Current capacity: Circuit breakers and affinity maps live in memory in `pkg/waveproxy/scheduler/scheduler.go`.
- Limit: Runtime restarts drop scheduler memory, and debugging production-like balancing behavior becomes harder as channel counts and traffic patterns grow.
- Scaling path: If WaveProxy becomes central infrastructure rather than a convenience feature, persist only the minimum operational state needed for observability and recovery instead of expanding implicit in-memory behavior.

## Dependencies at Risk

**Electron auto-update dependency kept while disabled by default:**

- Risk: `electron-updater` remains installed and wired in `emain/updater.ts` even though TideTerm ships with auto-update disabled by default.
- Impact: Release engineering must maintain a feature that is not part of the default user path, and any fork-specific signing/feed mismatch can surface as breakage when users enable it.
- Migration plan: Keep the integration minimal, verify fork release feed/signing before enabling by default, and avoid expanding updater-specific UI until the release pipeline is stable.

**Fork-specific release pipeline is separate from upstream:**

- Risk: TideTerm intentionally does not use upstream release infrastructure.
- Impact: Every release requires TideTerm-specific validation of identifiers, docs, compliance docs, packaging, signing/notarization, and GitHub release behavior.
- Migration plan: Keep `RELEASES.md`, `MODIFICATIONS.md`, `RELEASE_NOTES_FORK_DIFF.md`, `package.json`, and `.github/workflows/build-helper.yml` aligned in each release cycle.

## Missing Critical Features

**Deterministic remote readiness contract:**

- Problem: Remote bootstrap still needs retries, sleeps, and route self-heal instead of an explicit ready signal.
- Blocks: Reliable automation of remote features, easier diagnosis of SSH/WSL regressions, and safe refactoring of connection startup.

**Comprehensive regression coverage for fork-only features:**

- Problem: Fork-defining features such as WaveProxy, MCP sync, remote tmux/session recovery, and config migration are present in production code but have little or no dedicated automated test coverage detected in-tree.
- Blocks: Confident upgrades, upstream merges, and low-risk refactors in the most differentiated TideTerm areas.

## Test Coverage Gaps

**Proxy stack:**

- What's not tested: No dedicated tests were detected for `pkg/waveproxy/` or `frontend/app/view/proxy/`.
- Files: `pkg/waveproxy/`, `frontend/app/view/proxy/`, `cmd/wsh/cmd/wshcmd-proxy.go`
- Risk: Auth mode handling, circuit breaking, compatibility routes, and UI/RPC wiring can regress unnoticed.
- Priority: High

**SSH/WSL connserver bootstrap and route healing:**

- What's not tested: No dedicated tests were detected for `pkg/wslconn/` or the SSH startup/route-heal logic in `pkg/remote/conncontroller/`.
- Files: `pkg/wslconn/wslconn.go`, `pkg/remote/conncontroller/conncontroller.go`, `cmd/wsh/cmd/wshcmd-connserver.go`
- Risk: Timing-sensitive connection bugs are likely to reappear when remote install, startup, or routing code changes.
- Priority: High

**WaveConfig migration and deprecated files:**

- What's not tested: No dedicated tests were detected for deprecated-file selection, persistence, and mixed current/deprecated config behavior.
- Files: `frontend/app/view/waveconfig/waveconfig-model.ts`, `frontend/app/view/waveconfig/waveconfig.tsx`
- Risk: Settings migrations can silently regress or strand users on outdated files.
- Priority: Medium

**Terminal/controller concurrency paths:**

- What's not tested: No dedicated tests were detected for process lifecycle races in shell and tsunami controllers.
- Files: `pkg/blockcontroller/shellcontroller.go`, `pkg/blockcontroller/tsunamicontroller.go`, `pkg/shellexec/shellexec.go`
- Risk: Start/stop/update races can create intermittent failures that are hard to reproduce from user reports.
- Priority: Medium

## Upstream Merge Sensitivity

**Fork identity touches many layers:**

- Issue: TideTerm-specific naming, config/data paths, env vars, remote helper paths, release metadata, and docs are intentionally different from upstream Wave.
- Files: `MODIFICATIONS.md`, `package.json`, `pkg/wavebase/wavebase.go`, `README.md`, `RELEASES.md`, `.github/workflows/build-helper.yml`
- Impact: Upstream merges that touch identity, paths, updater behavior, docs, or release automation require careful conflict resolution because a naive merge can reintroduce Wave branding or `~/.waveterm` assumptions.
- Fix approach: Treat fork identity changes as a protected surface; verify every upstream merge against `MODIFICATIONS.md` and release/compliance docs.

**Fork-only features create long-lived divergence:**

- Issue: TideTerm adds WaveProxy, MCP manager behavior, tmux session management, remote bootstrap fixes, bilingual UX, and other fork-specific changes not described as upstream defaults.
- Files: `MODIFICATIONS.md`, `frontend/app/view/proxy/`, `pkg/mcpconfig/`, `pkg/wshrpc/wshserver/tmux.go`, `frontend/app/modals/tmuxsessions.tsx`
- Impact: These areas are naturally conflict-prone during upstream sync because they modify high-churn product surfaces rather than isolated extension points.
- Fix approach: Prefer additive integration seams and keep a current feature-to-code map in `MODIFICATIONS.md` so future rebases can identify TideTerm-owned surfaces quickly.

## Likely Failure Modes

**Remote features fail after reconnect or first connect:**

- Failure mode: `connserver` installs or starts, but route registration lags, producing `no route for "conn:..."`-style failures or connection states that need self-heal.
- Files: `pkg/remote/conncontroller/conncontroller.go`, `pkg/wslconn/wslconn.go`, `pkg/wshutil/wshrouter.go`

**Shell startup breaks on edge-case quoting or environment overrides:**

- Failure mode: Remote shell, tmux, or cwd bootstrap opens in the wrong directory or fails to launch cleanly under uncommon shells, usernames, or path characters.
- Files: `pkg/shellexec/shellexec.go`, `pkg/blockcontroller/shellcontroller.go`

**Settings work regresses users on mixed old/new config files:**

- Failure mode: UI changes appear correct for current config files but overlook deprecated files still exposed in Settings.
- Files: `frontend/app/view/waveconfig/waveconfig-model.ts`, `frontend/app/view/waveconfig/waveconfig.tsx`

**Proxy health looks green while behavior is incomplete:**

- Failure mode: Operators trust proxy health/ping paths that are not fully implemented and only discover issues under real model traffic.
- Files: `pkg/waveproxy/rpc/rpc.go`, `pkg/waveproxy/scheduler/scheduler.go`

**Fork release artifacts drift from fork docs/compliance docs:**

- Failure mode: Packaging succeeds, but release metadata, docs, or compliance references drift from the actual fork baseline or enabled defaults.
- Files: `RELEASES.md`, `MODIFICATIONS.md`, `RELEASE_NOTES_FORK_DIFF.md`, `.github/workflows/build-helper.yml`, `package.json`

---

_Concerns audit: 2026-04-14_
