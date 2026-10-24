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
await page.waitForTimeout(1000);


ok("壳层显示今日保底卡", await page.isVisible("#floorsCard"));
await page.click("#flEdit");
await page.waitForSelector("#flSheet.on", { timeout: 3000 });
ok("打开保底面板", await page.isVisible("#flSheet.on"));

await page.click('[data-score="sleep"][data-v="3"]');
await page.click('[data-tight="time"]');
await page.waitForTimeout(200);
await page.click("#flSave");
await page.waitForTimeout(300);
const card = await page.evaluate(() => ({
  color: document.querySelector("#floorsCard")?.getAttribute("data-color"),
  badge: document.querySelector("#flColor")?.textContent,
  chips: [...document.querySelectorAll("#flChips .fl-chip")].map((x) => x.textContent.replace(/\s+/g, "")),
}));
ok("保存后变黄并给出 3 个保底", card.color === "yellow" && /黄/.test(card.badge || "") && card.chips.length === 3, JSON.stringify(card));

await page.click("#flChips .fl-chip");
await page.waitForTimeout(250);
const done = await page.evaluate(() => ({
  on: document.querySelector("#flChips .fl-chip")?.classList.contains("on"),
  tick: document.querySelector("#flChips .fl-chip")?.textContent.includes("✓"),
}));
ok("点保底可标记完成", done.on && done.tick, JSON.stringify(done));

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1000);

const persisted = await page.evaluate(() => ({
  color: document.querySelector("#floorsCard")?.getAttribute("data-color"),
  chips: document.querySelectorAll("#flChips .fl-chip").length,
}));
ok("刷新后保底仍保留", persisted.color === "yellow" && persisted.chips === 3, JSON.stringify(persisted));

await page.screenshot({ path: OUT + "floors-card.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n今日保底页校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);


