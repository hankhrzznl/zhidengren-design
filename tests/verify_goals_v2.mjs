import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/v3/goals.html", { waitUntil: "load" });
await page.evaluate(() => {
  localStorage.removeItem("lifeflow-goal-items");
  localStorage.removeItem("lifeflow-goals-v2");
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);

const seeded = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("lifeflow-goals-v2") || "null");
  return { n: d && d.items ? d.items.length : 0, v1: localStorage.getItem("lifeflow-goal-items") };
});
ok("目标页直接播种 v2，不写 v1", seeded.n === 5 && seeded.v1 === null, JSON.stringify(seeded));

const cards = await page.locator("#goal-list .goal-card").count();
ok("目标列表渲染 5 张卡", cards === 5, String(cards));

await page.goto(BASE + "/v3/goal-create.html", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.fill("#goal-name", "多模块测试目标");
await page.click("#add-req");
await page.click("#add-req");
const rows = page.locator("#req-list .req-row");
ok("可添加两个模块要求", (await rows.count()) === 2, String(await rows.count()));

await rows.nth(0).locator('[data-f="module"]').selectOption("sleep");
await rows.nth(0).locator('[data-f="metric"]').fill("hours");
await rows.nth(0).locator('[data-f="target"]').fill("7");
await rows.nth(0).locator('[data-f="unit"]').fill("h");
await rows.nth(1).locator('[data-f="module"]').selectOption("training");
await rows.nth(1).locator('[data-f="metric"]').fill("sessions");
await rows.nth(1).locator('[data-f="target"]').fill("3");
await rows.nth(1).locator('[data-f="unit"]').fill("次");
await rows.nth(1).locator('[data-f="cadence"]').selectOption("weekly");

const formShot = OUT + "goals-create-form.png";
await page.screenshot({ path: formShot });
await page.click("#confirm-btn");
await page.waitForTimeout(1800);

const created = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("lifeflow-goals-v2"));
  const g = d.items.filter((x) => x.title === "多模块测试目标")[0];
  return {
    n: d.items.length,
    req: g ? g.requirements.map((r) => [r.moduleId, r.target, r.cadence]) : null,
    v1: localStorage.getItem("lifeflow-goal-items"),
    id: g && g.id,
  };
});
ok("创建后写入 v2 两条要求", created.n === 6 && created.req && created.req.length === 2, JSON.stringify(created));
ok("v2 创建不写 v1", created.v1 === null, String(created.v1));

await page.goto(BASE + "/v3/goals.html", { waitUntil: "load" });
await page.waitForTimeout(500);
const cardText = await page.locator("#goal-list").innerText();
ok("列表卡片显示模块数量", /多模块测试目标/.test(cardText) && /2 个模块/.test(cardText), cardText.replace(/\s+/g, " ").slice(0, 160));

await page.goto(BASE + "/v3/goal-detail.html?id=" + encodeURIComponent(created.id), { waitUntil: "load" });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector("#fold-toggle").click());
await page.waitForTimeout(250);
const reqText = await page.evaluate(() => document.querySelector("#req-list")?.innerText.replace(/\s+/g, " "));
ok("详情显示两条模块要求", /睡眠/.test(reqText || "") && /训练/.test(reqText || ""), reqText);

await page.click("#edit-req");
await page.waitForSelector("#req-sheet.is-open", { timeout: 3000 });
const sheetRows = await page.locator("#req-edit-list .req-row").count();
ok("打开模块编辑面板", sheetRows === 2, String(sheetRows));

await page.locator("#req-edit-list .req-row").first().locator('[data-f="target"]').fill("8");
await page.screenshot({ path: OUT + "goals-req-editor.png" });
await page.click("#req-save");
await page.waitForTimeout(300);
const edited = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("lifeflow-goals-v2"));
  const g = d.items.filter((x) => x.title === "多模块测试目标")[0];
  return g.requirements[0];
});
ok("编辑要求写回 v2", Number(edited.target) === 8, JSON.stringify(edited));

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n目标 v2 页面校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
