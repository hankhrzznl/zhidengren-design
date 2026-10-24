import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text()); });
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => localStorage.setItem("lifeflow-train-records", JSON.stringify([
  { name: "旧硬拉", date: "2026-10-01", sets_detail: [{ weight: 100, reps: 5 }] },
  { name: "旧跑步", date: "2026-10-02", minutes: 30 }
])));

await page.goto(BASE + "/v3/training.html", { waitUntil: "load" });
await page.waitForTimeout(600);

const first = await page.evaluate(() => ({
  title: document.querySelector(".top h1")?.textContent,
  today: document.querySelector("#today-card")?.innerText.replace(/\s+/g, " "),
  tabs: [...document.querySelectorAll("#seg button")].map((b) => b.textContent),
  cycle: document.querySelectorAll(".cy").length,
}));
ok("训练页加载", first.title === "训练" && first.today.includes("Push"), JSON.stringify(first));
ok("4 天循环与三段 tab", first.cycle === 4 && first.tabs.join("/") === "今日/进度/计划", JSON.stringify(first.tabs));
ok("顶部显示第 1 周", /第 1 周/.test(await page.textContent("#cycle-label")), await page.textContent("#cycle-label"));

/* 计划编辑：Push 第一个动作改成 4 组 × 5–6 */
await page.click('#seg button[data-view="plan"]');
await page.waitForTimeout(250);
await page.click('[data-edit="push"]');
await page.waitForSelector("#plan-editor.on", { timeout: 5000 });
const firstRow = page.locator("#pe-exercises .pe-row").first();
await firstRow.locator('[data-f="name"]').click();
await page.click("#pe-library");
await page.waitForSelector("#exercise-picker.on", { timeout: 5000 });
await page.fill("#ep-search", "保加利亚");
await page.click(".ep-item");
await page.waitForTimeout(200);
const picked = await firstRow.evaluate((row) => ({
  name: row.querySelector('[data-f="name"]').value,
  muscle: row.querySelector('[data-f="muscle"]').value,
}));
ok("动作库选中并带肌群", picked.name === "保加利亚分腿蹲" && picked.muscle === "quads", JSON.stringify(picked));
await page.click("#pe-library");
await page.fill("#ep-search", "杠铃卧推");
await page.click(".ep-item");
await page.waitForTimeout(200);
const restored = await firstRow.locator('[data-f="name"]').inputValue();
ok("动作库可换回卧推", restored === "杠铃卧推", restored);
await firstRow.locator('[data-f="sets"]').fill("4");
await firstRow.locator('[data-f="reps"]').fill("5–6");
await page.click("#pe-save");
await page.waitForTimeout(300);
const editedPlan = await page.evaluate(() => JSON.parse(localStorage.getItem("lifeflow-train-v2")).plan[0].strength[0]);
ok("计划可改组数/次数", editedPlan.sets === 4 && editedPlan.reps === "5–6", JSON.stringify(editedPlan));
await page.click('#seg button[data-view="today"]');
await page.waitForTimeout(250);

await page.click("#start-btn");
await page.waitForSelector("#session.on", { timeout: 5000 });
ok("开始训练打开播放器", await page.isVisible("#session.on"));

const strength = page.locator(".ex-card").filter({ hasText: "杠铃卧推" }).first();
ok("计划编辑进入训练", /4 × 5–6/.test(await strength.locator(".ex-head").innerText()), await strength.locator(".ex-head").innerText());
await strength.locator('input[data-f="weight"]').first().fill("60");
await strength.locator('input[data-f="reps"]').first().fill("8");
await strength.locator("select[data-f=rpe]").first().selectOption("8");
await strength.locator(".set-ok").first().click();
await page.waitForTimeout(300);
ok("组行可填重量/次数/RPE", await strength.locator(".set-row.done").count() === 1);

const cardio = page.locator(".ex-card").filter({ hasText: "低冲击有氧" }).first();
await cardio.locator('input[data-f="minutes"]').fill("15");
await cardio.locator("[data-cardio-ok]").click();
await page.waitForTimeout(200);
await page.click("#finish-btn");
await page.waitForSelector("#summary.on", { timeout: 5000 });
const sum = await page.evaluate(() => ({
  min: document.querySelector("#sum-min")?.textContent,
  vol: document.querySelector("#sum-vol")?.textContent,
  cardio: document.querySelector("#sum-cardio")?.textContent,
}));
ok("总结显示时长/容量/有氧", Number(sum.min) >= 1 && sum.vol === "480" && sum.cardio === "15", JSON.stringify(sum));

const store = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["运动"] || []).length, value: (d.byMod["运动"] || [])[0]?.value };
});
ok("一次 session 只写一条运动分钟", store.n === 1 && store.value >= 1, JSON.stringify(store));

await page.click("#summary-close");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
ok("重载后不重复弹训练", !(await page.isVisible("#session.on")));

await page.click('#seg button[data-view="progress"]');
await page.waitForTimeout(300);
await page.fill("#in-weight", "72.4");
await page.fill("#in-waist", "81");
await page.click("#save-body");
await page.waitForTimeout(300);
const body = await page.evaluate(() => ({
  w: document.querySelector("#body-weight")?.textContent,
  waist: document.querySelector("#body-waist")?.textContent,
}));
ok("体重/腰围可记录", body.w === "72.4" && body.waist === "81", JSON.stringify(body));
const prs = await page.evaluate(() => ({
  rows: document.querySelectorAll("#pr-list .pr-row").length,
  text: document.querySelector("#pr-list")?.innerText || "",
}));
ok("PR 卡显示最好成绩", prs.rows === 4 && /杠铃卧推/.test(prs.text) && /60×8/.test(prs.text), JSON.stringify(prs.text.replace(/\s+/g, " ")));
const legacy = await page.evaluate(() => ({
  show: getComputedStyle(document.querySelector("#legacy-card")).display !== "none",
  text: document.querySelector("#legacy-list")?.innerText || "",
}));
ok("旧记录只读展示", legacy.show && /旧硬拉/.test(legacy.text) && /100kg × 5/.test(legacy.text), JSON.stringify(legacy.text.replace(/\s+/g, " ")));

await page.click('#seg button[data-view="plan"]');
await page.waitForTimeout(300);
const plan = await page.evaluate(() => ({
  days: document.querySelectorAll(".plan-day").length,
  text: document.querySelector("#plan-list")?.innerText || "",
}));
ok("计划页是 PPL 4 天", plan.days === 4 && /Push/.test(plan.text) && /Legs/.test(plan.text), JSON.stringify(plan.days));

await page.click('#deload-mode button[data-mode="B"]');
await page.waitForTimeout(250);
const mode = await page.evaluate(() => JSON.parse(localStorage.getItem("lifeflow-train-v2")).profile.deloadMode);
ok("减载模式可切到 B", mode === "B", String(mode));

await page.click("#force-deload");
await page.waitForTimeout(250);
const forced = await page.evaluate(() => JSON.parse(localStorage.getItem("lifeflow-train-v2")).profile.forceDeload);
ok("可手动进入减载", forced === true, String(forced));
await page.click("#force-deload");

const dlPromise = page.waitForEvent("download");
await page.click("#export-data");
const dl = await dlPromise;
ok("可导出训练数据 JSON", /^lifeflow-train-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());

await page.click('#seg button[data-view="today"]');
await page.waitForTimeout(250);
await page.click("[data-del-session]");
await page.waitForTimeout(400);
const afterDel = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["运动"] || []).length, empty: !document.querySelector("[data-del-session]") };
});
ok("删除最近训练并回滚分钟", afterDel.n === 0 && afterDel.empty, JSON.stringify(afterDel));

await page.screenshot({ path: OUT + "training-v2.png", fullPage: false });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n训练页校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
