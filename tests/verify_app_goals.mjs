import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);

await page.click("#avatarBtn");
await page.waitForTimeout(300);
const record = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  steps: [...document.querySelectorAll(".rec-step span")].map((x) => x.textContent),
  goalEntry: !!document.querySelector("#openGoals"),
}));
ok("记一笔改成三步", record.active === "screen-assistant" && record.steps.join("/") === "写一句/按模块记/看目标", JSON.stringify(record));
ok("记一笔有长期目标入口", record.goalEntry === true);

await page.screenshot({ path: OUT + "app-record-redesign.png" });
await page.click("#openGoals");
await page.waitForTimeout(300);
const goals = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  tabbar: getComputedStyle(document.querySelector(".tabbar")).display,
  empty: getComputedStyle(document.querySelector("#goalsEmpty")).display,
}));
ok("进入壳内目标屏并隐藏底栏", goals.active === "screen-goals" && goals.tabbar === "none", JSON.stringify(goals));
ok("空目标显示引导", goals.empty !== "none", goals.empty);

await page.click("#goalsNew");
await page.waitForTimeout(250);
ok("打开新建目标面板", await page.isVisible("#goalTitle"));
await page.fill("#goalTitle", "练成薄肌");
await page.click("#goalAddReq");
await page.waitForTimeout(200);
const row = page.locator("#goalReqList .goal-req-row").first();
await row.locator('[data-f="module"]').selectOption("training");
await row.locator('[data-f="target"]').fill("3");
await page.click("#goalSave");
await page.waitForTimeout(350);
const saved = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("lifeflow-goals-v2") || "null");
  const g = d && d.items ? d.items.filter((x) => x.title === "练成薄肌")[0] : null;
  return {
    list: document.querySelector("#goalsList")?.innerText.replace(/\s+/g, " "),
    req: g ? g.requirements.map((r) => [r.moduleId, r.target]) : null,
  };
});
ok("新建目标写入壳内列表与 v2", /练成薄肌/.test(saved.list || "") && saved.req && saved.req[0][0] === "training" && saved.req[0][1] === 3, JSON.stringify(saved));
await page.screenshot({ path: OUT + "app-goals-created.png" });

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
await page.click("#avatarBtn");
await page.waitForTimeout(200);
await page.click("#openGoals");
await page.waitForTimeout(300);
ok("刷新后目标仍保留", /练成薄肌/.test(await page.locator("#goalsList").innerText()));

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n壳内目标/记一笔校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

