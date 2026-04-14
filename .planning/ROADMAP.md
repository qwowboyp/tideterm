# ROADMAP.md

## 規劃原則

- Phase 以**小步可驗證**為原則。
- 優先順序：**核心穩定性 > fork 特色補強 > AI 擴展 > UX polish > 長期維護**。
- 每個 phase 必須能對應到 `REQUIREMENTS.md` 的需求編號。

---

## Milestone 1 — Core Stabilization & Planning Baseline

### Phase 1 — Planning Baseline & Codebase Mapping

**目標**：建立 `.planning` 基礎文件、確認核心子系統與後續 phase 邊界。  
**對應需求**：RQ-025, RQ-026, RQ-027

### Phase 2 — Layout Architecture Stabilization

**目標**：釐清並收斂 layout / Jotai / write-cache 相關複雜度，降低後續 UI 與 block 演進風險。  
**對應需求**：RQ-001, RQ-002, RQ-026

### Phase 3 — Terminal Fidelity & Session UX

**目標**：補強 terminal 狀態真實性、多 session UX、shell integration 衍生能力與 command workflow 穩定性。  
**對應需求**：RQ-004, RQ-005, RQ-006, RQ-007

### Phase 4 — Remote Connection Robustness

**目標**：持續強化 SSH / WSL / wsh / tmux 路徑下的穩定性、恢復能力與錯誤診斷。  
**對應需求**：RQ-008, RQ-009, RQ-010, RQ-011, RQ-012

### Phase 5 — Build & Packaging Reliability

**目標**：降低跨平台建置、打包與發行流程的不確定性，強化 CI / packaging 可預測性。  
**對應需求**：RQ-024, RQ-025, RQ-027

---

## Milestone 2 — Fork Feature Hardening

### Phase 6 — Multi-session Terminal Hardening

**目標**：驗證並補強單 block 多 terminal session 功能的正確性、資料流、交互與持久化。  
**對應需求**：RQ-004, RQ-005, RQ-025

### Phase 7 — MCP Server Manager Hardening

**目標**：補強 MCP 設定管理、import/sync 流程、per-app config 寫入與錯誤回饋。  
**對應需求**：RQ-017, RQ-021, RQ-022, RQ-025

### Phase 8 — WaveProxy Hardening

**目標**：補強 API Proxy 的通道管理、排程、指標、歷史與 remote sync 體驗。  
**對應需求**：RQ-018, RQ-022, RQ-024, RQ-025

### Phase 9 — Window Title / Workspace UX Polish

**目標**：完善 auto title / fixed title / window switching 與 workspace context 的整體體驗。  
**對應需求**：RQ-003, RQ-020

### Phase 10 — i18n Coverage Completion

**目標**：持續補齊 English / Simplified Chinese 覆蓋範圍與 UI 一致性。  
**對應需求**：RQ-019, RQ-020

---

## Milestone 3 — AI Capability Expansion

### Phase 11 — Provider Configuration Expansion

**目標**：補強 provider configuration flexibility，降低多供應商配置摩擦。  
**對應需求**：RQ-013, RQ-021, RQ-022

### Phase 12 — Anthropic Claude Integration

**目標**：完成 Claude provider 深度整合，含 extended thinking / tool use 對應能力。  
**對應需求**：RQ-013, RQ-014

### Phase 13 — Safe AI File Workflow Expansion

**目標**：從單檔 diff / rollback 擴展到 multi-file editing 與更安全的修改流程。  
**對應需求**：RQ-015, RQ-025

### Phase 14 — AI Command & Terminal Workflow Expansion

**目標**：讓 AI 與 terminal command execution、result capture、state-aware 行為更完整整合。  
**對應需求**：RQ-007, RQ-014, RQ-015

### Phase 15 — Remote AI File Operations

**目標**：讓 AI 在遠端 SSH 工作流中具備更完整檔案操作能力。  
**對應需求**：RQ-008, RQ-014, RQ-015

---

## Milestone 4 — Widget & Workspace Evolution

### Phase 16 — Tsunami / Custom AI Widget Foundation

**目標**：整理 custom AI-powered widgets 與 Tsunami 子模組的擴展基線。  
**對應需求**：RQ-016, RQ-025, RQ-027

### Phase 17 — Visual AI Widget Builder

**目標**：建立 visual builder 與 template library 的產品基礎。  
**對應需求**：RQ-016, RQ-020

### Phase 18 — Workspace Templates & Import/Export

**目標**：支援 tab/workspace template、layout import/export 與快速啟動工作流。  
**對應需求**：RQ-002, RQ-020

### Phase 19 — Command Palette & Keybinding Evolution

**目標**：建立 command palette 與進階 keybinding customization。  
**對應需求**：RQ-020

### Phase 20 — Advanced Drag & Drop Flows

**目標**：擴展跨 widget、AI、file/url 的拖放工作流。  
**對應需求**：RQ-002, RQ-014, RQ-020

---

## Milestone 5 — Release, Docs, and Long-Term Maintainability

### Phase 21 — Documentation & Contributor Experience

**目標**：改善 docs、architecture references、contributor onboarding 與 feature maps。  
**對應需求**：RQ-025, RQ-027

### Phase 22 — Release Process Hardening

**目標**：整理 release notes、fork diff、CI build matrix 與 packaging 流程。  
**對應需求**：RQ-024, RQ-027

### Phase 23 — Upstream Merge Strategy

**目標**：建立上游追蹤、差異控管與 merge 風險管理節奏。  
**對應需求**：RQ-027

---

## 近期建議執行順序

若從現在開始進入 phase 規劃，建議順序為：

1. Phase 1 — Planning Baseline & Codebase Mapping
2. Phase 2 — Layout Architecture Stabilization
3. Phase 3 — Terminal Fidelity & Session UX
4. Phase 4 — Remote Connection Robustness
5. Phase 6 — Multi-session Terminal Hardening

理由：這些主題最直接影響 TideTerm 的核心使用體驗與未來 AI / widget 擴展成本。
