# 交接给 WorkBuddy · 删除 Supabase「云收件箱」项目

> 目的：零足迹。删除 2026-10-21 为「云收件箱」建的空转项目，不影响网站、CSV 导入、代码仓库。
> 只删这一个项目；`class-checkin`、`lifeflow` 两个旧项目不要动。

---

```
任务：帮我删除 Supabase 上的「云收件箱」空项目，做到零足迹。
项目目录：C:\新的开始\Tiimo Mobile UI.design
线上：https://my-lifeos.com/app/

【目标对象（只删这一个）】
- 平台：Supabase，org: hankhrzznl's Org，Free 套餐
- Project Ref: ognfgzmllnqwuoexhpyj
- Project URL: https://ognfgzmllnqwuoexhpyj.supabase.co
- 项目名：控制台显示的名字（可能是 zhidengren；以 ref 为准）
- 里面只有：public.inbox 一张空表 + 一个 inbox Edge Function + 一个 INBOX_TOKEN Secret
- 已知：inbox 表 0 行；App 端从未在真实设备配置过；代码保留，不影响 CSV 导入

【绝对不要做】
1. 不要删 class-checkin、lifeflow 这两个既有项目（它们处于 paused）。
2. 不要执行 SQL DROP / 删表 / 删函数；只走「删除项目」。
3. 不要改代码、不要提交 git、不要部署 Vercel、不要改域名。
4. 不要导出或记录 INBOX_TOKEN / service_role / 数据库密码；截图里不能出现密钥。
5. 不要把 token 写进任何文件或聊天记录。

【凭据与操作方式】
- 登录、密码、验证码、2FA 都由我本人操作；你把浏览器交给我，不要尝试绕过。
- 如果删除需要输入项目名确认，按控制台提示输入（先念给我确认是哪个项目）。

【第 1 步：删前核对】
1. 控制台项目列表里找到 ref = ognfgzmllnqwuoexhpyj 的项目；
2. 打开它，确认：
   - 项目 URL 是 https://ognfgzmllnqwuoexhpyj.supabase.co
   - Table Editor 只有 public.inbox，且行数为 0
   - Edge Functions 只有 inbox
3. 如果不一致（有别的表/有数据），停下来告诉我，不要删。

【第 2 步：删除项目】
- Project Settings → General → 页面底部 Danger Zone → Delete project；
- 按提示输入项目名确认；
- 等待删除完成（通常几十秒）。

【第 3 步：验证零足迹】
1. 控制台项目列表里不再有 ognfgzmllnqwuoexhpyj；
2. 命令行检查（期望 404 / 连接失败，而不是 403）：
   curl -s -o /dev/null -w "%{http_code}\n" https://ognfgzmllnqwuoexhpyj.supabase.co/functions/v1/inbox
   curl -s -o /dev/null -w "%{http_code}\n" https://ognfgzmllnqwuoexhpyj.supabase.co/rest/v1/
3. 确认剩余项目只有 class-checkin、lifeflow（以及你账号下其他本来就在的项目），不要误删。
4. 确认 App 端「自动记账 → 云收件箱」是空配置（没填 URL/token），不需要改代码。

【失败处理】
- 登录/2FA：暂停，让我操作。
- 项目是 paused 状态：先 Restore，再删。
- 删除按钮灰色/提示有依赖：把提示原文发我，不要强行删别的资源。
- 已经不存在：直接报告「已删除/不存在」，不要重建。
- 网络超时：重试一次；仍失败就报告，不要重复点删除。

【最后报告】
- 删除的项目名 + ref；
- 删除时间；
- 两条 curl 的返回码；
- 控制台剩余项目名单（只写名字）；
- App 端云收件箱是否为空；
- 有没有遗留 Secret / 表 / 函数（应为无）。
```
