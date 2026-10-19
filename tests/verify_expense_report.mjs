import { chromium, EXE, BASE, OUT } from "./_env.mjs";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

/* 同源里先造一本账：本月支出 150、收入 500、一个两个月前开始的分期 */
await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => {
  const d = new Date();
  const mk = d.getFullYear() + "-" + (d.getMonth() + 1);
  const ago = (n) => {
    const x = new Date(d.getFullYear(), d.getMonth() - n, 15);
    return x.getFullYear() + "-" + (x.getMonth() + 1) + "-15";
  };
  localStorage.setItem("lifeflow-ledger-v1", JSON.stringify({
    v: 1,
    accounts: [
      { id: "a1", name: "微信钱包", type: "asset", kind: "wechat", opening: 1000, color: "#3EB575" },
      { id: "c1", name: "花呗", type: "credit", kind: "huabei", opening: 0, limit: 5000, color: "#8B5CF6" }
    ],
    tx: [
      { id: "t1", ts: 1, date: mk + "-3", type: "expense", amount: 100, accountId: "a1", category: "餐饮", note: "" },
      { id: "t2", ts: 2, date: mk + "-5", type: "expense", amount: 50, accountId: "a1", category: "交通", note: "" },
      { id: "t3", ts: 3, date: mk + "-6", type: "income", amount: 500, accountId: "a1", category: "收入", note: "" }
    ],
    plans: [{ id: "p1", accountId: "c1", name: "耳机", principal: 600, periods: 6, feeRate: 0, monthly: 100, startDate: ago(2), paid: 0 }]
  }));
});

await page.goto(BASE + "/v3/expense-report.html", { waitUntil: "load" });
await page.waitForTimeout(700);

const sum = await page.evaluate(() => ({
  expense: document.querySelector("#sum-expense")?.textContent,
  income: document.querySelector("#sum-income")?.textContent,
  balance: document.querySelector("#sum-balance")?.textContent,
  month: document.querySelector("#month-label")?.textContent,
}));
ok("月报显示本月支出 ¥150", (sum.expense || "").includes("150"), JSON.stringify(sum));
ok("月报显示收入与结余", (sum.income || "").includes("500") && (sum.balance || "").includes("350"), JSON.stringify(sum));

const cats = await page.evaluate(() => [...document.querySelectorAll("#cat-list .cat-row")].map((x) => x.textContent.replace(/\s+/g, " ")));
ok("分类排行：餐饮在前、交通在后", cats.length === 2 && cats[0].includes("餐饮") && cats[0].includes("67%") && cats[1].includes("交通"), JSON.stringify(cats));

const trend = await page.evaluate(() => ({
  n: document.querySelectorAll("#trend .tb").length,
  on: document.querySelectorAll("#trend .tb.on").length,
}));
ok("近 6 个月趋势有 6 根且当前月高亮", trend.n === 6 && trend.on === 1, JSON.stringify(trend));

const plan = await page.evaluate(() => document.querySelector("#plan-list")?.textContent.replace(/\s+/g, " "));
ok("分期到期自动补 2 期并显示进度", /2\/6/.test(plan || ""), plan);

const back = await page.evaluate(() => document.querySelector('.head a')?.getAttribute("href"));
ok("月报可回到记账页", back === "expense.html", String(back));

await page.click("#prev");
await page.waitForTimeout(400);
const prev = await page.evaluate(() => ({
  month: document.querySelector("#month-label")?.textContent,
  expense: document.querySelector("#sum-expense")?.textContent,
}));
ok("切到上个月：支出归零", (prev.expense || "").includes("0"), JSON.stringify(prev));

await page.screenshot({ path: OUT + "expense-report.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n月报校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
