import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => {
  localStorage.clear();
  const now = new Date();
  const off = (now.getDay() + 6) % 7;
  const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const mon = new Date(now); mon.setDate(now.getDate() - off);
  const tue = new Date(mon); tue.setDate(mon.getDate() + 1);
  const today = key(now);
  const db = { v: 1, days: {} };
  const add = (d, mod, metric, value) => {
    const k = key(d);
    db.days[k] = db.days[k] || { records: [] };
    db.days[k].records.push({ id: mod + k, mod, metric, value, at: k + "T18:00:00", source: "test", meta: {} });
  };
  add(mon, "运动", "minutes", 45);
  add(tue, "运动", "minutes", 50);
  add(now, "睡眠", "hours", 7.5);
  add(now, "饮水", "ml", 1500);
  add(now, "学习", "minutes", 60);
  localStorage.setItem("lifeflow-days-v1", JSON.stringify(db));
  localStorage.setItem("lifeflow-floors-v1", JSON.stringify({ v: 1, days: { [today]: { sleep: 4, soreness: 4, mood: 4, stress: 4, tightest: "energy", chosen: ["sleep", "protein", "walk"], done: ["sleep"] } } }));
  localStorage.setItem("lifeflow-goals-v2", JSON.stringify({ v: 2, items: [
    { id: "g-thin", title: "练成薄肌", status: "active", activeFrom: key(mon), priority: 1, requirements: [
      { id: "r-sleep", moduleId: "sleep", metric: "hours", target: 7, unit: "h", cadence: "daily" },
      { id: "r-train", moduleId: "training", metric: "sessions", target: 3, unit: "次", cadence: "weekly" }
    ] },
    { id: "g-exam", title: "考公", status: "active", activeFrom: key(mon), priority: 2, requirements: [
      { id: "r-study", moduleId: "study", metric: "minutes", target: 60, unit: "min", cadence: "daily" }
    ] }
  ] }));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
await page.evaluate(() => go("profile"));
await page.waitForTimeout(250);
await page.click("#openReview");
await page.waitForTimeout(400);

const review = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  tabbar: getComputedStyle(document.querySelector(".tabbar")).display,
  range: document.querySelector("#reviewRange")?.textContent,
  goals: document.querySelector("#reviewGoals")?.innerText.replace(/\s+/g, " "),
  quotas: document.querySelector("#reviewQuotas")?.innerText.replace(/\s+/g, " "),
  modules: document.querySelector("#reviewModules")?.innerText.replace(/\s+/g, " "),
}));
ok("周复盘在壳内并隐藏底栏", review.active === "screen-review" && review.tabbar === "none", JSON.stringify(review));
ok("周复盘显示目标", /练成薄肌/.test(review.goals || "") && /考公/.test(review.goals || "") && /%/.test(review.goals || ""), review.goals);
ok("周复盘显示 2/3 配额", /2\/3/.test(review.quotas || ""), review.quotas);
ok("周复盘显示模块记录", /2/.test(review.modules || "") && /7\.5/.test(review.modules || "") && /1\.5/.test(review.modules || ""), review.modules);
await page.screenshot({ path: OUT + "app-weekly-review.png" });

await page.fill("#reviewNote", "把训练从周日挪到周三");
await page.click("#reviewSave");
await page.waitForTimeout(300);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
await page.evaluate(() => go("profile"));
await page.waitForTimeout(200);
await page.click("#openReview");
await page.waitForTimeout(350);
const savedNote = await page.inputValue("#reviewNote");
ok("下周只改一件事可保存", savedNote === "把训练从周日挪到周三", savedNote);

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n周复盘校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

