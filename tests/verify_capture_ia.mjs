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
await page.waitForTimeout(700);

await page.click("#avatarBtn");
await page.waitForTimeout(250);
const capture = await page.evaluate(() => ({
  grid: !!document.querySelector("#hubAccounts"),
  planLink: !!document.querySelector("#openPlanFromCapture"),
  hint: getComputedStyle(document.querySelector("#iaHint")).display,
  steps: [...document.querySelectorAll(".rec-step span")].map((x) => x.textContent),
}));
ok("记一笔无模块网格", capture.grid === false && capture.planLink === true && capture.steps.join("/") === "写一句", JSON.stringify(capture));
ok("一次性迁移提示可见", capture.hint !== "none");

await page.click("#openPlanFromCapture");
await page.waitForTimeout(250);
const profile = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  goals: !!document.querySelector("#openGoals"),
  review: !!document.querySelector("#openReview"),
  practices: !!document.querySelector("#openPractices"),
  modules: !!document.querySelector("#openModulesProfile"),
}));
ok("我的有计划与全部模块", profile.active === "screen-profile" && profile.goals && profile.review && profile.practices && profile.modules, JSON.stringify(profile));

await page.click("#openModulesProfile");
await page.waitForTimeout(300);
await page.fill("#modulesSearch", "睡眠");
await page.waitForTimeout(200);
const dir = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  rows: [...document.querySelectorAll("#modulesList .module-row")].map((x) => x.textContent.replace(/\s+/g, " ")),
}));
ok("全部模块可搜索", dir.active === "screen-modules" && dir.rows.some((x) => x.includes("睡眠")), JSON.stringify(dir));

await page.evaluate(() => go("todo"));
await page.waitForTimeout(250);
await page.click('[data-quick="water"]');
await page.waitForTimeout(250);
ok("饮水快捷记带撤销", await page.evaluate(() => document.querySelector("#undoToast").classList.contains("show")));
await page.click("#undoBtn");
await page.waitForTimeout(250);
ok("撤销后不留记录", await page.evaluate(() => !window.LightStore.readDay(window.LightStore.today()).records.some((r) => r.mod === "饮水")));
await page.click('[data-quick="water"]');
await page.waitForTimeout(250);
await page.click('[data-quick="sleep"]');
await page.waitForTimeout(200);
await page.click('#sheetBox [data-qk="7"]');
await page.waitForTimeout(300);
const writes = await page.evaluate(() => {
  const recs = window.LightStore.readDay(window.LightStore.today()).records;
  return {
    water: recs.filter((r) => r.mod === "饮水").map((r) => r.value),
    sleep: recs.filter((r) => r.mod === "睡眠").map((r) => r.value),
  };
});
ok("快捷饮水写 store", writes.water.includes(250), JSON.stringify(writes.water));
ok("快捷睡眠写 store", writes.sleep.includes(7), JSON.stringify(writes.sleep));

await page.evaluate(() => go("assistant"));
await page.waitForTimeout(250);
await page.click("#recBackfill");
await page.fill("#recInput", "昨天忘了记");
await page.click("#recSave");
await page.waitForTimeout(300);
const backfill = await page.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const notes = JSON.parse(localStorage.getItem("zdLight") || "{}").notes || {};
  return { key: k, list: (notes[k] || []).map((n) => n.t) };
});
ok("补记昨天写入昨天", backfill.list.includes("昨天忘了记"), JSON.stringify(backfill));
await page.screenshot({ path: OUT + "app-capture-ia.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n记一笔 IA 校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
