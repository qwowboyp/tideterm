# REQUIREMENTS.md

## 範圍說明

本文件定義 TideTerm 作為整體產品的核心需求範圍，用於後續 phase 規劃。需求分為核心產品能力、平台與品質要求、以及 fork 維運要求。

---

## A. 核心工作區能力

### RQ-001 Block-based workspace

系統必須提供 block-based workspace，支援 terminal、files、preview、web、editor、AI chat 等視圖型態，並允許使用者在單一工作區中自由組合與切換。

### RQ-002 Layout manipulation

系統必須支援 block 的分割、替換、調整大小、聚焦與多視圖排版，且未來 roadmap 要保留 import/export layout、tab templates、enhanced layout actions 的演進空間。

### RQ-003 Window / tab context

系統必須支援視窗標題自動模式與使用者自訂命名，並讓 UI 能反映當前焦點上下文。

---

## B. 終端與命令工作流

### RQ-004 Terminal as first-class surface

terminal 必須是產品核心能力，支援互動式 shell、terminal metadata、scrollback、drag & drop、command blocks、terminal 狀態感知等功能。

### RQ-005 Multi-session terminals

系統必須支援單一 terminal block 內多個 terminal session，包含建立、切換、結束、側欄寬度持久化，以及繼承 active session 的 connection / cwd。

### RQ-006 Shell integration fidelity

terminal shell integration 必須作為 cwd、command lifecycle、AI context 與未來 terminal status UX 的真實來源，不應被輸出 heuristic 取代。

### RQ-007 Command execution integration

AI 與 terminal 之間必須保留可擴展的命令執行、結果擷取、狀態感知與 rollback / review 能力。

---

## C. 遠端連線能力

### RQ-008 SSH / WSL workflow

系統必須支援 SSH 與 WSL 遠端工作流，並允許使用者在遠端 terminal、file browsing、preview、editor 與 block workflow 之間自然切換。

### RQ-009 wsh-based enhancement path

系統必須維持 `wsh` 作為遠端增強能力的主要機制，並在使用者拒絕或暫時無法安裝時提供 graceful degradation。

### RQ-010 Remote resumability

遠端 terminal 應優先支援 tmux-based resume，並在 tmux 不可用時提供可理解的 fallback 與提示。

### RQ-011 Remote session management

系統應支援遠端 tmux session manager、Attach / Force Attach / Rename / Kill / Kill All 等管理操作。

### RQ-012 Remote robustness

系統必須持續提升遠端連線穩定性，包括 HOME normalization、route self-heal、transient failure retry、conn diagnostics 等。

---

## D. AI-native 能力

### RQ-013 Multi-provider AI support

系統必須支援多 AI provider，包括 OpenAI、Gemini、Azure OpenAI、OpenRouter、local OpenAI-compatible servers，並保留 Anthropic Claude 深度整合的 roadmap 空間。

### RQ-014 Context-aware AI

AI 必須能理解 workspace context，包括 terminal state、widget context、scrollback、檔案與 web 資料。

### RQ-015 Safe AI file workflows

系統必須支援 AI file write / diff preview / rollback 等能力，並持續擴展到 multi-file editing 與 safe file modification patterns。

### RQ-016 AI widget evolution

系統應保留 Tsunami / custom AI-powered widgets / visual AI builder / template library 的規劃與可擴展架構。

---

## E. MCP 與 Proxy 能力

### RQ-017 MCP server management

系統必須支援 MCP server 的新增、修改、刪除、import、sync 與 per-app enable/disable，目標 app 包含 Claude Code、Codex CLI、Gemini CLI。

### RQ-018 API Proxy operations

系統必須支援內建 WaveProxy，包含多 channel routing、health check、metrics、request history、remote sync、dock status 與相容 endpoint aliases。

---

## F. 體驗與在地化

### RQ-019 Bilingual UI

系統必須支援 English / Simplified Chinese 即時切換，且不需重新啟動。

### RQ-020 UX polish roadmap

系統應逐步支援 command palette、Monaco theming、advanced keybinding、extended drag & drop、widget launch shortcuts 與 workspace template 類能力。

---

## G. 安全、隱私與設定

### RQ-021 Privacy-first defaults

產品預設應維持 telemetry disabled、auto-update disabled、cloud AI shortcuts hidden 等 fork 既有策略，除非有明確產品決策改變。

### RQ-022 Secret handling

任何 API keys、proxy accessKey、provider credentials、remote secrets 均不得以明文不受保護方式處理或保存。

### RQ-023 Fork identity isolation

產品必須持續使用 `TIDETERM_*` 命名空間與獨立 config/data path，避免與 upstream Wave 安裝衝突。

---

## H. 工程與維運要求

### RQ-024 Cross-platform buildability

系統必須可在 macOS / Linux / Windows 建置與運行，並維持 `task`-driven build system、Electron/Vite、Go backend 與 Zig-based cross-compilation 流程。

### RQ-025 Testable phased delivery

重要功能必須能以 phase 形式交付，具備明確影響範圍、驗證步驟與可 review 的變更邊界。

### RQ-026 Architecture consistency

系統必須維持現有架構原則：

- Jotai 為主要前端狀態機制
- model methods 中不使用 React hooks
- frontend-only 狀態與 backend 狀態邊界清晰
- event types / config / schema 來源一致，不以硬編碼繞過

### RQ-027 Upstream merge awareness

重大重構與 fork 功能演進必須考慮上游合併成本、差異擴散程度與長期維護負擔。

---

## 初始規劃重點（給 roadmap 用）

後續 roadmap 應優先覆蓋以下主題：

1. 核心平台穩定性（layout / build / remote / terminal fidelity）
2. fork 已有功能的補強與驗證（multi-session、proxy、mcp、remote robustness）
3. AI 能力擴張（provider、safe tooling、remote ops、custom widgets）
4. UX polish 與平台可用性提升
5. 文件、發行與 upstream 維護策略
