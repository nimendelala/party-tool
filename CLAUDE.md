# 体育系党支部工具箱 — 项目规则

## 每次提交前必须做的事

1. **模拟用户操作走一遍** — 在脑子里跑完新增→保存→刷新→编辑→删除的完整流程，确认能用再交付
2. **检查 diff 无意外改动** — `git diff` 确认只改了该改的

## 新模块开发检查清单

开发任何新数据模块前逐项确认：

1. **所有删除入口** → 调 `markDeleted(id)`
2. **弹窗 open/close** → 调 `markEditing(true/false)`
3. **syncFromCloud** → 用 merge 而非直接覆盖
4. **嵌套对象** → 有子对象（如文章在分类下）需要二级 merge
5. **保存统一** → 所有保存用 `saveAndSync`，不用 `save()`
6. **diff 快照** → 新增 `lastXxxJSON` 变量，auto-sync 更新
7. **loadData** → 云端 + localStorage 兜底（30s 新建保护）
8. **backupLocal** → 新模块数组加入备份
9. **ESC 处理** → 新弹窗加入 ESC 关闭链
10. **参数类型** → 函数传递确认是对象还是 ID 字符串

## 已有模块清单

- **学生信息管理** — `people[]`，增删改查+批量+导入导出
- **工作列表** — `tasks[]`，增删改+勾选完成
- **工作流程** — `workflows[]`，分类→文章二级结构，编辑需独立密码(123)

## 关键代码入口

- `functions/api/[[route]].js` — D1 后端，单行存储 `app_data`
- `index.html` — 全部前端逻辑，~2650 行
- 部署：`npx wrangler pages deploy . --branch master --commit-dirty=true`

## 同步机制核心概念

- `mergeByUpdatedAt` — 逐条时间戳合并
- `mergeWorkflows` — 分类级+文章级二级合并
- `recentlyDeleted` + `markDeleted` — 防删除复活
- `cloudSeenIds` + `markCloudSeen` — 检测远程删除
- `currentVersion` — 乐观锁版本号
- `isEditing` — 编辑锁，暂停轮询
- `saveAndSync` — save → sync × 2（immediate + 1.5s）
- 轮询 1s + visibilitychange 立即同步
