# 部署到 Vercel + `my-lifeos.com`

> 现状（2026-10-19）：`my-lifeos.com` 的 DNS 在 **DNSPod**（`stage/puppis.dnspod.net`），
> 顶点 A 已指向 Vercel（`216.198.79.1`），`www` 走旧项目的 CNAME（`a41e7db024709c84.vercel-dns-017.com`）。
> 新仓库：`https://github.com/hankhrzznl/zhidengren-design`（静态三端 + 落地页）。

## 先看一个硬约束：localStorage 按 origin 隔离

三端现在是**同一份本地数据**：手机端写 `zdLight.logs/moods`，电脑端读写 `zdLight.plan/todos`，工作台只读。

- `my-lifeos.com` / `app.my-lifeos.com` / `desktop.my-lifeos.com` 是**三个不同 origin**，localStorage 互不可见。
- 一旦拆成子域名，电脑端打开会看不到手机端记的灯和计划——这不是 bug，是浏览器的同源策略。

所以有两条路，先选一条再动 DNS。

---

## 方案 A（推荐）：一个项目 + 主域名下的三个路径

```
https://my-lifeos.com/          落地页（三个入口）
https://my-lifeos.com/app/      手机端
https://my-lifeos.com/desktop/  电脑端
https://my-lifeos.com/work/     工作台
```

- 同一 origin，**数据互通**；一个 Vercel 项目、一个域名、一套 HTTPS。
- 仓库已内置构建：`scripts/build-vercel.mjs` 把三端组装进 `dist/`（`/app`、`/desktop`、`/work`），并改写落地页链接与电脑端「返回手机版」。

### Vercel 设置（New Project → 导入 `zhidengren-design`）

| 项 | 值 |
|---|---|
| Framework Preset | **Other** |
| Build Command | `node scripts/build-vercel.mjs` |
| Output Directory | `dist` |
| Install Command | `echo skip`（仓库没有依赖，避免 Vercel 跑 npm install 报错） |
| Node Version | 22.x（与本地一致） |

### 域名

1. 先把 `my-lifeos.com` 从**旧项目**里移除（旧项目 → Settings → Domains → Remove），否则新项目加不上；
2. 新项目 → Settings → Domains → 添加 `my-lifeos.com`；
3. `www.my-lifeos.com` 建议设成 **Redirect to `my-lifeos.com`**（Vercel Domains 里一键）。

### DNS（DNSPod）

| 主机记录 | 类型 | 值 | 说明 |
|---|---|---|---|
| `@` | A | `216.198.79.1` | 已存在，保持不变 |
| `www` | CNAME | `cname.vercel-dns.com` | 或按 Vercel 提示；也可删掉 `www` 只用裸域 |

### 验收

```bash
# 一键自检（推荐；纯 Node，10 条断言）
node scripts/check-live.mjs https://my-lifeos.com

# 或者逐条 curl
curl -I https://my-lifeos.com/
curl -I https://my-lifeos.com/app/
curl -I https://my-lifeos.com/desktop/
curl -I https://my-lifeos.com/work/
```

- 四个都 200；`/app/core/light.js`、`/app/tokens.css`、`/app/manifest.json`、`/app/sw.js` 都 200；
- 落地页三个入口指向 `app/` `desktop/` `work/`，没有残留 `pages/` 路径；
- 手机端能在电脑端看到同一盏灯（同源共享）；
- 电脑端「返回手机版」跳到 `/app/`；
- HTTPS 下 Service Worker 生效（`/app/sw.js`，scope `/app/`）。

本地等价验证：`node scripts/build-vercel.mjs`，然后 `python -m http.server 8902 -d dist`，再 `node scripts/check-live.mjs http://127.0.0.1:8902`。

---

## 方案 B：主域名 + 两个子域名（地址更清晰，但数据会断）

```
https://my-lifeos.com/            手机端（主域名）
https://desktop.my-lifeos.com/    电脑端
https://work.my-lifeos.com/       工作台
```

### 三个 Vercel 项目

| 项目 | Root Directory | Build Command | Output | 域名 |
|---|---|---|---|---|
| mobile | `pages` | 留空 | `.` | `my-lifeos.com` |
| desktop | `pages` | `cp desktop.html index.html` | `.` | `desktop.my-lifeos.com` |
| work | `workbench` | 留空 | `.` | `work.my-lifeos.com` |

> mobile 与 desktop 共用 `pages/`，靠 Build Command 把入口换成 `desktop.html`；不要给 `pages/` 放 `vercel.json` 的 rewrite，否则两个项目会互相影响。

### DNS（DNSPod）

| 主机记录 | 类型 | 值 |
|---|---|---|
| `@` | A | `216.198.79.1` |
| `desktop` | CNAME | `cname.vercel-dns.com` |
| `work` | CNAME | `cname.vercel-dns.com` |

每个子域名在对应 Vercel 项目里 Add Domain，等 Vercel 显示 Valid 即可。

### 代价：三端数据不互通

`desktop.my-lifeos.com` 打不开 `my-lifeos.com` 的 localStorage。要恢复「电脑端读手机端的灯/计划」，需要二选一：

1. **共享存储桥**：在主域放一个只负责存取的 `bridge.html`，子域名用隐藏 iframe + `postMessage` 代理 `localStorage`（纯前端，改动集中在一个小 `storage-bridge.js`）；
2. **接后端**：你原来的 `lifeflow` 已经用过 Supabase，可以把 `zdLight` / `wb_*` 迁到 Supabase，三端按用户同步（工作量大，但跨设备也能用）。

在这之前，方案 B 的三个入口会各自是「空的」——演示能用，真实使用会断。

---

## 切换前检查清单

- [ ] 选定 A 或 B（推荐 A）；
- [ ] 旧 Vercel 项目是否还需要：不需要就把 `my-lifeos.com` 域名移走，避免冲突；
- [ ] `www` 是否保留：建议 301 到裸域；
- [ ] 部署后用手机 + 电脑各开一次，确认灯/计划能互相读到；
- [ ] 旧站点如果还有用户数据（localStorage），换域名/路径会读不到——本地数据不会跟着走。

## 本地已经准备好的东西

- `scripts/build-vercel.mjs`：组装 `dist/`（路径化 + 链接改写 + 关键文件校验）；
- `vercel.json`：Build Command / Output / Service Worker 不缓存头；
- `tests/verify_vercel_dist.mjs`：**10 条**断言，验证四路径可达、无 404、电脑端能读到手机端写的灯与任务、返回链接正确；已并入 `run-all`（18/18）。
