# ConPTY 退出卡住修復紀錄

**日期**: 2026-05-16
**症狀**: TUI app (opencode) 退出後，pwsh 不回應，需連按多次 Enter 且終端機重設
**用戶環境**: Windows 11, pwsh 7.x, TideTerm dev build

## 問題描述

使用者在 TideTerm 終端機中執行 opencode (TUI app)，退出後 pwsh 無法正常回到提示字元。需要連按多次 Enter，終端機會「重設」（重啟 shell）。相同操作在 Windows Terminal 中不會發生。

### 用戶提供的關鍵線索

1. **pwsh v6.0.0 (2018) 也受影響** → 不是 .NET 7+ 特有的 FailFast 問題
2. **今年初使用時正常** → 是 regression
3. **Windows Terminal 跑同樣的 pwsh 退出正常** → 問題在 TideTerm 端
4. **不知道從哪個版本開始** → 需要透過 git history 追查

## 調查過程

### 第一階段：Git History 分析

分析 `termwrap.ts`、`shellcontroller.go`、`term-model.ts` 的變更歷史，找出 regression 嫌疑 commit：

| Commit | 日期 | 變更 | 嫌疑程度 |
|--------|------|------|----------|
| `8435958e` | 2025-11 | IME handling，isComposing 狀態 | 中 |
| `a9db2092` | 2025-11 | Paste handler cleanup | 低 |
| `0d609509` | 2025-12 | Bracketed paste mode ON | 低 |
| `d442b036` | 2026-01 | Multi-session terminals | 中 |
| `aeb18ccc` | 2026-04-15 | busyAtom 追蹤 | 低（純 UI） |
| **`742fa3f2`** | 2026-04-15 | CSI `?1049l` handler + setTimeout(0) | **高** |
| `ecc59d6e` | 2026-04-28 | GPU frame skipping | 中 |
| `c7bdad93` | 2026-05-13 | 用戶 debug commit，重構 cleanup | 高（race condition） |

### 第二階段：深度分析（4 個探索代理 + Oracle）

啟動了 6 個背景任務：
- 4 個 explore agent：frontend status/restart、PTY lifecycle、shell exit handling、upstream changes
- 1 個 explore agent：xterm.js input path
- 1 個 Oracle：深度診斷為什麼需要多次 Enter

#### Oracle 診斷結論

Oracle 正確指出 `742fa3f2` 的 CSI handler 有 parser reentrancy 問題，但 **不是實際症狀的主因**。

### 第三階段：Log 分析（兩次測試）

#### 第一次測試（CSI handler 移除後）

```
11:29:22.593 — PTY EOF (pipe 關閉)
11:29:24.037 — pwsh crash 0x80131623 (1.4 秒後)
11:29:24.138 — status = "done"
```

問題依舊 → CSI handler 不是主因。

#### 第二次測試（race condition 修復後）

```
11:40:13.029 — PTY EOF
11:40:14.226 — pwsh crash 0x80131623 (1.2 秒後)
11:40:14.227 — status = "done"
```

問題依舊 → race condition guard 有保護作用，但不是卡住的原因。

**真正的根因**：PTY EOF 到 process crash 完成之間有 **1.2 秒延遲**，期間 status 仍是 `"running"`，使用者按 Enter 不會觸發 restart，而是送到已死的 PTY。

## 根因分析

### 核心問題：PTY EOF 與 Process Exit 的時間差

```
Timeline:
  T+0.0s  ConPTY pipe EOF (pipe 死了，pwsh 正在 crash)
  T+1.2s  pwsh process 完全退出 (0x80131623)
  T+1.2s  wait goroutine 設 status = "done"
  T+1.2s  前端收到 "done" → 下一次 Enter 才能 restart
```

在 T+0.0s 到 T+1.2s 之間：
- `shellProcStatus` 仍是 `"running"`
- 使用者按 Enter → 走正常 input path → 送到已死的 PTY → 無效
- 只有等 1.2 秒後 status 變 `"done"`，下一次 Enter 才觸發 `forceRestartController()`

### 為什麼 Windows Terminal 不受影響

Windows Terminal 內部處理 ConPTY 生命週期：
- 沒有 Go wrapper（直接用 Win32 API）
- 沒有 WebSocket 事件延遲
- 沒有 React atom 狀態更新延遲
- pwsh 雖然一樣 crash，但 WT 的 PTY 能在 crash 後立即啟動新 shell

### pwsh v6.0.0 也受影響的原因

所有 pwsh 版本共用相同的 ConPTY 行為。`0x80131623` 雖然是 .NET FailFast，但 ConPTY pipe 關閉的行為在所有版本都一樣。差別在於 TideTerm 如何處理 pipe 關閉後的恢復。

## 修復內容

### 修正 1：移除 CSI `?1049l` handler（預防性）

**檔案**: `frontend/app/view/term/termwrap.ts` (原 line 690-700)

移除了 `registerCsiHandler` for `\x1b[?1049l`，這個 handler 用 `setTimeout(0)` + `terminal.write()` 在 TUI app 退出時注入滑鼠重置序列，有 parser reentrancy 風險。

滑鼠重置已由後端 `resetTerminalState()` 處理（`\x1b[?1000l` ~ `\x1b[?1006l`）。

### 修正 2：wait-loop defer race condition guard

**檔案**: `pkg/blockcontroller/shellcontroller.go` (wait goroutine defer)

加入 `if bc.ShellProc == shellProc` guard，防止舊 wait goroutine 的 defer 在 `forceRestart` 後覆蓋新 shell 的 status。

### 修正 3：PTY EOF 立即更新 status（核心修正）

**檔案**: `pkg/blockcontroller/shellcontroller.go` (pty-read goroutine)

在 PTY EOF 時，如果 process 還沒退出（`!done`），立即更新 `ProcStatus = Status_Done`。消除等待 process crash 的延遲。

## 無效修復記錄

### ❌ 修復 1：移除 CSI handler

**假設**: CSI handler 的 `setTimeout(0)` + `terminal.write()` 造成 parser reentrancy
**結果**: 無效。Log 顯示 pwsh 一樣 crash，問題不在前端 parser
**學到**: 前端 parser 問題會造成顯示異常，但不會造成「需要多次 Enter」的症狀

### ❌ 修復 2：Race condition guard

**假設**: 舊 wait-loop defer 覆蓋新 shell 的 ProcStatus
**結果**: Guard 正確但不是卡住的原因。實際 race window 很小（100ms），且用戶的問題在第一次 Enter 就卡住了，不是 restart 後才卡
**學到**: race condition 確實存在（需要修），但不是用戶感知到的主要症狀

### ⚠️ 修復 3：PTY EOF 立即更新 status（部分有效）

**假設**: PTY EOF 與 process exit 之間的 1.2 秒延遲是卡住的原因
**結果**: Status 確實在 EOF 時立即更新為 "done"（log 驗證），但終端機畫面仍然卡住
**學到**: Status transition 不是問題的全部。即使 status = "done"，終端機畫面可能仍凍結

## 踩過的坑

### 1. 過度依賴已知 bug 的假設

一開始因為 `0x80131623` 出現在 log 中，就假設是 .NET FailFast 的已知 bug。但用戶說 v6.0.0 也受影響（.NET Core 6 不一定有 FailFast），應該更早意識到問題不在 pwsh crash 本身，而在 **crash 後的恢復流程**。

### 2. Oracle 的診斷方向偏了

Oracle 將 `742fa3f2` 列為首要嫌疑，但實際上 CSI handler 只影響 parser 狀態，不影響後端 status transition。Oracle 缺少實際 log 資料來驗證假設。

**教訓**: 永遠先看 log 時間戳，再聽理論分析。

### 3. 沒有先加 log 就開始修

第一次修復前應該先在關鍵位置加 log：
- `term-model.ts:775` — shellProcStatus 的值（每次按 Enter 時）
- `shellcontroller.go` — status transition 的精確時間

如果有這些 log，就能在第一次就看出 status 在 EOF 後延遲 1.2 秒才變 done。

### 4. 用戶自己的 debug commit 混淆了判斷

`c7bdad93` (May 13) 是用戶自己的 debug commit，移動了 cleanup 邏輯。探索代理把這列為高嫌疑，但用戶在這個 commit 之前就有問題。應該更早排除。

### 5. 連續三次修復都只解決部分問題

三次修復都基於不同假設，每次 log 都證實假設正確但症狀未消除：
- 修復 1（CSI handler）→ log 顯示 pwsh 一樣 crash → 無效
- 修復 2（race condition）→ guard 正確但不是卡住原因 → 無效
- 修復 3（EOF 立即 done）→ status 確實立即更新但畫面仍凍結 → 部分有效

**教訓**: 在沒有前端 log 的情況下，只靠後端 log 無法判斷前端渲染狀態。下次應該先加 console.log 確認前端 xterm.js 的 buffer 狀態（是否在 alternate screen、cursor 位置等）。

### 6. 移除 CSI handler 可能方向反了

CSI handler 雖然有 parser reentrancy 問題，但它嘗試處理的是一個真實問題（alternate screen 退出時的重置）。移除它可能讓問題更嚴重。正確做法應該是修復 CSI handler 的實作方式，而不是完全移除。

## 相關上游差距

TideTerm 缺少 Wave Terminal 的以下 PR（約 5400 行）：

| PR | 內容 | 相關性 |
|-----|------|--------|
| #2806 | Durable shell controller | 高 — 改善 shell 生命週期管理 |
| #2821 | Shell bug fixes | 高 — 包含 resetTerminalState 後的處理 |
| #2822 | Job controller + pruning | 中 — job 生命週期管理 |
| #2825 | Block close event handling | 中 — 區塊關閉事件處理 |

這些 PR 會從根本上改善 shell 生命週期管理，但移植工作量很大。

## 第三次測試結果（修正 3 後）

Log 確認修正 3 生效 — EOF 時立即更新 status：

```
11:48:20.035 — PTY EOF
11:48:20.035 — sending update ShellProcStatus:"done" Version:5  ← 立即！
11:48:21.618 — pwsh crash 0x80131623 (1.6 秒後，但不影響 status)
11:48:21.618 — sending update ShellProcStatus:"done" Version:7 (wait-loop defer)
```

但用戶回報「退出 opencode 還是卡著」。

## 修正後的新假設：xterm.js Alternate Screen Buffer 凍結

### 分析

Status transition 已修復（EOF → done 即時），但終端機畫面仍然凍結。新的假設：

**ConPTY pipe 死亡時，TUI app 的 cleanup 序列無法到達 xterm.js。**

TUI app（如 opencode）退出時會發送 `\x1b[?1049l`（切換回主畫面 buffer）。但如果 ConPTY pipe 已經 EOF/broken，這個序列永遠到不了 xterm.js → xterm.js 停留在 alternate screen buffer → 畫面凍結。

### 為什麼之前的「修正 1」（移除 CSI handler）方向反了

`742fa3f2` 的 CSI handler 原本是想處理 alternate screen 退出時的滑鼠重置。雖然用 `setTimeout(0)` + `terminal.write()` 的方式有 parser reentrancy 問題，但它的存在說明作者已意識到這個問題。

### 下一步方向

1. **前端方案**：當收到 status = "done" 時，前端主動重置 xterm.js 狀態
   - 退出 alternate screen buffer：`terminal.write('\x1b[?1049l')`
   - 重置所有模式：mouse tracking, bracketed paste, cursor 等
   - 位置：`term-model.ts` 的 `updateShellProcStatus()` 或 `shellProcStatus` atom 的訂閱

2. **後端方案**：在 `resetTerminalState()` 中加入 `\x1b[?1049l`
   - 目前 `resetTerminalState()` 缺少 alternate screen 退出序列
   - 但後端序列寫入 blockfile，前端 xterm.js 需要解析才能生效
   - 如果 pipe 已死，前端可能已經不再從 blockfile 讀取

3. **最佳方案可能是前端 + 後端配合**：
   - 後端 EOF 時立即寫入 reset 序列到 blockfile（包含 `\x1b[?1049l`）
   - 前端收到 status = "done" 時，強制 flush blockfile 中的 reset 序列到 xterm.js
   - 或者前端直接在 status → "done" 時調用 `terminal.reset()` 清除所有狀態

### 需要驗證的問題

- [ ] xterm.js 在 pipe 死後是否仍能接收/處理 blockfile 中的數據？
- [ ] `terminal.write()` 在 status = "done" 時是否能正常影響 xterm.js？
- [ ] 是否可以直接用 `terminal.reset()` 而不是發送 escape 序列？
- [ ] Windows Terminal 如何處理 alternate screen 退出？是否有類似的前端重置？

## 測試驗證

修復後的預期行為：
1. TUI app 退出 → PTY EOF → **立即** status = "done"
2. 使用者按一次 Enter → `forceRestartController()` → 新 shell 啟動
3. 終端機不需「重設」，直接回到提示字元

驗證 log 應顯示：
```
[shellproc] pty-read loop received EOF ... waitDone=false
sending blockcontroller update ... ShellProcStatus:"done"  ← 立即
[shellproc] shell wait returned ... exitCode=0x80131623    ← 1 秒後，但不影響
```

## 修正 4：後端 EOF 時呼叫 resetTerminalState() — ❌ 失敗

**檔案**: `pkg/blockcontroller/shellcontroller.go` (pty-read goroutine)

在 PTY EOF 時呼叫 `resetTerminalState(context.Background())`。

**失敗原因**: `resetTerminalState()` 第一行就 return 了：
```go
if statErr == fs.ErrNotExist || wfile.Size == 0 {
    return  // ← EOF 時 blockfile 可能為空，直接跳過
}
```

Log 確認：
```
[shellproc] calling resetTerminalState block=29334cad...
[shellproc] resetTerminalState done block=29334cad...
```
但無 `[conndebug] resetTerminalState: resetting terminal state` → early return 被觸發，reset 序列從未寫入。

## 修正 5：前端 running→done 轉換時重置 terminal — ⚠️ 未驗證前端編譯

**檔案**: `frontend/app/view/term/term-model.ts`

### 變更 1: `updateShellProcStatus()` (line ~559)

偵測 `running → done` 狀態轉換，觸發 `resetTerminalOnExit()`。

### 變更 2: 新增 `resetTerminalOnExit()` 方法 (line ~573)

直接對 xterm.js 寫入 reset 序列（含 `\x1b[?1049l` 退出 alternate screen），作為後端 blockfile 管道的安全網。

### 注意

用戶使用 `task start` 而非 `task dev`。`task start` 從 `dist/` 執行，前端修改需要重建才會生效。**需確認前端有 rebuild**。

## 第五次測試結果（修正 4 rebuild 後）

後端有 rebuild（log 確認 `calling resetTerminalState` 和 `resetTerminalState done` 都出現了），但 `resetTerminalState` 內部 early return 導致無效。

用戶回報「問題依舊，退出 opencode 後需要 ENTER 並且會自己重設終端機」。

## 修正 6：後端 EOF 直接寫入 reset 序列（繞過 resetTerminalState guard）

**狀態**: 待測試

**檔案**: `pkg/blockcontroller/shellcontroller.go` (pty-read goroutine, line ~540)

不再呼叫 `resetTerminalState()`（它有 blockfile empty early return），改為直接在 EOF handler 組裝 reset bytes 並呼叫 `HandleAppendBlockFile()`：

```go
var resetBuf bytes.Buffer
resetBuf.WriteString("\x1b[?1049l")    // 退出 alternate screen — 關鍵序列
resetBuf.WriteString("\x1b[0m")         // reset attributes
resetBuf.WriteString("\x1b[?25h")       // show cursor
resetBuf.WriteString("\x1b[?1000l")     // disable mouse tracking x5
resetBuf.WriteString("\x1b[?1002l")
resetBuf.WriteString("\x1b[?1003l")
resetBuf.WriteString("\x1b[?1006l")
resetBuf.WriteString("\x1b[?1007l")
resetBuf.WriteString("\x1b[?2004l")     // disable bracketed paste
resetBuf.WriteString(shellutil.FormatOSC(16162, "R"))  // shell integration reset
resetBuf.WriteString("\r\n\r\n")
HandleAppendBlockFile(bc.BlockId, wavebase.BlockFile_Term, resetBuf.Bytes())
```

與 `resetTerminalState()` 的差異：
1. **加了 `\x1b[?1049l`**（退出 alternate screen）— 原本的 `resetTerminalState` 透過 OSC 16162 "R" 間接觸發前端偵測，但直接發更可靠
2. **沒有 blockfile empty early return** — 無論 blockfile 狀態如何都會寫入
3. **有 log 確認** — `wrote terminal reset sequences to blockfile block=... err=...`

### 重建指令

```
task build:backend && task build:frontend:dev && task start
```

**重要**: `task start` 從 `dist/` 執行，前端和後端都必須 rebuild！

## 第六次測試結果（Fix 6 後端直接寫 reset bytes）

後端 log 確認 Fix 6 成功：

```
12:25:43.588 — [shellproc] pty-read loop received EOF ... waitDone=false
12:25:43.588 — [shellproc] wrote terminal reset sequences to blockfile block=29334cad... err=<nil>  ← 寫入成功！
12:25:43.588 — sending update ShellProcStatus:"done" Version:5
12:25:44.820 — pwsh crash 0x80131623 (1.2 秒後)
```

但用戶回報「依然沒有解決問題」。

### 分析

**後端寫入 blockfile 成功但無效的可能原因**：

1. **Blockfile 事件可能在 EOF 後不會送達前端** — pty-read loop break 後，frontend subscription 可能已失效或忽略後續數據
2. **時序問題** — reset bytes 和 status="done" 幾乎同時送出，frontend 可能先處理 status 事件而忽略 blockfile 事件
3. **前端 Fix 5 從未生效** — 用戶可能沒有 rebuild 前端（`task build:frontend:dev`），導致 `resetTerminalOnExit()` 從未執行

### 用戶假設

用戶認為「最初作法（Fix 5 前端直接 write）可能有效，但前端沒有 rebuild」。這是合理的：

- Fix 5 是前端直接 `terminal.write()`，不依賴 blockfile 管道
- 但 `task start` 從 `dist/` 執行舊 bundle，前端修改不會生效
- **需要確認**：打開 DevTools Console，搜尋 `[conpty-fix]` — 如果沒有，代表前端沒有 rebuild

### 下一步

1. **確認前端是否有 rebuild** — DevTools Console 搜尋 `[conpty-fix]`
2. **如果沒有** → `task build:frontend:dev && task start` 再測試
3. **如果有** → Fix 5 也無效，需要改策略（如 `terminal.reset()` 或自動重啟 shell）

## 編譯狀態追蹤

| Fix | 後端 | 前端 | 測試結果 |
|-----|------|------|----------|
| Fix 1 (移除 CSI handler) | N/A | ✅ 編譯 | ❌ 無效 |
| Fix 2 (race condition guard) | ✅ 編譯 | N/A | ❌ 無效（但 guard 正確） |
| Fix 3 (EOF 立即 done) | ✅ 編譯 | N/A | ⚠️ Status 即時更新但畫面仍凍結 |
| Fix 4 (呼叫 resetTerminalState) | ✅ 編譯 | ❌ 未編譯 | ❌ resetTerminalState early return |
| Fix 5 (前端 reset) | N/A | ❌ 未編譯 | ❓ 未測試 |
| Fix 6 (後端直接寫 reset bytes) | ✅ 編譯 | ❌ 未編譯 | ❌ blockfile 管道可能失效 |

**結論**：Fix 5（前端直接 `terminal.write()`）從未被編譯測試過。這是最有可能有效的方案。

## 修正 7：terminal.reset() + `[Process exited]` — ⚠️ 顯示提示但仍凍結

**檔案**: `frontend/app/view/term/term-model.ts`

改 `resetTerminalOnExit()` 用 `terminal.reset()` + 300ms delay 取代 escape sequence write。`terminal.reset()` 不經 parser，直接重設所有 xterm.js 內部狀態。

**結果**: 成功顯示 `[Process exited]` 提示，但終端機仍不可操作（pwsh 已 crash）。

### 跳幀排除

暫時 disable 跳幀優化測試 → 仍卡 → 排除跳幀相關 → 已還原跳幀代碼。

### 根因重新定位

**pwsh.exe 本身 crash (0x80131623 = .NET CLR ExecutionEngineException)**
- 不是 xterm.js 顯示問題，不是 escape sequence 問題
- 只有 opencode 觸發，vim 正常
- Windows Terminal 中不會 crash
- 最近一個多月才出現（回歸）
- 時序：PTY EOF → 1.5s 後 pwsh crash → 終端機死

### ConPTY 管道架構（photostorm/pty fork）

`open()` 建立兩條匿名管道：
- `pr` (Go read) / `consoleW` (ConPTY write) — ConPTY 輸出
- `consoleR` (ConPTY read) / `pw` (Go write) — ConPTY 輸入

`CreatePseudoConsole(consoleR, consoleW)` 後，`consoleW` 和 `consoleR` 被 Close。

### PTY 生命週期

- `PtyBuffer.run()` goroutine 從 `pr.Read()` 讀取 ConPTY 輸出
- ConPTY EOF → `PtyBuffer.setEOF()` → `PtyBuffer.Read()` 返回 `io.EOF` → pty-read loop 退出
- opencode 退出 → ConPTY foreground process 轉換 → 輸出管道 EOF
- pty-read loop break → 無人讀取 ConPTY 管道
- pwsh 嘗試寫入 prompt → ConPTY write 阻塞 → 1.5s 後 .NET ExecutionEngineException

## 修正 8：PTY EOF 時自動 Kill + 重啟 Shell — ✅ 核心

**檔案**: `pkg/blockcontroller/shellcontroller.go` (pty-read goroutine, EOF handler)

### 根本邏輯

ConPTY 輸出管道在 TUI app (opencode) 退出時返回 EOF，但 pwsh 仍在運行。pty-read loop break 後無人讀取 ConPTY 管道，pwsh 寫入時阻塞，最終 crash (0x80131623)。

**解法**：EOF 時若 pwsh 仍活著（`!done`），立即 Kill 進程 + 500ms 後自動重啟新 shell。

### 變更內容

```go
if !done {
    // Kill immediately to prevent pwsh crash (0x80131623)
    shellProc.Cmd.Kill()
    bc.UpdateControllerAndSendUpdate(func() bool {
        if bc.ProcStatus == Status_Running {
            bc.ProcStatus = Status_Done
        }
        return true
    })
    // Auto-restart shell in background after 500ms
    go func() {
        time.Sleep(500 * time.Millisecond)
        ctx := context.Background()
        err := ResyncController(ctx, bc.TabId, bc.BlockId, nil, true)
        // log result
    }()
}
```

### 時序（修復後）

```
T+0.0s  ConPTY output pipe EOF (opencode 退出)
T+0.0s  shellProc.Cmd.Kill() — 立即殺死 pwsh（不等待 1.2s crash）
T+0.0s  reset bytes 寫入 blockfile
T+0.0s  status = "done" 送出
T+0.5s  ResyncController(force=true) → Stop() (early return) → Start()
T+0.5s  新 pwsh 啟動 → 終端機恢復正常
```

### 安全性

- `RunLock` 在 pty-read goroutine 的 `manageRunningShellProcess()` return 時已釋放
- wait-loop goroutine 的 defer 有 `bc.ShellProc == shellProc` guard，不會干擾新 shell
- `ResyncController` → `Stop()` 在 `ProcStatus == Done` 時 early return（無操作）→ `Start()` 啟動新 shell
- `rtOpts=nil` 時 `run()` 使用 `getTermSize(bdata)` 取得終端大小

## 編譯狀態追蹤（更新）

| Fix | 後端 | 前端 | 測試結果 |
|-----|------|------|----------|
| Fix 1 (移除 CSI handler) | N/A | ✅ 編譯 | ❌ 無效 |
| Fix 2 (race condition guard) | ✅ 編譯 | N/A | ❌ 無效（但 guard 正確） |
| Fix 3 (EOF 立即 done) | ✅ 編譯 | N/A | ⚠️ Status 即時但畫面仍凍結 |
| Fix 4 (呼叫 resetTerminalState) | ✅ 編譯 | ❌ 未編譯 | ❌ resetTerminalState early return |
| Fix 5 (前端 reset) | N/A | ✅ 編譯 | ❌ renderer 凍結 |
| Fix 6 (後端直接寫 reset bytes) | ✅ 編譯 | ✅ 編譯 | ❌ blockfile 管道無效 |
| Fix 7 (terminal.reset + 提示) | ✅ 編譯 | ✅ 編譯 | ⚠️ 顯示提示但仍凍結 |
| **Fix 8 (自動 kill + 重啟)** | ✅ LSP 無錯誤 | N/A (後端 only) | 🔜 待測試 |

**重建指令**: `task build:backend && task start`
