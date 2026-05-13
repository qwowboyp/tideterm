# pwsh ConPTY Crash - Known Issues

## Primary Issue

### PowerShell/PowerShell #16818 (2022-01)
**pwsh faulting when using Ansi alternate screen buffer**
https://github.com/PowerShell/PowerShell/issues/16818

- Exact same crash: `0x80131623`, `GetConsoleScreenBufferInfo`, `0xE9`
- Triggered by `ESC[?1049l` (alternate screen exit)
- Affects pwsh 7.2.1+
- **Status**: Open. Cannot reproduce consistently.

## Related Issues

### microsoft/terminal #14511 (2022-12)
**Terminal closes when pwsh crashes with PSReadLine after session resume**
https://github.com/microsoft/terminal/issues/14511

- Same crash: `0x80131623`, `GetConsoleScreenBufferInfo`, `0xE9`
- Triggered by OS sleep/resume
- **Status**: Open. Labeled `Needs-Repro`.

### microsoft/terminal #16212 (2023-10)
**Stable Terminal crashes when cursor reaches console end**
https://github.com/microsoft/terminal/issues/16212

- Same crash stack trace
- Triggered by script output reaching console end
- MS team noted: entire ConPTY rendering code was rewritten in v1.19
- **Status**: Duplicated to issue #16199.

### PowerShell/PowerShell #15254
**SetConsoleCursorPosition 0x57 crash**
- Race condition variant of the same ConPTY issue
- Fixed in pwsh v7.2.0-preview.6

## Microsoft/ConPTY Design Issues

### microsoft/terminal #1810
**ConPTY deadlock / EOF signaling**
- ConPTY doesn't properly signal EOF to child processes
- Must drain output pipe in separate thread
- https://github.com/microsoft/terminal/issues/1810

### microsoft/terminal #17716 (Discussion)
**ConPTY pipe close ordering**
- ClosePseudoConsole should be preceded by closing/breaking output pipe
- Windows 11 24H2+ has improved behavior
- https://github.com/microsoft/terminal/discussions/17716

## TideTerm-specific Context

- **Eliminated root causes**: frontend Enter restart, backend read-loop lifecycle, pty module (both photostorm and creack/pty), PowerShell integration script, startup mode (-File vs -Command vs bare), controller Stop/Close/Kill, frontend mouse reset (742fa3f2)
- **Only workaround confirmed effective**: Use `powershell.exe` (Windows PowerShell 5.1) instead of `pwsh.exe`
- **Original fork test**: exit code 1 (normal), not 0x80131623 — confirms the crash is from pwsh version change, not TideTerm code changes
