# DOCUMENTATION.md · 执灯人 / LifeFlow 工作流知识库

> 生成：2026-10-25
> 用途：给后续 AI / 智能体的约束与背景；先读本文件，再读具体任务文档。
> 来源：项目根目录、`docs/`、`资料库备份/`、`.workbuddy/memory/` 下的全部 `.md` 清单；其中与「目标 / 任务 / 模块 / 产品原则」直接相关的核心文档已逐段读取，归档与无关主题只登记标题与结论。
> 状态：**当前是静态 HTML/JS 原型，不是历史 Next.js/Dexie 仓库。**

---

## 1. 产品事实（不可违反）

### 当前手机壳 `/app/`（2026-10-25 现状）

- 底部是 **4 个 tab + 1 个记一笔头像**：待办 / 今天 / 我的 / 灯 / 记一笔；
- **没有“目标”底部 tab**；
- 目标入口：`记一笔 → 长期目标`，打开壳内 `#screen-goals`，不是 v3 裸页；
- 壳内目标屏隐藏底部 tabbar，返回回到「记一笔」；
- `pages/v3/goals.html` 是**旧版独立模块页**（自带 5 个 tab：今日安排 / 目标 / 习惯 / 回顾 / 我的），只能作为 legacy/iframe 回退，**不是当前 `/app/` 的主界面**。


### 三种形态，按时间尺度分工

| 形态 | 入口 | 时间尺度 | 职责 |
|---|---|---|---|
| 手机端 | `pages/index.html` | 当下 | 采集 / 执行 |
| 工作台 | `workbench/index.html` | 一天 | 干活 / 学习 / 专注 |
| 电脑端 | `pages/desktop.html` | 一周/一月 | 规划 / 复盘 |

- 三端不是同一界面的三个皮肤；
- 不要把手机端做成规划台，也不要把电脑端做成采集页。

### 数据与写者

| key | 内容 | 写者 |
|---|---|---|
| `zdLight` | 灯 / 心情 / logs / plan / todos | 手机写 logs/moods；电脑端写 plan/todos |
| `lifeflow-days-v1` | 模块事实记录 | 手机 |
| `lifeflow-ledger-v1` | 账本账户/流水/分期 | 手机 |
| `lifeflow-goal-items` | 目标（v1，只读保留） | 旧 3 个页面（不再新增写入） |
| `lifeflow-goals-v2` | 目标 v2（requirements） | `pages/core/goals.js` 单写 |
| `lifeflow-habit-items` | 习惯（工具轨） | 习惯页 / 习惯创建页 |
| `lifeflow-study-items` | 学习项（可带 goal 文案） | 学习项创建页 |
| `lifeflow-exam-plans` | 考试计划 | 考试页 |
| `lifeflow-floors-v1` | 今日保底 | 手机壳层 |
| `lifeflow-today-v1` | 今日 3+3 勾选 | 手机壳层 |
| `lifeflow-weekly-v1` | 周配额顺延/降级/跳过 | 手机壳层 |
| `lifeflow-train-v2` | 训练 session | 训练页 |
| `lifeflow-theme` | 日夜 | 三端共用 |
| `wb_lifeflow_daywork_v2` | 工作台个人数据 | 工作台 |

- **单写者原则**：每个数据域只有一个写者，其余端只读；不要双写。
- 数据只存在浏览器 localStorage，无后端、无账号、不上传。
- 部署：`my-lifeos.com` 同一 origin 下 `/app/`、`/desktop/`、`/work/`；子域名会切断 localStorage。

### 技术栈

- 静态 HTML + 内联 CSS/JS + `pages/core/*.js`；
- 无构建、无框架、无 npm 依赖；
- 测试：Playwright 行为测试 + Node 纯函数测试；
- 基线：`node tests/run-all.mjs` **32/32**；`node scripts/verify.mjs` **31/31**。

---

## 2. 现有概念（必须对齐）

### 四账户

- **体**：睡眠、饮食、饮水、运动、休息、吃药、功法；
- **情**：情绪、关系、独处、恢复、冥想；
- **智**：学习、思考、输出、成长；
- **志 / 资源**：记账、预算、时间、目标、穿搭。

### 灯

- 手机/电脑/工作台共享的「今日方向」与光的反馈；
- 不是任务清单，不是分数；
- 不做开发工具/JSON 检查。

### 模块

- 模块 = 可记录的行为/指标（睡眠、饮水、训练、学习、记账……）；
- 模块页是自包含的 v3 页面，多数写 `lifeflow-days-v1`；
- 模块不是目标；目标可以调用多个模块。

### 今日保底（P0，已实现）

- `pages/core/floors.js` + 壳层 `#floorsCard`；
- 13 个保底、4 项打分、5 个「最紧预算」；
- 每天只选 3 个保底，其他模块显示「今天暂停」；
- 颜色：绿/黄/红/unknown；
- 不做单一生命分。

### 目标（v2 已接壳内，v1 只读）

- v2 key：`lifeflow-goals-v2`；唯一写者 `pages/core/goals.js`；
- 旧 key：`lifeflow-goal-items` 只读保留，首次读取迁移；
- v2 字段：`id/title/vision/status/priority/primary/activeFrom/activeTo/phase/requirements/strategies/milestones/tasks`；
- 旧字段（`measure/progress/stages/tasks/step`）保存为 legacy，不伪造 requirement；
- 壳内 `#screen-goals`：列表 + 新建/编辑 sheet（名称、模块要求），入口 `记一笔 → 长期目标`；
- v3 `goals.html/goal-create.html/goal-detail.html` 也已接 `LightGoals`，作为旧模块页回退；
- **v3 的 5-tab 不是当前壳**；不要把它的样式当成产品现状。

### 习惯 / 日常（现状）

- `habit.html` 是**有持久化的工具轨**，不是纯静态：key `lifeflow-habit-items`；
- schema：`id,name,icon,tag,unit,value,barPct,seedStreak,seedDate,freq,remindTime,remindOn,order,heat[],entries[]`；
- 明确“工具轨，不进七领域养成链”，所以**没有 domain 字段**；打卡/补记写 `entries`，不伪造历史；
- 壳里的“习惯”还只是任务 `type`（`index.html`），与 `habit.html` 的实体不是同一个东西；
- `routine.html` 实际是“起床/入睡”两个睡眠锚点 + 提醒开关，**不是任务分类**；
- 所以“习惯”“日常”目前各有两种含义，做新分类前必须先消歧。

### 任务 / 日程

- 手机端「待办」`todos` / 日程 `plan` 在 `zdLight`；
- 电脑端写 `zdLight.plan/todos`，但手机端也承担日常勾选/执行（不是纯只读）；
- 任务模型已有 `freq:'none|daily|weekly|monthly'` + `dates[]` + `type:'habit'` + `count/target/last`，是“某段日期每天做什么”的雏形；
- `schedule.html` 是日程页，`todo` 是待办页，二者不要混；
- 历史研究里的 `DailyActionV2.itemId` 是唯一真正“拆解产物落到今日”的闭环，但当前静态原型没有实现。

---

## 3. 历史研究结论（目标/任务方向）

来源：`资料库备份/LifeFlow 拆解任务功能全景对比报告（含 tiimo 与 目标地图）.md`

### 3.1 LifeFlow v3 五层（自家最强形态）

```
L1 目标 GoalV2（title/vision/status/progress）
L2 关键结果 KeyResultV2（target/current/unit/deadline）
L3 策略 StrategyV2（start/end、daily/weekly cycle）
L4 周任务 WeeklyTaskV2（weekStart、deliverable）
L5 每日行动 DailyActionV2（date/time/duration、itemId）
```

- 最强闭环：`DailyActionV2.itemId` 会同步写入 Item 表，直接出现在今日视图；
- 策略层是 LifeFlow 相对目标地图的差异化资产，不要简化掉。

### 3.2 目标地图 GoalMap

- 最多 6 层；
- 同一节点可以切换语义：关键结果 / 里程碑 / 分类；
- 量化任务支持「加总 / 更新」两种算法；
- 主子任务进度联动可开关（默认只算直接子任务）；
- 自动生成每日日程。

### 3.3 Tiimo

- 产品哲学：规划应「支持你，而不是消耗你」；
- 减少启动摩擦、让时间可见、允许不完美；
- **Support the decision, don't make it for you.** AI 给建议，不替用户决定；
- 时间盲/执行功能是核心用户背景。

### 3.4 已确认的产品原则

- 不替用户做决定，只给建议；
- 30 秒单手可完成记录；
- 留白、克制、不做开发工具；
- 不做单一生命分；
- 先保底，再谈优化；
- 改环境，不加意志力。

---

## 4. 当前缺口（新需求要解决的）

1. **目标只绑定一个模块**：无法表达「薄肌需要睡眠 + 饮水 + 训练 + 饮食」。
2. **多目标共享模块没有合并规则**：两个目标都要睡眠 7h，是取 max 还是相加？未定义。
3. **目标没有时间窗口/阶段**：无法表达「这三个月考公，之后切换」。
4. **目标没有落到今天**：goal-create 的 `measure:null`，没有每日承诺生成。
5. **分类混乱**：目标 / 习惯 / 待办 / 日常四个词混用；“习惯”在壳里是任务 type、在 habit.html 是工具轨实体，“日常”在 routine.html 是睡眠锚点；不能直接拿这四个词当数据模型。
6. **今日容量没有上限**：多目标 × 多模块会生成过多事项；“一天最多 2 个大块”只是定性规则。
7. **进度不可解释**：目标 progress 是种子值，不是从模块遵守度/里程碑推导。
8. **目标落点未定**：README 一处说定目标归电脑端、一处说目标归手机端；`lifeflow-goal-items` 又有 3 个写者，违反单写者。
9. **目标与灯/保底未接线**：保底里的“推进 1 个目标”没有任何数据连接。

### 已知文档/代码不一致（改之前先核对代码）

- 套件数有 32 / 20 / 16 / 18 四种说法；以 `run-all` 当前 **32** 为准。
- v3 页文档写 41，实际 `pages/v3/*.html` 为 **47**。
- “已接灯”有 6/7/9 三种说法；以代码 `LightStore.record` 调用为准。
- `desktop.html` 仍写 `tiimoClone`；`lifeflow-goal-items` 有 3 个写者：单写者原则已被局部破坏。
- `store.dateKey` 不补零，`floors.js`/训练补零；跨模块对账会踩日期格式坑。
- 历史 Next.js/Dexie/渡劫文档属已砍掉的旧 GDD，不是当前技术栈。

---

## 5. 待确认的产品决策（不要擅自替用户定）

1. 分类体系：目标 / 承诺 / 任务 / 日常 / 收件箱？还是保留「习惯」作为类型？
2. 「习惯」是独立实体，还是「日常/承诺」的自动化属性？
3. 多个目标共享同一模块时：取最大值、取优先级最高目标、还是相加？
4. 活跃目标上限：同时最多几个？每天最多几条承诺？
5. 是否必须兼容旧 `lifeflow-goal-items`（5 条种子 + 旧字段）？
6. 第一版是「方案/提示词」还是直接改代码？
7. 是否允许修改 `goals.html` / `goal-create.html` / `goal-detail.html` / `index.html`？
8. 是否允许新增页面/数据 key，还是只扩展现有？

---

## 6. 术语表（**提案，未拍板**）

| 术语 | 定义 | 时间尺度 | 完成语义 |
|---|---|---|---|
| **目标 Goal** | 想要的结果（薄肌、考公上岸） | 周/月 | 进度，不是每天勾 |
| **策略 Strategy** | 达成目标的路径/阶段 | 2–6 周 | 阶段推进 |
| **承诺 Commitment** | 目标要求的周期剂量（睡眠 7h/天、训练 3 次/周） | 日/周 | 配额/记录 |
| **任务 Task** | 一次性、有终点的事（报名、买书） | 天/周 | done/not done |
| **日常 Routine** | 非目标驱动的维持行为（喝水、整理、走路） | 日/周 | 记录/勾选 |
| **收件箱 Inbox** | 未分类捕捉 | 随时 | 待归类 |
| **习惯 Habit** | 已被线索自动化、低摩擦的承诺/日常（建议作为属性，不是类型） | 长期 | 自动化程度/连续 |

> 这套术语的核心：**按「完成语义 + 时间尺度」分类，而不是按用户熟悉的四个词分类。**

---

## 7. 给后续 AI 的工作约束

1. 先读本文件，再读具体任务文档；不要凭行业惯例改产品模型。
2. 不改三端分工与单写者；不引入后端/账号/云同步。
3. 不破坏现有 32 套件；改代码必须跑 `node tests/run-all.mjs`。
4. 不做单一生命分、不做 20 模块每日打卡。
5. AI 只给建议，不替用户决定；不自动改计划。
6. 目标/任务/日常的术语必须统一；新增字段先做兼容，不直接覆盖旧数据。
7. 视觉遵守现有 v3：暖纸/墨色/四域色/留白；手机 390px 宽。
8. 交付物如果是提示词，必须包含：角色、背景、步骤、输出规范、边界与例外。

---

## 8. 关键文件地图

| 文件 | 作用 |
|---|---|
| `pages/index.html` | 手机壳 + 今日保底卡 + 待办/今天 |
| `pages/core/store.js` | 模块事实记录 |
| `pages/core/accounts.js` | 四账户规则 |
| `pages/core/floors.js` | 今日保底 |
| `pages/core/training.js` | 训练 v2 |
| `pages/core/goals.js` | 目标 v2 数据层 / v1 迁移 / 共享合并 |
| `pages/core/today.js` | 今日 3+3 规划器 / 完成勾选 |
| `pages/v3/goals.html` | 目标列表（种子 + 渲染） |
| `pages/v3/goal-create.html` | 目标创建（三层表单，measure:null） |
| `pages/v3/goal-detail.html` | 目标详情（阶段/任务/单一 measure） |
| `pages/v3/habit.html` | 习惯工具轨（`lifeflow-habit-items`，有持久化） |
| `pages/v3/schedule.html` | 日程 |
| `pages/desktop.html` | 电脑端规划/复盘 |
| `workbench/index.html` | 工作台 |

---

## 9. 参考文档

- `README.md` / `PROGRESS.md`
- `生命系统-保底方案-完整版.md`
- `docs/生命系统-保底模型.md`
- `docs/生命系统-全模块整体模型.md`
- `docs/训练模块-最终方案-PPL.md`
- `资料库备份/LifeFlow 拆解任务功能全景对比报告（含 tiimo 与 目标地图）.md`
- `Tiimo-App-研究报告.md`

---

## 10. 已确认的新规则（2026-10-25）

> 来源：多目标 × 多模块 × 每日集合方案评审。以下 4 条经用户确认，后续任务不得静默违反。

### 10.1 分类正交原则

- **对象**：Goal（目标）、Commitment（周期承诺）、Task（一次性任务）、Inbox（收件箱）。
- **属性**：Habit（习惯）是 Commitment 的线索/自动化程度/连续属性，不是一级存储类型。
- **视图/容器**：Routine（日常）是时间/情境视图或容器，不是一级存储类型。
- **子类型**：Floor（保底）是 `source:'floor'` 的 Commitment。
- **禁止**：把“目标 / 习惯 / 待办 / 日常”做成四个互斥的存储类型。
- **判定树**：
  1. 想要的结果、数周/数月 → Goal；
  2. 按周期重复、有配额 → Commitment；
  3. 一次性、有终点 → Task；
  4. 只回答“何时/何地” → Routine 视图；
  5. 无法判断 → Inbox。
- 本质依据：四个词分别回答“为什么 / 多自动 / 做什么 / 何时”，维度不同，不能互斥。

### 10.2 每日容量默认

- 每天最多 **3 个保底 + 3 个推进项**；推进项由目标承诺和一次性任务**共享** 3 个名额，总计最多 6 项。
- 同时最多 **3 个活跃目标**，其中 1 个主目标。
- 红状态：只保底；黄状态：最多 1 个推进项；绿状态：最多 3 个推进项。
- 3 个目标、3+3 是设计启发式，不是科学定律，必须可配置。
- 本质依据：认知负荷与执行意图支持“少而具体”，不支持无限清单。

### 10.3 共享承诺规则

- 合并键：`moduleId + metric + unit`。
- 默认 `target = max`；`goalIds` 取并集；`source` 只要含 floor 就标 floor。
- 同模块方向相反或差异过大（默认 20% 阈值）→ **显式冲突**，不静默取 max，要求用户选主目标/阶段。
- 一次行动可以同时满足多个目标的同一要求；每个目标统计各记一次，但**今日负载只算一次**。
- 本质依据：共享输入不能重复消耗容量，也不能剥夺另一个目标的功劳。

### 10.4 目标域单写者

- 新增 `pages/core/goals.js` 与 `lifeflow-goals-v2`；目标域只允许该模块写。
- 旧 `lifeflow-goal-items` **只读保留**；迁移幂等，失败回退，不覆盖旧数据。
- 旧 `measure` 不伪造 requirement，存 `legacyMeasure`，UI 显示“待配置模块”。
- 旧 5 条种子与 `progress` 保留为 `legacyProgress`，不参与新统计。
- 目标页 / 创建页 / 详情页不得直接写 localStorage；消灭现有 3 个写者。
- 本质依据：单写者是数据一致性的前提；旧数据必须可回退。

### 10.5 页面关系（与上述规则配套）

- **待办**：未排期 Task + Inbox + 今日 3+3（保底 + 推进）。
- **今天/日程**：同一批 Task/Commitment 的已排期视图；不复制数据。
- **目标**：Goal + requirements + 进度；不做每日勾选。
- **习惯**：带 `habit` 属性的 Commitment 筛选视图；不是独立存储。
- **日常**：`routine.html` 仍是起床/入睡时间锚点；不强行改造成任务分类。
- **统计**：从 Commitment/Task/模块日志派生；共享承诺按目标记功，今日负载去重。




### 10.6 实现状态（2026-10-25）

- `pages/core/goals.js`：Goal/Requirement schema、v1 迁移、共享 requirement 合并/冲突、模块默认值；目标域单写者。
- 壳内 `#screen-goals`：目标列表 + 新建/编辑 sheet；入口「记一笔 → 长期目标」；不是底部 tab。
- 「记一笔」改成三步：写一句 / 按模块记 / 看目标；明确文字记录与模块记录的区别。
- `goals.html / goal-create.html / goal-detail.html`：已接 `LightGoals`，保留为旧模块页回退；旧 v1 只读。
- 测试：`test-goals` 20、`test-today` 24、`verify_goals_v2` 9、`verify_app_goals` 14、`verify_weekly_carry` 4；`run-all` 36/36。
- 今日 3+3：`#todayPlanCard` 在待办页；3 保底 + 3 推进；共享模块合并、黄/红限流、点击勾选；`lifeflow-today-v1`。
- 模块日志：`core/today.js` 读 `lifeflow-days-v1`（睡眠/饮水/训练/学习/输出等），训练记录自动累计周配额，睡眠/饮水自动完成保底要求。
- 上周缺口：待办页 `#weeklyCarryCard`，可顺延 +2 / 降为 1 次/周 / 跳过；决策存 `lifeflow-weekly-v1`。
- 未做：目标进度统计、习惯/日常统一、任务/日程单对象。





