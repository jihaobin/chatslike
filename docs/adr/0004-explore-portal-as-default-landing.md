# 介绍页 `/explore` 作为默认落地页，聊天工作台迁移到 `/home`

---
Status: accepted

---

## 背景与决策

需要新增一个介绍页（Explore Portal），用于展示项目能力与精选模型，并作为各功能（对话、图像、视频、社区）的中转入口。

我们决定：**介绍页落在 `/explore`，使用独立全屏门户布局（横向顶部导航，无左侧 NavPanel 竖栏），并成为登录后的默认落地页 —— 访问 `/` 时重定向到 `/explore`。原聊天工作台（main layout 持久化常驻层）从 `/` 迁移到 `/home`。**

## 为什么这样做（为何会让未来的读者意外）

现有 `/` 并不是普通路由页面：聊天工作台（`DesktopHome` + `DesktopHomeLayout`）是 main layout 的**持久化背景层**，各功能页通过 `<Outlet />` 叠加覆盖其上；URL 为 `/`（空 index 节点）时 Outlet 渲染 null，于是露出常驻的工作台。读者会问：「为什么 `/` 要重定向，而不是直接把介绍页做成 index？」

原因是：介绍页要求门户式全屏布局、无左侧竖栏，与 main layout 常驻 NavPanel 的结构冲突，因此它必须放在 main layout **之外**（类似 onboarding）。既然不能复用 main layout 的 index 槽位，就只能让 `/` 重定向到 `/explore`，并把工作台显式迁到 `/home`。代价是约 16 处跳转 `/` 的代码（`useNavLayout` 的 home item、多处 `redirectElement('/')`、TabBar、manifest 等）需要同步更新。

## 考虑过但否决的替代方案

- **介绍页与首页共存（原 `/` 不变）** —— 改动最小，但用户最初要求介绍页「成为默认首页」。否决。
- **介绍页作为 main layout 的 index 覆盖层（保留左侧竖栏）** —— 与设计图的横向门户导航、无竖栏外观冲突，无法呈现门户观感。否决。

## 待办（TODO）

- 移动端暂不做介绍页（`/` 仍为移动首页），后续补充。
- 精选模型卡当前为静态清单，后续做成管理员可配置。
