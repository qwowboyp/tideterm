# TideTerm 透明視窗修復 — 踩坑記錄

## 原始問題

使用者啟用終端透明度（40%）後，Windows 視窗**無法拖曳調整大小**，且**右上角的最大化按鈕消失**。

---

## 根因分析

### 因果鏈
1. `settingscontent.tsx:129` → `setGlobalTransparency(0.4)` 設定 `"window:transparent": true`
2. `emain-window.ts:197` → `winOpts.transparent = true` → Electron 建立透明視窗
3. Windows 透明視窗使用 `WS_EX_LAYERED` 模式
4. DWM 不再處理 non-client area（resize border / title bar / window controls）
5. **結果**：無法 resize、右上角按鈕消失

### 附帶 bug
- `settingscontent.tsx:129`: `...(nextValue > 0 ? { "window:transparent": true } : {})`
- 當透明度設為 0 時，`window:transparent` 不會被清除 → `true` 永遠殘留

---

## 已成功解決的部分

### 1. 自訂視窗 Resize Handles
**檔案**: `frontend/app/windowresizehandles.tsx`
- 8 個 `position: fixed` 隱形 div（邊緣 6px + 角落 12px）
- mousedown 記錄初始 bounds，mousemove 計算 delta
- 透過 IPC 呼叫 main process `win.setBounds()`
- 最小尺寸限制：800×500
- 僅 win32 + transparent 時渲染

**IPC**: `get-transparent-window-bounds` / `resize-transparent-window`

### 2. 自訂視窗標題按鈕（最小化/最大化/關閉）
**檔案**: `frontend/app/windowtitlecontrols.tsx`
- 3 個 `position: fixed` 按鈕，位於右上角 (right: 0/46/92)
- 最小化 → `minimizeWindow` IPC
- 最大化/還原 → `maximizeWindow` IPC（main process 記錄 restore bounds）
- 關閉 → `closeWindow` IPC

**IPC**: `minimize-window` / `maximize-window` / `unmaximize-window` / `close-window` / `is-maximized`

### 3. F11 全螢幕修復
**檔案**: `emain/emain-window.ts`
- 新增內部狀態 `isWaveFullScreen`
- `enter-full-screen` → set true，註冊 `globalShortcut("F11")` fallback
- `leave-full-screen` → set false，解除註冊
- `toggleWaveFullScreen()` 用內部狀態判斷，不依賴 `isFullScreen()`（frameless 下不可靠）

### 4. Tabbar drag region 修復
**檔案**: `frontend/app/tab/tabbar.scss`
- `.tab-bar-wrapper` 從 `width: 100vw` 改為 `width: calc(100vw - 138px)`（透明模式）
- 預留右上角 138px 給自訂按鈕，避免 `-webkit-app-region: drag` 攔截點擊
- `padding-top: 6px` → `margin-top: 6px`，讓上方 6px 給 resize handle

### 5. Settings Bug 修復
**檔案**: `frontend/app/view/waveconfig/settingscontent.tsx:129`
- `{}` → `{ "window:transparent": false }`，透明度歸零時明確關閉

### 6. 最終視窗設定（穩定版）
**檔案**: `emain/emain-window.ts`
```typescript
// win32 transparent
winOpts.titleBarStyle = "hidden";
winOpts.titleBarOverlay = false;  // 不用原生 overlay（會跟自訂按鈕重疊）
winOpts.transparent = true;
winOpts.resizable = true;
winOpts.minimizable = true;
winOpts.maximizable = true;
winOpts.thickFrame = true;
```

---

## ✅ 已解決：FancyZones 自動調整大小（方案 #12 成功）

### 現狀
- ✅ FancyZones **可以**將視窗移動到 zone 位置
- ✅ 視窗**自動**調整大小以適配 zone（由我們自己完成 resize）

### 解決策略
**繞過而非對抗**：接受 FancyZones 無法對 `WS_EX_LAYERED` 視窗 resize 的硬限制，改為偵測 FancyZones 的移動操作後，由我們自己用 `setBounds()` 完成 resize。

### 根因
FancyZones 原始碼 `AdjustRectForSizeWindowToRect()` 檢查 `WS_SIZEBOX`（即 `WS_THICKFRAME`, `0x40000`）：
```cpp
if ((::GetWindowLong(window, GWL_STYLE) & WS_SIZEBOX) == 0) {
    // 保持原始大小，不改變
    newWindowRect.right = newWindowRect.left + (windowRect.right - windowRect.left);
    newWindowRect.bottom = newWindowRect.top + (windowRect.bottom - windowRect.top);
}
```

Electron 的 `transparent: true` 在內部會強制移除 `WS_THICKFRAME`（參考 PR #40370/#48378）。
Electron 原始碼 `FlipWindowStyle` 在透明模式下會將 `thickFrame` 設為 `false`。

### 已嘗試的失敗方案

| # | 方案 | 結果 |
|---|------|------|
| 1 | `setResizable/setMinimizable/setMaximizable(true)` after `super()` | 無效，Electron 內部覆蓋 |
| 2 | `titleBarOverlay: { height: 0 }` | 無效，視窗 style flag 未被設定 |
| 3 | `titleBarOverlay: { color: "#00000000" }` | FancyZones 有效，但原生按鈕與自訂按鈕重疊 |
| 4 | PowerShell `SetWindowLongPtr` 加入 `WS_THICKFRAME` | 破壞透明效果 |
| 5 | Polling `setInterval` 偵測移動後補 `setBounds()` | 任何移動都觸發，導致隨機最大化/亂改尺寸 |
| 6 | `hookWindowMessage(WM_WINDOWPOSCHANGED)` + 事件驅動 | 無效，訊息可能未觸發或 `setBounds()` 被覆蓋 |
| 7 | 動態 `WS_THICKFRAME` (`WM_ENTERSIZEMOVE` hook + koffi) | FancyZones 仍不 resize：**FancyZones 使用低階 `WH_MOUSE_LL` hook 攔截輸入，在 `WM_ENTERSIZEMOVE` 發送前就完成 style 檢查，hook 時序永遠落後** |
| 8 | 永久 `WS_THICKFRAME` (koffi `SetWindowLongPtrW` + polling) | **style flag 確認已設（`hasThickFrame=true`），無 reversion，但 FancyZones 仍不 resize** — 說明 `transparent: true` + `titleBarOverlay: false` 組合下，Chromium/Electron 層面有 style flag 以外的限制 |
| 9 | `titleBarOverlay` 策略（讓 Electron 自然保留 WS_THICKFRAME） | ❌ FancyZones 仍不 resize；**額外副作用**：最大化/最小化原生按鈕與自訂按鈕重疊、最大化按鈕行為異常 |
| 10 | **`titleBarOverlay` + 原生 WCO 按鈕**（捨棄自訂按鈕、直接用原生 Windows 控制按鈕） | ❌ **FancyZones 仍不 resize**；**新問題**：(1) 最大化/最小化圖標重疊 (2) 最大化按鈕實際觸發最小化 — `titleBarStyle: "hidden"` + `titleBarOverlay` 組合導致 WCO 行為異常 |

### ✅ 當前狀態：問題已解決

FancyZones 自適應 resize 在透明視窗模式下**已可正常運作**。方案 #12（自偵測 + 自 resize）成功繞過硬限制。

**核心突破**：
- 不再嘗試讓 FancyZones 完成 resize（10 種方案證明不可行）
- 改為偵測 FancyZones 的**移動操作**，然後由我們自己用 `this.setBounds()` 完成 resize
- `this.setBounds()` 對透明視窗有效（自訂 resize handles 已驗證），問題僅限於**外部 process 呼叫 `SetWindowPlacement`**
- 無需 `koffi`、Win32 FFI、DWM 屬性修改 — 純 Electron + Node.js `fs`

### 關於 Electron PR #49428

PR #49428（`fix: user resizable transparent windows on win32`，Electron v39.2.7+ 已合併，backport 至 39~42）修復的是**使用者手動拖曳邊框 resize**，將 `CanResize()` 對 frameless 視窗改為只檢查 `resizable_`（不再要求 `thick_frame_`）。

**但與 FancyZones 無關**：FancyZones 的 resize 路徑是 `SetWindowPlacement` → 前置檢查 `GetWindowLong(GWL_STYLE) & WS_SIZEBOX` → 這與 Chromium 的 `CanResize()` 是**獨立判斷路徑**。#49428 修的是 widget 層 resize 權限，沒碰 Win32 style flag。**升級 Electron 不會解決此問題**。

### 已回退方案 #10

### 方案 #12：繞過 FancyZones resize，自行完成（✅ 成功）

#### 思路
接受 FancyZones 無法對 `WS_EX_LAYERED` 視窗 resize 的硬限制。不再嘗試修改 style flag、DWM 屬性、或 Electron 內部行為。改為：
1. **讓 FancyZones 做它能做的**：移動視窗到 zone 位置（這部分對 layered window 有效）
2. **我們自己做它做不了的**：讀取 FancyZones 設定檔取得 zone 尺寸，用 `this.setBounds()` resize

#### 實作
**檔案**：`emain/emain-window.ts`

**模組層級輔助函式**（無狀態，純 Node.js）：
- `getFancyZonesConfigDir()` — 讀取 `%LOCALAPPDATA%\Microsoft\PowerToys\FancyZones\`
- `readAndComputeFancyZones()` — 解析 `custom-layouts.json`，將 zone 相對座標（ref-width/ref-height）轉為螢幕絕對像素
- `findZoneAt()` — O(n) 掃描所有 zone，找左上角匹配的

**WaveBrowserWindow 方法**：
- `setupFancyZonesSnapResize()` — 註冊 `move` 事件監聽
  - 偵測「位置大跳躍 (>40px) + 尺寸不變 (≤5px)」— FancyZones snap 特徵
  - 250ms debounce 等待移動穩定
  - 防禦：`isDestroyed()` / `fullScreen` 檢查
- `trySnapResize()` — 兩層匹配：
  1. **精確層**：讀取 FancyZones 自訂 layout（`custom-layouts.json`），zone 角落容忍 15px
  2. **啟發式層**：若無自訂 layout，嘗試 2/3 欄 × 2/3 列網格，找最佳匹配
  3. 只有目標尺寸與目前差 >20px 才執行 `setBounds()`

**constructor** 中觸發條件：
```typescript
if (needsCustomControls) {  // win32 + transparent
    this.setupFancyZonesSnapResize();
}
```

#### 結果
| 項目 | 結果 |
|------|------|
| FancyZones 貼附 + 自適應 resize | ✅ |
| 真透明 (`WS_EX_LAYERED`) | ✅ 保留 |
| 自訂 resize handles | ✅ 保留 |
| 自訂標題按鈕 | ✅ 保留 |
| F11 全螢幕 | ✅ 保留 |
| 無副作用（DWM 窗框、WCO 衝突） | ✅ 無原生 API 呼叫 |
| 支援自訂 layout | ✅ `custom-layouts.json` |
| 支援內建模板（無自訂 layout） | ✅ 啟發式 fallback |

#### 關鍵設計決策
- **不與 FancyZones 對抗**：不試圖修改 style flag、DWM 屬性、或搶在 hook 之前動作
- **`this.setBounds()` 有效**：自訂 resize handles 已證明內部 `setBounds()` 對 layered window 有效；問題僅限於外部 process 的 `SetWindowPlacement` 呼叫
- **防誤觸**：多層過濾（位置跳躍 + 尺寸不變 + zone 角落匹配 + 尺寸差異門檻），避免使用者手動拖曳時誤觸
- **無 koffi 依賴**：純 Electron API + Node.js `fs`，零原生 FFI 風險

### 硬限制
- `BaseWindow` 的 `transparent: true` 與 `WS_THICKFRAME` 互斥（Electron 內部 `FlipWindowStyle` 強制移除）
- `BaseWindow.getNativeWindowHandle()` 存在，但永久修改 style 需搭配 DWM 屬性抑制視覺副作用
- FancyZones 只認 `WS_THICKFRAME`（`GetWindowLong(GWL_STYLE) & WS_SIZEBOX`），無替代路徑
- FancyZones 使用低階 `WH_MOUSE_LL` hook → 無法靠 window message hook 搶時序
- PR #49428（fix resizable transparent windows）修復的是 Chromium `CanResize()` 路徑，**不涉及 Win32 style flag** → 對 FancyZones 無幫助
- `titleBarOverlay` + `titleBarStyle: "hidden"` 組合在透明模式下 WCO 按鈕行為異常 → 不可用
- **Microsoft 官方文件確認**：`WS_EX_LAYERED` 導致 `SetWindowPos` 座標解讀異常（額外縮放）— 這是 FancyZones 自適應 resize 失效的根因，非 Electron/FancyZones bug

---

## 解決項目總結

| # | 項目 | 狀態 |
|---|------|:--:|
| 1 | 自訂 resize handles（8 個隱形 div + IPC） | ✅ |
| 2 | 自訂標題按鈕（min/max/close + IPC） | ✅ |
| 3 | F11 全螢幕 fallback（`globalShortcut`） | ✅ |
| 4 | Tabbar drag region 調整（`calc(100vw - 138px)` + `margin-top: 6px`） | ✅ |
| 5 | Settings bug：透明度歸零時清除 `window:transparent` | ✅ |
| 6 | 透明度滑桿滾動重置（`refreshConfigAndReloadSelectedFile` 移除） | ✅ |
| 7 | FancyZones 自適應 resize（方案 #12：自偵測 + 自 resize） | ✅ |

---

## 方案 #11：DWM Acrylic 背景材質替代真透明（已回退）

### 思路
放棄 `WS_EX_LAYERED` (`transparent: true`)，改用 `transparent: false` + `backgroundColor: '#00000000'` + DWM Acrylic 背景材質。視窗從 OS 角度是 opaque（保留 `WS_THICKFRAME`），讓 FancyZones 恢復正常。

### 實作
- `emain/dwm-acrylic.ts`：`child_process.execSync` 執行 PowerShell，透過 C# P/Invoke 呼叫：
  - `DwmSetWindowAttribute(hwnd, 16, …)` — `DWMWA_USE_HOSTBACKDROPBRUSH` → TRUE
  - `DwmSetWindowAttribute(hwnd, 38, …)` — `DWMWA_SYSTEMBACKDROP_TYPE` → 3 (Acrylic)
- `emain/emain-window.ts`：Win11 22H2+ → DWM Acrylic 路徑；舊系統 → `transparent: true` fallback
- 新增 IPC `needs-custom-window-controls`，frontend 只在 fallback 時渲染自訂控制項
- WCO 原生按鈕處理 min/max/close

### 結果
| 項目 | 結果 |
|------|------|
| FancyZones 貼附 + 自適應 resize | ✅ |
| 四個邊/角落 resize | ✅ |
| 最小化/最大化/關閉圖標 | ✅ |
| 透明度效果 | ❌ **非真透明**，100% 時顏色變灰，看不到桌面後方視窗 |

### 根因
DWM Acrylic 提供的是**毛玻璃材質**（基於桌面桌布的模糊/色調處理），非真正的桌面透視（需 `WS_EX_LAYERED`）。使用者期望看到終端背後的視窗內容，Acrylic 無法達成。

### 結論
**已回退**。真透明 (`transparent: true`) 與 FancyZones 自適應 resize 在 Windows 核心層面互斥，目前取捨：保留真透明 + 自訂控制項，犧牲 FancyZones 自適應 resize。

### 衍生修復（保留）
- 透明度設定滾動重置修正（`settingscontent.tsx`）— 獨立有效
- IPC `needs-custom-window-controls` 及 preload 綁定 — 目前始終回傳 `true`，無副作用

---

## 涉及檔案清單

| 檔案 | 角色 |
|------|------|
| `emain/emain-window.ts` | 視窗建立、transparent 設定、F11 fallback、**FancyZones snap-resize** |
| `emain/emain-ipc.ts` | IPC handler：resize、min/max/close |
| `emain/emain-tabview.ts` | F11 `toggleWaveFullScreen()` |
| `emain/preload.ts` | contextBridge IPC 方法暴露 |
| `frontend/types/custom.d.ts` | ElectronApi 型別定義 |
| `frontend/app/windowresizehandles.tsx` | 自訂 resize handles（新檔案） |
| `frontend/app/windowtitlecontrols.tsx` | 自訂標題按鈕（新檔案） |
| `frontend/app/app.tsx` | 整合 WindowResizeHandles + WindowTitleControls |
| `frontend/app/app-bg.tsx` | 背景更新（回退到原始行為） |
| `frontend/app/tab/tabbar.scss` | tabbar drag region 調整 |
| `frontend/app/view/waveconfig/settingscontent.tsx` | 透明度清除 bug 修復 |
| `package.json` | 原含 `koffi` 依賴（Win32 FFI），**方案 #12 已移除** |

---

## 關鍵教訓

1. **`transparent: true` 是雙面刃**：提供透明效果，但移除 Windows native resize/drag 能力
2. **不要混用原生 overlay 與自訂 control**：兩套 hit-test 在同一個區域必然衝突
3. **Win32 hack 在 Electron 中有風險**：`SetWindowLongPtr` 可能被 Electron 後續覆蓋，或破壞渲染
4. **Polling 方案要極度保守**：trigger 條件不夠精確會造成災難性副作用
5. **先查原始碼再動手**：FancyZones 的 `WS_SIZEBOX` 檢查是精確根因，事後才知道就不該亂試
6. **BaseWindow vs BrowserWindow**：`BaseWindow.getNativeWindowHandle()` 確實存在，但 style 修改仍受 Electron 內部限制
7. **動態 style flag 切換是突破點**：永久修改 style 會破壞透明 → 只在拖曳期間短暫加入 `WS_THICKFRAME` → 既不影響正常渲染，又能讓 FancyZones 完成 resize
8. **Window message hook 不敵低階 hook**：FancyZones 用 `WH_MOUSE_LL` 在 WndProc 之前攔截輸入 → 任何 window message level 的 hook 都太慢；必須在 window creation 時就設定好 style，或用 system-level hook（`WH_KEYBOARD_LL` + `WH_MOUSE_LL`）搶在前面
9. **Windows 快取 frame style**：`SetWindowLongPtr(GWL_STYLE)` 後必須 `SetWindowPos(SWP_FRAMECHANGED)` 才能讓快取失效、讓外部 process 讀到新值
10. **DWM 是透明窗框抑制的最後一道線**：當無法避免 `WS_THICKFRAME` 時，`DWMWA_NCRENDERING_POLICY` + `DWMWA_BORDER_COLOR` 可以強制隱藏 DWM 繪製的窗框
11. **FFI 錯誤隔離是關鍵**：`koffi.load("dwmapi.dll")` 失敗會拋出例外，若與核心邏輯（`SetWindowLongPtrW`）放在同一個 try-catch，核心邏輯永遠不會被執行 → DWM 抑制必須用獨立 try-catch，只允許它 best-effort 失敗
12. **Electron `show()` 會重置視窗 style**：constructor 中用 `SetWindowLongPtrW` 加的 flag，在 `show()` 時被 `FlipWindowStyle` 重新覆蓋 → 必須延後到 `this.once("show")` + `setTimeout(0)` 才執行，確保在所有 Electron 內部初始化完成後才設定
13. **`transparent: true` + FancyZones 可能是根本性不相容**：經過 10 種方案嘗試（動態/永久 style flag、DWM 抑制、titleBarOverlay、原生 WCO），排除了 style flag、時序、快取、視窗分類、WCO 路徑等因素後，推測 Chromium 的 `Widget` 層或 `WS_EX_LAYERED` 特性本身與 FancyZones 的 `SetWindowPlacement` resize 機制衝突。**PR #49428 僅修復使用者手動拖曳 resize（`CanResize()` 路徑），不涉及 FancyZones 使用的 Win32 style flag 檢查路徑 — 升級 Electron 無助於此問題。**
14. **`titleBarOverlay` + `titleBarStyle: "hidden"` 組合在透明視窗下有 WCO 行為異常**：最大化按鈕觸發最小化、圖標重疊 — 說明 Electron 的 WCO 實作在透明 + hidden 組合下不穩定，不適合作為 workaround。
15. **繞過而非對抗**：10 種方案試圖「修復」FancyZones 的 resize 能力，全部失敗。方案 #12 的成功關鍵是**接受硬限制**，改為偵測 FancyZones 的移動操作後自行完成 resize。`this.setBounds()` 對 layered window 有效（內部呼叫 vs 外部 `SetWindowPlacement` 的差異），這是整個方案的理論基礎。
