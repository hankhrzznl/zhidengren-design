import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
const setup = await page.evaluate(() => {
  localStorage.clear();
  const now = new Date();
  const off = (now.getDay() + 6) % 7;
  const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const mon = new Date(now); mon.setDate(now.getDate() - off);
  const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
  const today = key(now);
  localStorage.setItem("lifeflow-floors-v1", JSON.stringify({ v: 1, days: { [today]: { sleep: 4, soreness: 4, mood: 4, stress: 4, tightest: "energy", chosen: ["sleep", "protein", "walk"], done: [] } } }));
  localStorage.setItem("lifeflow-goals-v2", JSON.stringify({ v: 2, items: [{
    id: "g-carry", title: "练成薄肌", status: "active", activeFrom: key(prevMon), priority: 1,
    requirements: [{ id: "r-train", moduleId: "training", metric: "sessions", target: 3, unit: "次", cadence: "weekly" }]
  }] }));
  return { mon: key(mon), prevMon: key(prevMon), today };
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);

const card = await page.evaluate(() => ({
  visible: getComputedStyle(document.querySelector("#weeklyCarryCard")).display !== "none",
  text: document.querySelector("#wcList")?.innerText.replace(/\s+/g, " "),
}));
ok("上周缺口卡出现", card.visible && /训练/.test(card.text || "") && /还差 3/.test(card.text || ""), JSON.stringify(card));
await page.screenshot({ path: OUT + "app-weekly-carry.png" });

await page.click('[data-wc="carry"]');
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({
  card: getComputedStyle(document.querySelector("#weeklyCarryCard")).display,
  weekly: document.querySelector("#tpWeekly")?.textContent,
  plan: document.querySelector("#tpList")?.innerText.replace(/\s+/g, " "),
  decision: JSON.parse(localStorage.getItem("lifeflow-weekly-v1") || "null"),
}));
ok("顺延后卡片收起", after.card === "none");
ok("顺延 +2 应用到本周", /本周 0\/5/.test(after.plan || ""), after.plan);
const dec = Object.values(after.decision?.decisions || {})[0];
ok("顺延决策已持久化", dec && dec.action === "carry" && dec.amount === 2, JSON.stringify(dec));

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n周缺口校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

