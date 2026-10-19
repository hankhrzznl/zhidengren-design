# 给 WorkBuddy 的「资料库」同步提示词

> 用法：整段复制给 WorkBuddy（资料库 skill）。它只需要读文件 + 更新资料库，不要改代码、不要部署。

---

## 任务

把 WorkBuddy 的「资料库」同步到执灯人项目的**当前真实状态**（2026-10-19）。这是一次**纠偏式同步**：以本提示词的事实清单 + 仓库里的文档为准，覆盖资料库里过时的说法，不要保留旧结论。

项目根目录：`C:\新的开始\Tiimo Mobile UI.design`

## 第一步：先读这些文件（按顺序）

1. `README.md` —— 三种形式、运行方式、部署、数据表
2. `PROGRESS.md` —— 当前状态、最近变更、下一步
3. `docs/部署-Vercel-域名.md` —— 域名与 Vercel 的真实架构
4. `docs/sync/sync-2026-10-18-goal.md` —— P0/P1/P2 验收证据
5. `整改清单-工程模式.md` —— 工程整改项与状态
6. `workbench/index.html` 顶部注释 —— 工作台的定位

## 第二步：用下面的事实覆盖资料库（这些是现状）

### 1. 三种形式 = 三个时间尺度（不是三个"端"）

| 形式 | 入口 | 时间尺度 | 职责 | 数据写入 |
|---|---|---|---|---|
| 手机端 | `/app/` | 当下 | 采集/执行：记一笔、待办、今天、灯 | `zdLight.logs/moods`、`lifeflow-days-v1` |
| 工作台 | `/work/` | 一天 | 干活/学习/专注/日记录/日复盘 | `wb_lifeflow_daywork_v2` |
| 电脑端 | `/desktop/` | 一周/一月 | 规划/复盘：日/周/月视图、成长 | `zdLight.plan/todos` |

- 工作台**不是**开发工具/控制台/JSON 检查器；它的导航是「今日 / 模块 / 账本 / 日复盘」。
- 电脑端导航是「日视图 / 周视图 / 月视图 / 成长」；「方向」「四域」已从电脑端移除，归手机端产品模型。
- 手机端 5 个 tab：待办 / 今天 / 我的 / 灯 + 记一笔；**状态栏（时间、信号、WiFi、电量）已删除**，顶部只有灵动岛。

### 2. 线上地址（唯一正确的部署事实）

- 主入口：https://my-lifeos.com/
- 手机端：https://my-lifeos.com/app/
- 电脑端：https://my-lifeos.com/desktop/
- 工作台：https://my-lifeos.com/work/
- `www.my-lifeos.com` → 308 → `https://my-lifeos.com/`
- GitHub Pages 镜像：https://hankhrzznl.github.io/zhidengren-design/

架构：**一个 Vercel 项目 + 主域名下三个路径**，不是三个子域名。

- 原因：三端靠 `localStorage` 共享同一份数据，子域名是不同 origin，会把数据切断。
- 资料库里如果还写着「主域名 + 两个子域名」的方案，请标记为**备选/未采用**，不要当成现状。

### 3. 仓库与部署

- 代码仓库（公开）：https://github.com/hankhrzznl/zhidengren-design
- Vercel 项目：`zhidengren-design`，Production Branch = `main`；生产别名 `https://zhidengren-design.vercel.app`
- 发布分支：本地 `design-v8`（orphan，只含公开文件）→ 推 `design` 远端的 `main` → Vercel 自动重建
- 本地 `master` 跟踪了 `.workbuddy/` 与 `资料库备份/`，**绝不能直接 push 到公开仓库**
- 旧项目：`lifeflow`（原 `my-lifeos.com`，现在只剩 `lifeflow-delta-vert.vercel.app`）、`lifeflow-app`（占用 `app.my-lifeos.com`，未动）
- `origin` = `lifeflow` 仓库（只放了 `design-v8` 分支）；`design` = `zhidengren-design` 仓库

### 4. 构建与验证

- 构建：`node scripts/build-vercel.mjs` → 产出 `dist/`（`/app`、`/desktop`、`/work` + 落地页，自动改写链接）
- 本地产物测试：`node tests/verify_vercel_dist.mjs`（10 条）
- 线上自检：`node scripts/check-live.mjs https://my-lifeos.com`（10 条）
- 全量回归：`node tests/run-all.mjs` → **18/18 套件**
  - blueprint 33、theme 25、clock 16、a11y 17、p16 11、modules2 16、mood/train 11、expense 7、plan 29、workbench 17、loop 17、sugg 8、gate 8、modules 116、landing 6、vercel-dist 10、store 29、light 51
- 静态校验：`node scripts/verify.mjs`（31/31）

### 5. 关键规则（写进资料库，不要丢）

- 数据单写者：手机写日志/心情；电脑端写 `plan/todos`；工作台写 `wb_*`；其余只读。
- 日夜主题 key：`lifeflow-theme`，三端共用；共享令牌在 `pages/tokens.css`。
- 灯内核唯一实现：`pages/core/light.js`（手机/电脑/测试共用）。
- 部署更新流程：master 开发 → `git checkout master -- …` 同步到 `design-v8` → `git push design design-v8:main`。
- 安全：`.workbuddy/`、`资料库备份/`、`_sync/` 不进公开仓库；Vercel token 用完即删（已删除）。
- 已知环境坑：本机 git 需要 `http.proxy=http://127.0.0.1:7890`；Node 22 的 `fs.cpSync` 在这台 Windows 会崩，构建脚本用手写递归拷贝；PowerShell 的 `$pid` 是只读变量。

## 第三步：更新资料库（建议的卡片结构）

请把资料库整理成这几张卡，并标注「最后同步：2026-10-19」：

1. **项目卡**：执灯人是什么、三种形式、三个时间尺度、设计正源
2. **入口卡**：四个线上 URL + www 跳转 + Pages 镜像
3. **部署卡**：Vercel 单项目路径化、发布分支、更新命令、check-live
4. **数据卡**：`zdLight` / `lifeflow-days-v1` / `wb_lifeflow_daywork_v2` / `lifeflow-theme`，以及单写者
5. **验证卡**：18 套件清单与各自断言数、两个 10 条自检
6. **决策卡**：为什么用路径不用子域名；为什么工作台不是开发工具；为什么电脑端删了方向/四域
7. **历史卡**：`lifeflow` / `lifeflow-app` 旧项目与旧域名现状（保留，避免误删）

## 第四步：删除/纠正这些过时说法

- ❌「工作台是 `workbench/cockpit.html`」→ 工作台是 `workbench/index.html`
- ❌「电脑端只有暗色/演示日期 2026-10-3」→ 已是真实日期、日夜、日/周/月
- ❌「工作台是周复盘」→ 已改日复盘
- ❌「部署在 GitHub Pages，域名未接」→ 已接 `my-lifeos.com`
- ❌「主域名 + 两个子域名」→ 备选方案，未采用
- ❌「手机端有状态栏/电量」→ 已删除
- ❌「电脑端有方向/四域」→ 已移除

## 第五步：输出同步报告

更新完后，给一份不超过 20 行的报告：

- 读了哪些文件
- 新增了哪几张卡
- 覆盖/删除了哪些旧说法
- 还有哪 1–3 个不确定、需要我确认的点

## 边界

- 只读仓库，**不要改代码、不要提交、不要部署、不要动 Vercel/GitHub 设置**
- 不要把 `.workbuddy/`、`资料库备份/`、任何 token/密钥写进资料库
- 如果发现文档与线上不一致，以**线上 + README + PROGRESS** 为准，并在报告里指出


