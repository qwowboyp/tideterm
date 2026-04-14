# PROJECT.md

## 專案名稱

TideTerm

## 專案摘要

TideTerm 是一個跨平台（macOS / Linux / Windows）的 AI-native 終端機應用程式，將傳統終端操作與圖形化區塊工作區整合在同一個介面中。它支援 terminal、files、preview、web、editor、AI chat 等 block，並且在遠端 SSH / WSL 工作流、AI 整合、MCP 管理、API Proxy 與多 session 終端體驗上做了大量 fork 增強。

本專案是 Wave Terminal 的獨立 fork，採用 Apache-2.0，並以 TideTerm 自有品牌、設定命名空間與發行流程持續演進。

## 產品目標

1. 提供以終端為核心、但不受純 CLI 限制的開發工作區。
2. 讓本地與遠端工作流（SSH / WSL / tmux / wsh）在單一介面中自然切換。
3. 建立可擴展的 AI-native 工作體驗，讓 AI 與 terminal、檔案、web、widget 互相協作。
4. 維持 TideTerm 作為獨立 fork 的穩定性、可維護性與發行節奏。

## 使用者價值

- 在同一個 workspace 內同時操作 terminal、檔案、網頁、編輯器與 AI。
- 對遠端主機提供更穩定的 resume / file ops / session management 體驗。
- 提供 MCP 與 WaveProxy 等進階 AI 工具鏈能力。
- 在隱私預設、配置隔離與中英文 UI 上提供更符合 fork 目標的產品選擇。

## 主要子系統

### Frontend

- 路徑：`frontend/`
- 技術：React + TypeScript + Jotai + Tailwind v4 + SCSS
- 責任：block UI、layout engine、terminal view、AI panel、settings、proxy、i18n

### Electron Main

- 路徑：`emain/`
- 技術：TypeScript / Electron main process
- 責任：IPC、視窗生命週期、選單、原生整合、主程序控制

### wavesrv

- 路徑：`cmd/server/`、`pkg/`
- 技術：Go
- 責任：核心業務邏輯、資料庫、遠端連線、RPC、AI、proxy、後端服務

### wsh

- 路徑：`cmd/wsh/`
- 技術：Go CLI / remote helper
- 責任：本地 CLI、遠端 helper、連線多工、遠端檔案與命令橋接

### Tsunami

- 路徑：`tsunami/`
- 責任：sandboxed app / AI-powered widget 擴展能力

## 規劃原則

1. **先穩定核心，再擴展 AI 能力**：terminal、layout、remote 是產品根基。
2. **避免與上游 fork 差異失控**：每次大型功能都要考慮未來 upstream merge 成本。
3. **維持真實資料來源**：避免用 heuristic 補資料真相，特別是 terminal / remote / AI context。
4. **優先小步可驗證 phase**：每個 phase 都要能被驗證、回滾與獨立 review。
5. **保留 fork 身份**：TIDETERM\_\*、隱私預設、中文支援與遠端工作流優化都是核心差異化。

## 目前已知優勢

- block-based workspace 已具雛形且功能面廣
- 多 session terminal、MCP manager、WaveProxy、遠端 tmux session manager 等 fork 特性明確
- 遠端流程（wsh / tmux / 路由自癒）已有不少強化
- AI provider / widget integration 已有實際基礎，不是純 roadmap 願景

## 目前已知挑戰

- layout / state 架構複雜，存在可簡化空間
- 遠端與 shell integration 流程跨前後端，驗證成本高
- AI 能力多且橫跨多子系統，需求容易擴散
- fork 與 upstream 的差異會提高維護與合併成本
- cross-platform build / package 仍需持續穩定化

## 開發與品質約束

- 使用 `task` 作為主要建置入口
- Node 22 LTS / Go 1.24.6 / Zig 為重要環境要求
- TypeScript `strict: false`，但不得用 `as any` / `@ts-ignore` 偷過錯誤
- 狀態管理以 Jotai 為主；非 React 環境使用 `globalStore.get()` / `set()`
- 不在 `main` 分支直接開發
- 祕密資料不可明文儲存

## 本次規劃初始化目的

建立 TideTerm 的 `.planning` 骨架，讓後續能以 phase 方式執行：

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

這份初始化以**整個專案**為範圍，而非單一功能。
