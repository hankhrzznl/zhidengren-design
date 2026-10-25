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

await page.click('.qadd[data-g="high"] .plus-btn');
await page.waitForTimeout(300);
await page.fill("#qaInput", "唯一任务");
await page.press("#qaInput", "Enter");
await page.waitForTimeout(300);
await page.evaluate(() => closeQA());
await page.waitForTimeout(250);
const id = await page.locator("#g-inbox .task-card").first().getAttribute("data-id");
ok("待办创建一张卡", !!id, id);

await page.click("#g-inbox .task-card");
await page.waitForTimeout(250);
await page.click('#sheetBox [data-act="sched"]');
await page.waitForTimeout(200);
await page.click('#sheetBox [data-k="day"]');
await page.waitForTimeout(350);

const moved = await page.evaluate(() => {
  const todo = [...document.querySelectorAll("#g-high .task-card")].map((x) => x.getAttribute("data-id"));
  const plan = [...document.querySelectorAll("#p-day .task-card")].map((x) => x.getAttribute("data-id"));
  return { todo, plan };
});
ok("安排后只出现在日程", !moved.todo.includes(id) && moved.plan.includes(id), JSON.stringify(moved));
const stored = await page.evaluate((id) => {
  const raw = JSON.parse(localStorage.getItem("zdLight") || "null") || {};
  const todos = raw.todos || {}, plan = raw.plan || {};
  const all = [];
  Object.values(todos).forEach((l) => (l || []).forEach((x) => all.push(["todo", x.id, x.scheduledDate])));
  Object.values(plan).forEach((l) => (l || []).forEach((x) => all.push(["plan", x.id, x.scheduledDate])));
  return all.filter((x) => String(x[1]) === String(id));
}, id);
ok("只有一条逻辑任务（同一 id）", stored.length === 1 && stored[0][0] === "plan", JSON.stringify(stored));
await page.screenshot({ path: OUT + "app-task-single.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n任务单对象校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);



