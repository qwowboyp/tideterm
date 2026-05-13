# pwsh-conpty-crash-tracker

## Description

Debug and track the known PowerShell ConPTY crash (0x80131623 / Win32 0xE9) in TideTerm on Windows. Triggers when investigating: pwsh exit code 2148734499 (0x80131623), `GetConsoleScreenBufferInfo` FailFast in Event Log, `pty-read loop received EOF waitDone=false` in wavesrv log, ConPTY pipe closed errors, or terminal stuck after TUI app (opencode/neovim/etc) exits.

## Investigation workflow

### 1. Confirm crash signature

Run `scripts/check-pwsh-crash.ps1` to check:
- PowerShell version (7.0+ .NET Core versions are affected)
- Windows Event Log for `0x80131623` / `GetConsoleScreenBufferInfo` / `.NET Runtime` FailFast
- ConPTY pipe error (Win32 0xE9 / ERROR_PIPE_NOT_CONNECTED)

### 2. Check wavesrv log pattern

Look for this exact sequence in the TideTerm log:

```
[shellproc] pty-read loop received EOF ... waitDone=false waitErr=<nil>
[shellproc] pty-read loop done
[shellproc] shell wait returned ... exit status 0x80131623 exitCode=2148734499 exitCodeHex=0x80131623
```

Key indicator: `waitDone=false` means pty EOF happened BEFORE TideTerm's wait loop finished, meaning the ConPTY pipe died first, THEN pwsh crashed.

### 3. Eliminate false positives

Before concluding it's the ConPTY crash:

- Check if TideTerm lifecycle instrumentation shows `ShellController.Stop` / `KillGraceful` / `Kill` before EOF. If yes, the crash is caused by TideTerm's stop path, not an external trigger.
- Check if the issue reproduces with `powershell.exe` (Windows PowerShell 5.1) instead of `pwsh.exe`. Windows PowerShell 5.1 is NOT affected by this bug. If it also crashes, it's a different issue.
- Check if the issue reproduces outside TideTerm (standalone pwsh, Windows Terminal, etc.)

### 4. Known root cause

This is an upstream PowerShell/.NET ConsoleHost bug, NOT a TideTerm bug:

- **Crash code**: `0x80131623` = `COR_E_EXECUTIONENGINE` = `FailFast`
- **Trigger**: After a TUI app (opencode, neovim, etc.) exits, ConPTY output pipe closes/signals EOF. PowerShell's `ConsoleHostRawUserInterface.get_CursorPosition()` calls `GetConsoleScreenBufferInfo` on the closed pipe, gets Win32 error 233 (ERROR_PIPE_NOT_CONNECTED / 0xE9), then calls `Environment.FailFast`.
- **Affected versions**: pwsh 7.2+ (.NET 7+), confirmed through pwsh 7.6.1 (.NET 10). Windows PowerShell 5.1 NOT affected.
- **Status**: Known issue. Multiple GitHub issues across PowerShell and microsoft/terminal repos, none resolved.

### 5. Workarounds

- **Use Windows PowerShell 5.1**: Set `term:localshellpath` to `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- **Downgrade pwsh**: Use pwsh 7.4.x or earlier (less frequent crashes, not guaranteed to fix)
- **Use alternative shell**: `cmd.exe`, bash (Git for Windows), or WSL

### 6. Restore original frontend behavior

The original TideTerm behavior handles normal shell exit (code 1) by restarting on Enter press. If the frontend's `done + Enter` restart was disabled, restore it in `frontend/app/view/term/term-model.ts`:

```ts
// Original: restart on Enter for all block types when shell is done/init
if ((shellProcStatus == "done" || shellProcStatus == "init") && keyutil.checkKeyPressed(waveEvent, "Enter")) {
    this.forceRestartController();
    return false;
}
```

## Upstream Tracking

**每次載入此技能時，必須執行以下追蹤檢查。** 檢查 `references/tracking-state.json` 的 `lastCheckDate`，若超過 30 天則執行完整追蹤。

### 追蹤清單

按優先順序檢查以下 repos：

| 優先順序 | Repo | 檢查內容 |
|----------|------|----------|
| 1 | `microsoft/terminal` #14511 | **主要追蹤目標** — 仍 OPEN，多次 REOPEN，是 ConPTY/pwsh crash 的主要追蹤 issue |
| 2 | `PowerShell/PowerShell` #16818 | 已關閉但無 fix，檢查是否有新的 linked issue/PR |
| 3 | `microsoft/terminal` #17716 | ConPTY pipe close ordering discussion，檢查是否有新的 API 或建議 |
| 4 | `sanshao85/tideterm` | 檢查是否有新的 pwsh/ConPTY 相關 PR 或 commit |
| 5 | `wavetermdev/waveterm` | 檢查上游是否加入 ConPTY 處理或 Windows shell crash recovery |
| 6 | `microsoft/node-pty` | 檢查 drain pattern 是否有更新或更好的實作 |

### 檢查步驟

```
1. 讀取 references/tracking-state.json 取得 lastCheckDate
2. 若距今 > 30 天，執行完整追蹤：
   a. 對每個 repo 執行 gh issue view / gh pr list 檢查狀態變化
   b. 搜尋新 issues：gh search issues --repo=<repo> "GetConsoleScreenBufferInfo OR 0x80131623 OR ConPTY crash"
   c. 搜尋新 commits：gh api repos/<owner>/<repo>/commits --jq '.[].message' | grep -i "conpty\|pwsh.*crash\|0x80131623"
   d. 若發現修復：更新 tracking-state.json 並在回應中明確通知使用者
   e. 更新 tracking-state.json 的 lastCheckDate
3. 若距今 ≤ 30 天，快速檢查：
   a. 僅檢查 #14511 和 #16818 的狀態是否變化
   b. 若有變化，執行完整追蹤
```

### 關鍵判斷標準

以下任一條件成立即代表**上游已修復**：

- `microsoft/terminal` #14511 被 closed 且有 linked PR with fix
- `PowerShell/PowerShell` 有新 PR 修改 `ConsoleHostRawUserInterface` 或 `ConsoleControl.GetConsoleScreenBufferInfo` 使其 graceful handle `ERROR_PIPE_NOT_CONNECTED`
- `wavetermdev/waveterm` 或 `sanshao85/tideterm` 加入 ConPTY pipe drain/shutdown ordering 處理
- pwsh 新版本 release notes 提及修復此 crash

### 追蹤結果記錄

所有追蹤結果更新至 `references/tracking-state.json`，格式：
- `lastCheckDate`: ISO 日期
- `trackedRepos[].issues[].status`: OPEN / CLOSED / MERGED
- `keyFindings.rootCauseUnfixed`: true/false

## Terminal-Side Workaround（研究結論）

基於上游研究，TideTerm 端**可以**實作 terminal-side workaround 來降低 crash 頻率（雖然無法完全消除 pwsh 上游 bug）：

### 模式：Pipe Drain Before ClosePseudoConsole

```go
// 在呼叫 ClosePseudoConsole 前，用 goroutine 持續 drain output pipe
func (c *ConPty) Close() error {
    c.inPipe.Close() // 先關閉 input

    done := make(chan struct{})
    go func() {
        io.Copy(io.Discard, c.outPipe) // drain 到 EOF
        close(done)
    }()

    select {
    case <-done:
    case <-time.After(3 * time.Second): // 3 秒超時
    }

    ClosePseudoConsole(c.handle)
    return c.outPipe.Close()
}
```

**參考實作**：
- node-pty PR #415（worker thread drain pattern）
- microsoft/terminal #14160（VtEngine non-blocking rundown）
- Windows 11 24H2+：`ClosePseudoConsole` 已改為立即返回

## Reference

- [references/known-issues.md](references/known-issues.md) — 上游 GitHub issues 完整清單與狀態
- [references/tracking-state.json](references/tracking-state.json) — 追蹤狀態與上次檢查時間
