# 交接给 WorkBuddy · Supabase 云收件箱部署提示词

> 用法：把下面整段复制给 WorkBuddy。它负责 Supabase 控制台和 App 配置；iOS 快捷指令需要用户本人在手机上完成。

---

```
任务：帮我把「执灯人」的自动记账「云收件箱」部署完成（Supabase + App 配置）。
项目目录：C:\新的开始\Tiimo Mobile UI.design
线上：https://my-lifeos.com/app/
只做 Supabase 控制台和 App 配置：不改代码、不部署 Vercel、不改域名、不提交 git、不建多余的表。

【凭据与安全规则】
1. 需要登录 Supabase 时，把浏览器交给我本人操作（密码、验证码、2FA 都不要问我要，也不要尝试绕过）。
2. 不要在任何回复、截图、终端输出、文件里出现：service_role key、数据库密码、INBOX_TOKEN 全文。
   INBOX_TOKEN 只允许显示前 4 位，例如 `a1b2…`。
3. 你可以自己生成 INBOX_TOKEN（32 位以上随机字母数字），生成后只告诉我「已写入 Supabase Secrets」以及 App 里该填什么（可私下给我一次完整值，不要截图）。
4. 不要把我给你的 token 写进仓库、文档或聊天记录。

【第 1 步：建项目】
- 打开 https://supabase.com，我登录后你接手。
- New project：
  - Name: zhidengren
  - Database Password: 让我自己设置（你不要代填，也不要记录）
  - Region: Southeast Asia (Singapore)
- 等初始化完成。
- 记下 Project Ref（形如 abcd1234）和 Project URL（https://abcd1234.supabase.co）。
成功标志：项目 Overview 正常打开。

【第 2 步：建表】
- 左侧 SQL Editor → New query。
- 内容用仓库里的 `supabase/schema.sql`（或 raw：
  https://raw.githubusercontent.com/hankhrzznl/zhidengren-design/main/supabase/schema.sql
  ），整段粘贴 → Run。
- 不要额外建 policy；RLS 保持开启、无策略（只有 service_role 能访问）。
成功标志：显示 Success. No rows returned；Table Editor 里能看到 public.inbox。

【第 3 步：部署 Edge Function】
- 左侧 Edge Functions → Deploy a new function → Via Editor。
- 名称：inbox。
- 代码用仓库里的 `supabase/functions/inbox/index.ts`（或 raw：
  https://raw.githubusercontent.com/hankhrzznl/zhidengren-design/main/supabase/functions/inbox/index.ts
  ），整段替换 → Deploy。
- 打开这个函数的 Settings：把 Verify JWT 关掉（off）。
- 同页 Secrets 新增：INBOX_TOKEN = 你生成的随机串。
成功标志：函数状态 Active；URL 是
  https://<ref>.supabase.co/functions/v1/inbox

【第 4 步：命令行验证】
- GET（期望返回 [] 或数组）：
  curl "https://<ref>.supabase.co/functions/v1/inbox?token=<token>"
- POST（期望返回一条 JSON）：
  curl -X POST "https://<ref>.supabase.co/functions/v1/inbox?token=<token>" \
    -H "Content-Type: application/json" \
    -d '{"amount":0.01,"note":"连通测试","source":"manual"}'
- 如果 GET 返回 forbidden：token 不对；401/404：Verify JWT 没关或函数名不对。

【第 5 步：App 配置】
- 打开 https://my-lifeos.com/app/v3/quick-setup.html
- 「云收件箱」填：
  - URL: https://<ref>.supabase.co/functions/v1/inbox
  - Token: INBOX_TOKEN
- 保存 → 点「发送测试」。
成功标志：页面显示「测试成功：已写入 0.01 并拉取 1 笔」；
记账页多一笔 0.01，并提示「云收件箱记了 1 笔」。

【第 6 步：iOS 快捷指令（用户本人操作，你只给配置并检查）】
给我两套可直接照抄的配置，并在我贴回截图后帮我核对字段：
A. 银行短信（全自动）
   - 快捷指令 → 自动化 → 信息 → 包含「消费」→ 立即运行
   - 动作：获取 URL 内容
   - URL: https://<ref>.supabase.co/functions/v1/inbox?token=<token>
   - 方法: POST
   - 请求体: JSON
     {"amount": <金额变量>, "cat": "日常", "note": "银行短信", "account": "你的银行卡名", "source": "sms"}
B. Apple Pay（全自动）
   - 自动化 → 交易 → 立即运行
   - 同样 POST，source 改成 "applepay"，account 填实际扣款账户
提醒我：金额用「从输入中获取数字」的变量；不要用 service_role key。

【失败处理】
- 登录 / 验证码 / 2FA：暂停，让我本人操作。
- Verify JWT 开着导致 401：回 Settings 关。
- token 错：Supabase Secrets 改，App 同步改。
- 免费项目暂停：控制台点 Restore。
- 不要重复建项目、重复建表、重复部署同名函数。

【验收标准】
1. GET 返回 [] 或数组；
2. POST 0.01 成功入库；
3. App「发送测试」成功；
4. 用真实银行短信/Apple Pay 消费后，记账页出现「云收件箱记了 1 笔」；
5. 同金额、5 分钟内、两个来源（sms/applepay）只记一次。

【最后给我一份报告】
- 做到第几步；
- Project Ref、函数 URL、INBOX_TOKEN 前 4 位；
- GET / POST / App 测试结果；
- 还差什么（例如快捷指令要我本人建）；
- 卡住的具体报错和下一步。
```
