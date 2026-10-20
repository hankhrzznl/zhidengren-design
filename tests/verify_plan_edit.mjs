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
  localStorage.setItem("lifeflow-ledger-v1", JSON.stringify({
    v: 1, tx: [], plans: [],
    accounts: [
      { id: "a1", name: "微信钱包", type: "asset", kind: "wechat", opening: 5000, color: "#3EB575" },
      { id: "c1", name: "花呗", type: "credit", kind: "huabei", opening: 0, limit: 10000, billDay: 5, repayDay: 20, color: "#8B5CF6" }
    ]
  }));
});
await page.goto(BASE + "/v3/expense.html", { waitUntil: "load" });
await page.waitForTimeout(600);
await page.evaluate(() => {
  LightLedger.addPlan({ accountId: "c1", periods: 12, monthly: 100, name: "耳机", startDate: "2026-9-25" });
  LightLedger.addPlan({ accountId: "c1", periods: 24, monthly: 200, name: "手机", startDate: "2026-9-25" });
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);

const before = await page.evaluate(() => ({
  rows: document.querySelectorAll(".plan-row").length,
  credit: document.querySelector("#stat-credit")?.textContent,
}));
ok("两笔分期就绪", before.rows === 2 && String(before.credit).replace(/[^0-9]/g, "") === "6000", JSON.stringify(before));

/* 编辑第一笔 */
await page.click(".plan-row [data-edit]");
await page.waitForTimeout(300);
const prefill = await page.evaluate(() => ({
  name: document.querySelector("#plan-name")?.value,
  periods: document.querySelector("#plan-periods")?.value,
  monthly: document.querySelector("#plan-monthly")?.value,
  save: document.querySelector("#plan-save")?.textContent,
}));
ok("编辑表单预填原数据", prefill.name === "耳机" && prefill.periods === "12" && prefill.monthly === "100" && prefill.save === "保存修改", JSON.stringify(prefill));

await page.fill("#plan-name", "耳机Pro");
await page.fill("#plan-periods", "10");
await page.fill("#plan-monthly", "150");
await page.click("#plan-save");
await page.waitForTimeout(600);
const edited = await page.evaluate(() => ({
  rows: document.querySelectorAll(".plan-row").length,
  text: document.querySelector("#plan-list")?.textContent.replace(/\s+/g, " "),
  credit: document.querySelector("#stat-credit")?.textContent,
}));
const editedCredit = String(edited.credit || "").replace(/[^0-9]/g, "");
ok("改名称/期数/月供后生效", edited.rows === 2 && /耳机Pro/.test(edited.text) && /150 × 10/.test(edited.text) && editedCredit === "6300", JSON.stringify(edited));

const ledgerAfter = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  const p = db.plans.find((x) => x.name === "耳机Pro");
  const prin = db.tx.find((t) => t.category === "分期本金" && t.note === "耳机Pro");
  return { periods: p.periods, monthly: p.monthly, principal: p.principal, tx: prin && prin.amount };
});
ok("本金流水同步更新", ledgerAfter.periods === 10 && ledgerAfter.monthly === 150 && ledgerAfter.principal === 1500 && ledgerAfter.tx === 1500, JSON.stringify(ledgerAfter));

/* 提前结清耳机Pro：剩 10 期 × 150 = 1500 */
await page.evaluate(() => { window.confirm = () => true; });
await page.locator('.plan-row', { hasText: '耳机Pro' }).locator('[data-settle]').click();
await page.waitForTimeout(600);
const settled = await page.evaluate(() => {
  const row = [...document.querySelectorAll(".plan-row")].find((x) => x.textContent.includes("耳机Pro"));
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  return {
    text: row ? row.textContent.replace(/\s+/g, " ") : "",
    credit: document.querySelector("#stat-credit")?.textContent,
    settle: row ? !!row.querySelector("[data-settle]") : true,
    paid: db.plans.find((x) => x.name === "耳机Pro").paid,
    settled: db.plans.find((x) => x.name === "耳机Pro").settled,
  };
});
const settledCredit = String(settled.credit || "").replace(/[^0-9]/g, "");
ok("提前结清：剩余一次性还掉并标记结清", /已提前结清/.test(settled.text) && settledCredit === "4800" && settled.paid === 10 && settled.settled === true && settled.settle === false, JSON.stringify(settled));

/* 删除第二笔 */
await page.evaluate(() => { window.confirm = () => true; });
await page.locator('.plan-row', { hasText: '手机' }).locator('[data-del]').click();
await page.waitForTimeout(500);
const afterDel = await page.evaluate(() => ({
  rows: document.querySelectorAll(".plan-row").length,
  text: document.querySelector("#plan-list")?.textContent.replace(/\s+/g, " "),
  credit: document.querySelector("#stat-credit")?.textContent,
  plans: JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).plans.length,
}));
const afterDelCredit = String(afterDel.credit || "").replace(/[^0-9]/g, "");
ok("删除一笔分期并撤销本金", afterDel.rows === 1 && !/手机/.test(afterDel.text) && afterDelCredit === "0" && afterDel.plans === 1, JSON.stringify(afterDel));

/* 删掉剩下的 */
await page.click(".plan-row [data-del]");
await page.waitForTimeout(500);
const empty = await page.evaluate(() => ({
  rows: document.querySelectorAll(".plan-row").length,
  text: document.querySelector("#plan-list")?.textContent.replace(/\s+/g, " "),
  credit: document.querySelector("#stat-credit")?.textContent,
  plans: JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).plans.length,
  tx: JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).tx.filter((t) => t.category.indexOf("分期") === 0).length,
}));
ok("删空后计划与相关流水都清掉", empty.rows === 0 && /还没有分期/.test(empty.text) && empty.plans === 0 && empty.tx === 0 && String(empty.credit).replace(/[^0-9]/g, "") === "0", JSON.stringify(empty));

await page.screenshot({ path: OUT + "plan-edit.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n分期改错校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);


