# 自动记账 · Supabase 云收件箱方案

> 目标：快捷指令**不打开 Safari**，直接把消费写进云端；记账页打开时自动拉取。
> 适用：想「手机付完款，记账 App 一开就已经记好」；愿意接受数据放在自己的 Supabase 项目里。

---

## 一、为什么这样最科学

之前的两条路：

| 方案 | 问题 |
|---|---|
| URL 打开记账页 | 每次要跳到 Safari，慢、打断；后台不能写 |
| 纯本地 | 多设备不同步；快捷指令只能借浏览器 |

**云收件箱**把「采集」和「账本」拆开：

```
快捷指令 ──POST──► Supabase Edge Function ──► inbox 表
                                              │
记账页打开 ──GET──► Edge Function ──► 拉取未处理条目 ──► 本地账本
```

- 只多一张 `inbox` 表，不重写账本；
- 快捷指令用「获取 URL 内容」POST，1 秒完成，不开浏览器；
- App 仍以本地账本为准，云只做「收件箱」；
- 不需要 Supabase Auth（用个人 token），配置成本最低。

**边界**：这不是完整云同步——账本仍在各自设备；两台设备都会从同一个收件箱拉取，但各自的账本不互相合并。要做完整同步，才需要账号体系 + 账本上云。

---

## 二、部署（10 分钟）

### 1. 建项目

1. 打开 <https://supabase.com> → New project；
2. 记下 **Project URL**（`https://xxxx.supabase.co`）；
3. 免费额度足够个人使用。

### 2. 建表

Supabase → SQL Editor → 粘贴执行 `supabase/schema.sql`：

- 建 `public.inbox`；
- 开启 RLS 且**不建策略**：anon 读不到，只有 service_role 能访问。

### 3. 部署 Edge Function

任选一种：

**A. 用 CLI**

```bash
npm i -g supabase
supabase login
supabase link --project-ref xxxx
supabase functions deploy inbox --no-verify-jwt
supabase secrets set INBOX_TOKEN=换成一串长随机
```

**B. 用 Dashboard**

Edge Functions → New function → 名称 `inbox` → 粘贴 `supabase/functions/inbox/index.ts` → 在 Secrets 里加 `INBOX_TOKEN`。

> `--no-verify-jwt` 是必须的：快捷指令不会带 Supabase JWT，鉴权由 `INBOX_TOKEN` 负责。

### 4. App 里配置

记账 → 自动记账 → 云收件箱：

- URL 填 `https://xxxx.supabase.co/functions/v1/inbox`；
- Token 填你刚设的 `INBOX_TOKEN`；
- 保存 → 点「立即拉取」验证。

配置存在本机 `localStorage['lifeflow-inbox-config']`。

### 5. 快捷指令改成 POST

新建/修改「记一笔」：

1. **获取 URL 内容**；
2. URL：`https://xxxx.supabase.co/functions/v1/inbox?token=你的token`；
3. 方法：**POST**；
4. 请求体：**JSON**：

```json
{
  "amount": 38.5,
  "cat": "餐饮",
  "note": "午饭",
  "account": "微信钱包",
  "date": "2026-10-20"
}
```

金额用「从输入中获取数字」的变量替换。

短信自动化同理：触发后把解析出的金额 POST 上去。

---

## 三、拉取规则（客户端）

`pages/core/cloud-inbox.js`：

- GET 收件箱（最多 200 条，按创建时间升序）；
- 已处理过的 id 存在 `lifeflow-inbox-seen`，不会重复入账；
- 账户名匹配不到时，回退到第一个资产账户；
- 没有账户时**跳过但不标记**，补账户后下次还能补记；
- 日期只取 `YYYY-MM-DD`；
- 收入 `type: "income"` 也能处理。

记账页每次打开自动拉一次；也可以在「自动记账」页手动「立即拉取」。

---

## 四、安全

- `INBOX_TOKEN` 是唯一的写入口令，**不要发到公开仓库**；泄露了就 `supabase secrets set` 换一个，旧 token 立即失效。
- `inbox` 表开了 RLS 且无策略，anon key 也读不到；Edge Function 用 service_role 只做服务端操作。
- App 端 token 存在本机 localStorage；共用设备时注意。
- 收件箱只增不减，建议定期清：

```sql
delete from public.inbox where created_at < now() - interval '90 days';
```

---

## 五、成本

- Supabase 免费档：500MB 数据库、每月 50 万 Edge Function 调用；
- 个人记账每天几十条，远远用不完；
- 不想用云了：清空 App 里的 URL 即可，本地账本不受影响。

---

## 六、和现有方案的关系

```
快捷指令 POST ─► 云收件箱 ─► 打开记账页自动拉取   ← 最自动
快捷指令 ─► URL 记账页（打开即记）               ← 不用云，但要开 Safari
复制账单 ─► 粘贴账单                             ← 不配快捷指令也能用
```

三种可以并存；云收件箱只是把「采集」这一步从浏览器挪到了服务端。

---

## 七、后续（可选）

1. 账本整体上云（完整多设备同步）——需要 Auth + 增量同步 + 冲突处理；
2. 收件箱自动清理（pg_cron）；
3. 拉取失败重试与离线队列；
4. 在 Supabase 里直接做月度统计，App 只读。
