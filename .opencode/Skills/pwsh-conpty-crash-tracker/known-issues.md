# pwsh ConPTY Crash - Known Issues & Upstream Tracking

> **Last verified**: 2026-05-04
> **Next check**: Triggered by `Upstream Tracking` workflow in SKILL.md

## Primary Issue

### PowerShell/PowerShell #16818 (2022-01)
**pwsh faulting when using Ansi alternate screen buffer**
https://github.com/PowerShell/PowerShell/issues/16818

- Exact same crash: `0x80131623`, `GetConsoleScreenBufferInfo`, `0xE9`
- Triggered by `ESC[?1049l` (alternate screen exit)
- Affects pwsh 7.2.1+
- **Status**: **CLOSED (2023-08-07) without a fix**. Closed by @theJasonHelmick as "Needs-Repro" / "Waiting on Author" — maintainers could not reproduce. **No PR was ever merged.**

## Related Issues

### microsoft/terminal #14511 (2022-12) ⭐ PRIMARY TRACKING ISSUE
**Terminal closes when pwsh crashes with PSReadLine after session resume**
https://github.com/microsoft/terminal/issues/14511

- Same crash: `0x80131623`, `GetConsoleScreenBufferInfo`, `0xE9`
- Triggered by OS sleep/resume
- Has 33+ comments, closed and **REOPENED** multiple times
- Labeled: `Area-Server`, `Priority-3`, `Needs-Repro`
- **Status**: **OPEN (REOPENED)** — still active

### microsoft/terminal #16212 (2023-10)
**Stable Terminal crashes when cursor reaches console end**
https://github.com/microsoft/terminal/issues/16212

- Same crash stack trace
- Triggered by script output reaching console end
- Closed with: "Same as PowerShell bug, track in #14511"
- **Status**: Closed (duplicated to #14511)

## ConPTY Shutdown Fixes (microsoft/terminal)

### microsoft/terminal #14160 / PR #14282 (2022-10)
**Fix deadlock during ConPTY shutdown**

- Root cause: `ClosePseudoConsole` waited for client exit, but client's write filled output pipe → deadlock
- Fix: VtEngine no longer blocks on `RundownAndExit` when pipe is broken
- **Impact**: Reduces ConPTY-side deadlock, but does NOT fix pwsh's FailFast behavior

### microsoft/terminal #17510 (2024)
**Cursor inheritance timeout for PSEUDOCONSOLE_INHERIT_CURSOR**

- Added 3-second timeout for cursor inheritance
- Prevents indefinite hang during ConPTY startup
- **Impact**: Related to ConPTY robustness, not directly our crash

### microsoft/terminal #17716 (Discussion)
**ConPTY pipe close ordering**
https://github.com/microsoft/terminal/discussions/17716

- MS engineer @miniksa: "close the handles you're not intending to listen to anymore before calling ClosePseudoConsole"
- MS engineer @lhecker: "continue reading from output pipe until ReadFile returns FALSE or lpNumberOfBytesRead is zero"
- **Windows 11 24H2+ (build 26100+)**: `ClosePseudoConsole` now **returns immediately** to avoid deadlocks
- **Impact**: This is the key guidance for terminal-side workarounds

## Other Terminal Workarounds

### node-pty (VS Code) — PR #415
**Host conout socket in a worker thread**
https://github.com/microsoft/node-pty/pull/415

- Pattern: Dedicated worker thread drains output pipe before `ClosePseudoConsole`
- Uses `FLUSH_DATA_INTERVAL = 1000ms` delay before closing
- **This is the most battle-tested workaround pattern**

### WezTerm
- Same problem acknowledged by MS engineer @lhecker
- WezTerm "fails to read from the output pipe when calling ClosePseudoConsole"
- No known fix implemented yet

## PowerShell/PowerShell #15254
**SetConsoleCursorPosition 0x57 crash**
- Race condition variant of the same ConPTY issue
- Fixed in pwsh v7.2.0-preview.6

## TideTerm-specific Context

- **Eliminated root causes**: frontend Enter restart, backend read-loop lifecycle, pty module (both photostorm and creack/pty), PowerShell integration script, startup mode (-File vs -Command vs bare), controller Stop/Close/Kill, frontend mouse reset (742fa3f2)
- **Only workaround confirmed effective**: Use `powershell.exe` (Windows PowerShell 5.1) instead of `pwsh.exe`
- **Original fork test**: exit code 1 (normal), not 0x80131623 — confirms the crash is from pwsh version change, not TideTerm code changes
- **No fix exists in TideTerm repo**: No issues, PRs, or commits mention 0x80131623, ConPTY, or GetConsoleScreenBufferInfo
- **No fix exists in Wave Terminal upstream** (wavetermdev/waveterm): Windows jobmanager is a stub, no ConPTY-specific code

## Wave Terminal Upstream Status

| Item | Status |
|------|--------|
| Windows jobmanager | Stub only (`daemonize not supported on windows`) |
| ConPTY-specific code | **None exists** |
| Shell crash recovery | PR #2822 "More Durable Shell Bug Fixes" — lifecycle fixes, not ConPTY |
| pwsh-specific handling | noprofile/noninteractive flags added (PR #2959) |
| 0x80131623 handling | **Not implemented** |
