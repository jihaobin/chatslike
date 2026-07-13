# 以 inbox 内置虚拟助理承载「单一助理」形态，纯前端 feature flag 隐藏助理管理

---
Status: accepted
---

## 背景与决策

本项目的 AI 聊天以「助理（agent）」为核心：数据库 `agents → agentsToSessions → sessions → topics → messages`
是强制外键链，发消息时运行时（`conversationLifecycle`）必须从某个 agent 配置取 `model/provider/systemRole`，
聊天无法脱离「某个助理」而存在。但「创建 / 维护助理」对普通用户偏复杂，团队决定隐藏这一能力，
同时保留原有聊天功能，目标形态为「单一助理 + 多话题」（类 ChatGPT）。

我们决定：**复用每用户独立的内置虚拟助理 `inbox`（`virtual=true`，系统启动自动初始化）作为唯一助理载体，
后端、数据库、聊天核心链路完全不动，仅通过 feature flag 在前端隐藏「创建 / 管理助理」的所有入口。**
新增总开关 `hide_agent_management`（默认 `false`），配合既有的 `market` / `edit_agent` flag，
在 `self-host/prod` 通过 `FEATURE_FLAGS` 显式开启。被隐藏的路由（profile / community / group）
由统一的运行时 `<AgentManagementGuard>` layout 守卫，重定向到首页 `/`。

## 为什么这样做（为何会让未来的读者意外）

未来读代码的人会疑惑：「聊天明明还绑着 `agents` 表和 `agentsToSessions`，为什么界面上完全看不到助理管理？」
答案是：助理体系在数据 / 运行时层是聊天的地基，**拆不掉也不该拆**；我们只在 UI 层做减法。
`inbox` 本就是系统为「无差别默认聊天」准备的虚拟助理，用它当唯一助理零成本、零数据迁移、完全可逆。

## 考虑过但否决的替代方案

- **数据迁移：把所有历史话题重挂到 inbox 名下** —— 不可逆、风险高。否决，改为「存量保留但不暴露」。
- **硬编码删除入口（不走 flag）** —— 不可配置、与上游 cherry-pick 冲突、恢复需改代码。否决，改为 flag 驱动。
- **拆库 / 改造聊天链路使其不依赖 agent** —— 改动面巨大且破坏与上游同步。否决，后端一律不动。
- **在路由配置层读 flag 做条件重定向** —— 技术上不可行（路由配置是模块级常量，不能用 hook，
  且 serverConfig 异步注入、求值时 flag 未 hydrate）。改为运行时 Guard layout 组件。

## 后果

- 完全可逆：关闭 `FEATURE_FLAGS` 对应项即恢复原行为；新 flag 默认 `false`，不影响上游与其他部署。
- 存量落差：老用户原有的多助理会话不再可见（保留在库中，仅前端不暴露）。
- 遗留点：Electron 截图悬浮窗的助理选择器第一期不处理。
