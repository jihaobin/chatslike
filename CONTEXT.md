# LobeHub

LobeHub 的领域术语表。重点澄清「任务 (Task)」相关概念 —— 围绕删除任务页面的多次评估反复在这些术语的混淆上翻车，这里把边界钉死。

## 管理后台 (Admin Panel)

**管理员 (Admin)**:
可查看系统中所有用户数据的角色，仅有只读权限。通过现有 RBAC 系统（`rbac_user_roles` 表）分配，对应 `admin:*_read` 权限码。
_Avoid_: 与超级管理员混用

**超级管理员 (Super Admin)**:
在管理员权限基础上，还可执行写操作（调整积分、冻结账号、处理异常订单等）的角色。对应 RBAC 中 `SYSTEM_DEFAULT_ROLES.SUPER_ADMIN` 及 `admin:*_write` 权限码。
_Avoid_: 与普通管理员混用

**账号封禁 (Account Ban)**:
超级管理员通过将 `users.banned = true` 禁止用户登录的操作，可附带 `banReason` 和 `banExpires`（可设临时封禁）。与积分冻结（`creditAccounts.status = 'frozen'`）完全不同 —— 封禁影响整个账号登录，积分冻结只影响积分使用。
_Avoid_: 与「积分冻结」混用；两者是独立操作，可单独执行

**管理员操作审计日志 (Admin Operation Log)**:
独立的 `adminOperationLogs` 表，记录所有超级管理员写操作的完整轨迹：操作人、目标用户、操作类型、变更前后值、备注。覆盖 `creditLedgerEntries` 不记录的操作（如封禁账号、处理异常订单）。
_Avoid_: 与 `creditLedgerEntries`（积分流水）混为一谈

**积分人工调拨 (Admin Credit Grant)**:
超级管理员手动向用户增减积分的操作。增加积分通过写入 `creditGrants` 表（`source = 'admin_grant'`）实现；减少积分通过 revoke 对应 grant 或写负向 ledger entry 实现。所有调拨均同步写入审计日志。
_Avoid_: 与订阅赠送积分、充值积分混用

**总览看板 (Admin Dashboard)**:
管理后台首页（`/admin`），展示系统级关键指标卡片（总用户数、本月新增、本月营收、本月积分消耗、异常订单数）及趋势图表。管理员进入后台的默认落地页。
_Avoid_: 与用户端的 /settings/usage 混淆

## 介绍页 (Explore Portal)

**介绍页 (Explore Portal)**:
登录后的默认落地页，路由 `/explore`，使用**独立全屏布局**（横向顶部导航，无左侧 NavPanel 竖栏），不在 main layout 之内。作用有二：展示项目能力 / 精选模型；作为各功能的**中转入口**（点击跳转到对话、图像、视频、社区）。访问 `/` 时重定向到 `/explore`。
_Avoid_: 与「聊天工作台」混用 —— 介绍页是门户，不含聊天侧边栏 / 输入框

**聊天工作台 (Chat Workspace)**:
原 `/` 首页（左侧 NavPanel 竖栏 + agent 列表侧边栏 + 输入框 + Recents），是 main layout 的持久化常驻层。介绍页上线后从 `/` 迁移到 `/home`。「开始对话」按钮跳转到它。
_Avoid_: 与「介绍页」混用

**精选模型卡 (Featured Model Card)**:
介绍页中部一排手工维护的模型展示卡（名称 + 厂商 + 一句话卖点 + 分类标签）。数据为**静态精选清单**（非 discover 目录、非用户已启用模型），后续需做成管理员可配置（TODO）。点击 → 跳对话页并预选该模型（复用 StarterList 的 `updateAgentConfigById({model,provider})` 模式；生成类则走 `/image?model=`、`/video?model=` 查询参数）。
_Avoid_: 与 discover 社区模型目录（`/community/model`）混用

**价格页 (Pricing Page)**:
路由 `/explore/pricing`，与介绍页同一套门户全屏布局。直接嵌入现有订阅组件 `Plans.tsx`（`src/business/client/BusinessSettingPages/Plans.tsx`）。顶导航「价格」与促销 banner「立即查看」均指向它。
_Avoid_: 与 `/settings` 下的订阅 tab 混用 —— 价格页是门户风格的独立呈现

## Language

**任务数据层 (Task Data Layer)**:
任务的模型、store 状态与服务端业务逻辑 (`store/task` 的 detail/list 数据、`TaskModel`、服务端 `task/` 服务)。被保留的功能复用 —— 普通 agent 运行通过 `streamingExecutor` 注入任务上下文，`builtin-tool-task` 工具读写它。**不属于任何单一页面**。
_Avoid_: 把它和「任务页面」混为一谈

**任务页面 (Task Pages)**:
用户可见的任务管理界面:`/tasks` 全部任务列表页 (创建框 + 推荐模板 + 看板)、任务详情页 (`/task/[taskId]` 等)、sidebar「任务」入口。是数据层之上的一层可删 UI。
_Avoid_: 任务模块、任务功能 (太宽，会误含数据层)

**编排任务消息 (Orchestration Task Message)**:
多 agent / 子 agent 编排聊天中创建的 `role: 'task' / 'tasks' / 'groupTasks'` 占位消息，由 `Conversation/Messages/Task*` 渲染。是**核心聊天**的一部分，与定时调度、任务页面均无关。
_Avoid_: 把 `role:task` 当成定时任务 UI

**定时调度 (Scheduling)**:
cron /heartbeat 自动重复执行任务的基础设施 (`taskScheduler`、heartbeat 重新武装、`scheduleDispatch`、`cronEval`、`agentCronJob` 表与路由)。是任务执行之上的自动化层。
_Avoid_: 把调度和任务执行 / 数据层混为一谈

**每日简报 (Daily Brief)**:
首页卡片区 (`features/DailyBrief`), 展示后台 brief workflow 产出的 brief。`briefs` 为空时整块不渲染。依赖 `store/brief`(仅它与推荐模板 hook 使用)。
_Avoid_: Brief 通知、消息

**最近 (Recents)**:
首页侧边栏的会话 / 话题历史导航 (`home/features/Recents`, 数据来自 `store/home` + 服务端 `lambda/recent`)。列表项含 `document/task/topic` 三种类型。是**核心导航**, 仅复用了 `taskDetailPath` 跳转工具，本身不是任务功能。
_Avoid_: 把 Recents 当作任务功能删除
