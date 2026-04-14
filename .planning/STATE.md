# STATE.md

## 初始化時間

- Date: 2026-04-14
- Workspace: `X:\Projects\tideterm`
- Branch at initialization: `main`

## 專案現況摘要

TideTerm 已經是一個具有實際功能深度的 fork，而不是僅有概念的綠地專案。它已經具備：

- block-based workspace
- terminal / files / web / editor / AI chat 等多 block 類型
- SSH / WSL 遠端連線與 `wsh` helper 流程
- remote tmux resume / tmux session manager
- multi-session terminal blocks
- MCP server manager
- WaveProxy
- bilingual UI（English / Simplified Chinese）
- 隱私預設調整與 TideTerm fork 品牌隔離

## 當前規劃判斷

### 1. 這不是從零開始的產品

因此 roadmap 不應以「先做 MVP」思路規劃，而應以：

- 核心穩定性
- 既有 fork 特色補強
- AI / widget 能力擴展
- 維護與發行節奏

作為主軸。

### 2. 核心風險在複雜度，不在功能貧乏

目前風險主要來自：

- layout / state 複雜度
- remote / shell integration 橫跨前後端
- AI 與 terminal / widget 的交叉耦合
- upstream merge 成本
- cross-platform build / package 變異

### 3. 近期 phase 不應先追新功能表面數量

短期應優先收斂會影響整個產品可靠性的基礎層：

- layout
- terminal fidelity
- remote robustness
- build reliability

## 已知高訊號參考來源

- `README.md`：產品定位、亮點、使用者功能
- `ROADMAP.md`：公開 roadmap 與 current capabilities
- `MODIFICATIONS.md`：fork 與 upstream 差異、功能落點
- `CONTRIBUTING.md`：開發方式、主要組件分工
- `BUILD.md`：建置環境與 cross-platform 要求
- `RELEASE_NOTES_FORK_DIFF.md`：fork 主要新增能力摘要
- `aiprompts/layout-simplification.md`：layout 複雜度與潛在簡化方向
- `aiprompts/waveai-architecture.md`：AI 架構與 provider / state 流
- `aiprompts/conn-arch.md`：遠端連線架構與錯誤恢復行為
- `aiprompts/newview.md`：view/model 模式與前端實作原則

## 初始假設

1. TideTerm 會持續作為長期維護 fork，而非一次性分支。
2. 上游 Wave Terminal 仍可能持續演進，因此 fork 差異必須可控。
3. AI 能力是產品重要方向，但不能犧牲 terminal / remote 核心穩定性。
4. 多 session terminal、remote robustness、proxy、MCP manager 是目前 fork 身份的重要差異點。
5. 後續 phase 應優先以可驗證、可 review、可回滾的小步驟推進。

## 下一步建議

下一個建議指令：

- `/gsd-plan-phase 1`

目的：把「Planning Baseline & Codebase Mapping」轉成具體可執行 phase 計畫，並確立後續 phase 產出標準。
