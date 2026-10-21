import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());

await page.goto(BASE + "/v3/quick-setup.html", { waitUntil: "load" });
await page.waitForTimeout(500);

const plan = await page.evaluate(() => ({
  text: document.body.innerText.replace(/\s+/g, " "),
  importLink: document.querySelector('.btns a[href="bill-import.html"]')?.getAttribute("href") || "",
  cloud: !!document.querySelector("#inbox-url"),
  day: document.querySelector("#rem-day")?.value,
}));
ok("页面是「每月 1 号 CSV」方案", /每月 1 号/.test(plan.text) && /支付宝 CSV \+ 微信 CSV/.test(plan.text), plan.text.slice(0, 80));
ok("有去导入入口", plan.importLink === "bill-import.html", plan.importLink);
ok("不再显示 Supabase 云收件箱", plan.cloud === false);
ok("提醒默认 1 号", plan.day === "1", String(plan.day));

/* 保存提醒 */
await page.fill("#rem-day", "1");
await page.click("#rem-save");
await page.waitForTimeout(300);
const rem = await page.evaluate(() => ({
  cfg: JSON.parse(localStorage.getItem("lifeflow-import-reminder") || "null"),
  status: document.querySelector("#rem-status")?.textContent || "",
  ics: window.LightReminder.ics(1),
}));
ok("提醒保存成功", rem.cfg && rem.cfg.day === 1 && /每月 1 日/.test(rem.status), JSON.stringify(rem.cfg));
ok("能生成每月 1 号的日历", /BYMONTHDAY=1/.test(rem.ics) && /VALARM/.test(rem.ics));

/* 本月完成 */
await page.click("#rem-done");
await page.waitForTimeout(300);
const done = await page.evaluate(() => ({
  cfg: JSON.parse(localStorage.getItem("lifeflow-import-reminder") || "null"),
  status: document.querySelector("#rem-status")?.textContent || "",
}));
ok("本月完成会记录并收起待办", done.cfg && !!done.cfg.lastDone && /本月已完成/.test(done.status), JSON.stringify(done));

await page.screenshot({ path: OUT + "quick-setup.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n自动记账页校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
