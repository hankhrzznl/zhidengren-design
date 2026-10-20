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
      { id: "a1", name: "微信钱包", type: "asset", kind: "wechat", opening: 1000, color: "#3EB575" },
      { id: "c1", name: "花呗", type: "credit", kind: "huabei", opening: 0, limit: 5000, billDay: 5, repayDay: 20, color: "#8B5CF6" }
    ]
  }));
});

/* URL 快捷记账：支出 */
await page.goto(BASE + "/v3/expense.html?quick=38&cat=餐饮&note=午饭&account=微信钱包", { waitUntil: "load" });
await page.waitForTimeout(800);
const added = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  const t = db.tx[0] || {};
  return {
    n: db.tx.length, amount: t.amount, cat: t.category, note: t.note, account: t.accountId,
    bar: getComputedStyle(document.querySelector("#quick-bar")).display !== "none",
    text: document.querySelector("#quick-text")?.textContent,
    search: location.search,
    store: (window.LightStore.readDay(window.LightStore.today()).byMod["记账"] || []).length,
  };
});
ok("URL 快捷记账写入一笔支出", added.n === 1 && added.amount === 38 && added.cat === "餐饮" && added.note === "午饭" && added.account === "a1", JSON.stringify(added));
ok("快捷记账有撤销条且 URL 已清理", added.bar && /已记/.test(added.text || "") && added.search === "", JSON.stringify({ bar: added.bar, text: added.text, search: added.search }));
ok("快捷记账同时写入记账事实", added.store === 1, String(added.store));

/* 撤销 */
await page.click("#quick-undo");
await page.waitForTimeout(400);
const undone = await page.evaluate(() => ({
  tx: JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).tx.length,
  store: (window.LightStore.readDay(window.LightStore.today()).byMod["记账"] || []).length,
  bar: getComputedStyle(document.querySelector("#quick-bar")).display !== "none",
}));
ok("撤销后流水与事实一起回退", undone.tx === 0 && undone.store === 0 && undone.bar === false, JSON.stringify(undone));

/* 收入 + 指定日期 */
await page.goto(BASE + "/v3/expense.html?quick=500&type=income&cat=稿费&date=2026-10-19", { waitUntil: "load" });
await page.waitForTimeout(800);
const income = await page.evaluate(() => {
  const t = JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).tx[0] || {};
  return { type: t.type, amount: t.amount, cat: t.category, date: t.date };
});
ok("URL 快捷记账支持收入与日期", income.type === "income" && income.amount === 500 && income.cat === "稿费" && income.date === "2026-10-19", JSON.stringify(income));

/* 粘贴账单：解析并填入表单 */
await page.goto(BASE + "/v3/expense.html", { waitUntil: "load" });
await page.waitForTimeout(700);
await page.evaluate(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { readText: async () => "微信支付\n商户：瑞幸咖啡\n金额：¥19.90" }
  });
});
await page.click("#paste-btn");
await page.waitForTimeout(500);
const pasted = await page.evaluate(() => ({
  amount: document.querySelector("#amt-input")?.value,
  note: document.querySelector("#rec-note")?.value,
  cat: [...document.querySelectorAll("#cat-chips .chip")].find((x) => x.classList.contains("on"))?.getAttribute("data-cat"),
}));
ok("粘贴账单自动填金额/商户/分类", pasted.amount === "19.9" && pasted.note === "瑞幸咖啡" && pasted.cat === "餐饮", JSON.stringify(pasted));
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n快捷记账校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

