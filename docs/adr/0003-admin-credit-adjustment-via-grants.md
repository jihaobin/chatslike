# 管理员调整积分通过写 creditGrants，而非直接修改余额

---
Status: accepted
---

## 背景与决策

超级管理员需要能手动增减用户积分。积分数据存在两个地方：`creditAccounts.availableCredits`（汇总余额）和 `creditGrants`（每笔发放明细）。

我们决定：**增加积分写 `creditGrants`（`source = 'admin_grant'`）；减少积分 revoke 对应 grant 或写负向 `creditLedgerEntries`，而非直接修改 `creditAccounts.availableCredits`。**

## 为什么这样做（为何会让未来的读者意外）

直接修改 `availableCredits` 更简单，读者可能会问：「为什么要走更复杂的 grant 路径？」

原因是：`creditGrants` 表的 `source` 字段已预设 `admin_grant` 枚举值，说明这个场景是被预设计过的。走 grants 路径有三个直接好处：(1) 每笔调整有完整明细记录，便于对账；(2) 支持为管理员发放的积分设置有效期；(3) 与现有积分计算逻辑完全兼容，不引入新的一致性风险。直接改余额会绕过所有这些约束，且没有明细可追溯。

## 考虑过但否决的替代方案

- **直接 UPDATE creditAccounts.availableCredits** —— 简单，但无明细、无有效期、破坏数据一致性假设。否决。
- **只写 creditLedgerEntries（adjust 事件）** —— ledger 是事件流，适合记录变更历史，但不承载「这笔钱是哪次发放的、什么时候到期」的语义。否决，增加积分用 grants，减少积分用 revoke/adjust 并存。
