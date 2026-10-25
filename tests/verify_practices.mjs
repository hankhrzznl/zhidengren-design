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
  const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = key(now);
  localStorage.setItem("lifeflow-floors-v1", JSON.stringify({ v: 1, days: { [today]: { sleep: 4, soreness: 4, mood: 4, stress: 4, tightest: "energy", chosen: ["sleep", "protein", "walk"], done: ["sleep"] } } }));
  localStorage.setItem("lifeflow-goals-v2", JSON.stringify({ v: 2, items: [{ id: "g-p", title: "练成薄肌", status: "active", activeFrom: today, requirements: [{ id: "r1", moduleId: "training", metric: "sessions", target: 3, unit: "次", cadence: "weekly" }] }] }));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
await page.evaluate(() => go("profile"));
await page.waitForTimeout(250);
await page.click("#openPractices");
await page.waitForTimeout(300);

const view = await page.evaluate(() => ({
  active: document.querySelector(".screen.active")?.id,
  tabbar: getComputedStyle(document.querySelector(".tabbar")).display,
  list: document.querySelector("#practiceList")?.innerText.replace(/\s+/g, " "),
  weekly: document.querySelector("#practiceWeekly")?.innerText.replace(/\s+/g, " "),
}));
ok("日常是壳内视图", view.active === "screen-practices" && view.tabbar === "none", JSON.stringify(view));
ok("日常包含保底与目标承诺", /睡够/.test(view.list || "") && /训练/.test(view.list || ""), view.list);
ok("日常包含周配额", /本周 0\/3/.test(view.list || "") || /训练/.test(view.weekly || ""), view.list);
await page.screenshot({ path: OUT + "app-practices.png" });

const before = await page.locator("#practiceList .done").count();
await page.locator("#practiceList .tp-item:not(.done)").first().click();
await page.waitForTimeout(250);
const after = await page.locator("#practiceList .done").count();
ok("日常可勾选", after > before, JSON.stringify({ before, after }));

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n日常视图校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);



