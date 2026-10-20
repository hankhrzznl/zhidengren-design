import { chromium, EXE, BASE, OUT } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_RESET")) errors.push("console:" + m.text()); });
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
ok("开局 0 光", await page.evaluate(() => (JSON.parse(localStorage.getItem("zdLight") || "{}").light || 0) === 0));
await page.evaluate(() => document.querySelector('#avatarBtn').click());
await page.waitForTimeout(300);

/* 记账页 → store → 志账户 → 灯 */
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("记账")).click());
await page.waitForTimeout(3400);
const expenseFrame = page.frames().find((f) => f.url().endsWith("v3/expense.html"));
ok("记账 iframe 打开", !!expenseFrame);
ok("记账页加载 store", await expenseFrame.evaluate(() => !!window.LightStore));

/* 默认空账本：没有演示账户/流水 */
const blank = await expenseFrame.evaluate(() => ({
  accts: document.querySelectorAll(".acct").length,
  first: !!document.querySelector("#acc-first"),
  wipe: !!document.querySelector("#wipe"),
  rows: document.querySelectorAll(".item").length,
}));
ok("记账默认空账本（无演示数据）", blank.accts === 0 && blank.first && blank.wipe && blank.rows === 0, JSON.stringify(blank));

/* 种入 5 个真实账户（非默认 id，避免被 cleanDemo 当成演示清掉） */
await expenseFrame.evaluate(() => {
  localStorage.setItem("lifeflow-ledger-v1", JSON.stringify({
    v: 1,
    accounts: [
      { id: "a1", name: "微信钱包", type: "asset", kind: "wechat", opening: 0, color: "#3EB575" },
      { id: "a2", name: "支付宝", type: "asset", kind: "alipay", opening: 0, color: "#1677FF" },
      { id: "a3", name: "招商银行卡", type: "asset", kind: "bank", opening: 0, color: "#C0392B" },
      { id: "a4", name: "花呗", type: "credit", kind: "huabei", opening: 0, limit: 5000, color: "#8B5CF6" },
      { id: "a5", name: "白条", type: "credit", kind: "baitiao", opening: 0, limit: 5000, color: "#D97706" }
    ],
    tx: [],
    plans: []
  }));
});
await expenseFrame.evaluate(() => location.reload());
await page.waitForTimeout(900);

await expenseFrame.fill("#amt-input", "12");
await expenseFrame.click("#rec-save");
await page.waitForTimeout(1200);
const store = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["记账"] || []).length, vals: (d.byMod["记账"] || []).map((r) => r.value) };
});
ok("记账写入 store 的 entries", store.n >= 1, JSON.stringify(store));

/* 账户 / 信用 / 分期 */
const accs = await expenseFrame.evaluate(() => ({
  n: document.querySelectorAll(".acct").length,
  names: [...document.querySelectorAll(".acct .n")].map((x) => x.textContent.trim()),
  net: document.querySelector("#stat-net-v")?.textContent,
}));
ok("记账有多个账户（微信/支付宝/银行卡/花呗/白条）", accs.n >= 5 && accs.names.join("/").includes("微信钱包") && accs.names.join("/").includes("花呗"), JSON.stringify(accs));
ok("第一笔支出后净资产为负", (accs.net || "").includes("−"), accs.net);

await expenseFrame.evaluate(() => {
  const sel = document.querySelector("#rec-account");
  sel.value = [...sel.options].find((o) => o.textContent.includes("花呗")).value;
});
await expenseFrame.fill("#amt-input", "100");
await expenseFrame.click("#rec-save");
await page.waitForTimeout(600);
const credit = await expenseFrame.evaluate(() => ({
  credit: document.querySelector("#stat-credit")?.textContent,
  net: document.querySelector("#stat-net-v")?.textContent,
}));
ok("信用消费计入待还", (credit.credit || "").includes("100"), JSON.stringify(credit));

await expenseFrame.click("#plan-add");
await expenseFrame.fill("#plan-principal", "1200");
await expenseFrame.fill("#plan-periods", "12");
await expenseFrame.click("#plan-save");
await page.waitForTimeout(600);
const plan = await expenseFrame.evaluate(() => ({
  rows: document.querySelectorAll(".plan-row").length,
  text: document.querySelector(".plan-row")?.textContent || "",
  credit: document.querySelector("#stat-credit")?.textContent,
}));
const planCredit = String(plan.credit || "").replace(/[^0-9]/g, "");
ok("分期建好并计入待还", plan.rows === 1 && /100/.test(plan.text) && planCredit === "1300", JSON.stringify(plan));

await expenseFrame.click(".repay[data-plan]");
await page.waitForTimeout(600);
const repaid = await expenseFrame.evaluate(() => ({
  sub: document.querySelector(".plan-sub")?.textContent || "",
  credit: document.querySelector("#stat-credit")?.textContent,
}));
const repaidCredit = String(repaid.credit || "").replace(/[^0-9]/g, "");
ok("还一期：待还减少且进度 +1", /已还 1\/12/.test(repaid.sub) && repaidCredit === "1200", JSON.stringify(repaid));

/* 预算 */
await expenseFrame.fill("#budget-input", "500");
await expenseFrame.click("#budget-save");
await page.waitForTimeout(400);
const budget = await expenseFrame.evaluate(() => ({
  meta: document.querySelector("#month-meta")?.textContent,
  width: document.querySelector("#budget-bar")?.style.width,
}));
ok("本月预算与进度条", /预算/.test(budget.meta || "") && parseInt(budget.width || "0", 10) > 0, JSON.stringify(budget));

/* 转账 */
await expenseFrame.click('#type-chips [data-type="transfer"]');
await page.waitForTimeout(200);
const toVisible = await expenseFrame.evaluate(() => getComputedStyle(document.querySelector("#to-row")).display !== "none");
await expenseFrame.evaluate(() => {
  const a = document.querySelector("#rec-account"), t = document.querySelector("#rec-to");
  a.value = [...a.options].find((o) => o.textContent.includes("微信")).value;
  t.value = [...t.options].find((o) => o.textContent.includes("支付宝")).value;
});
await expenseFrame.fill("#amt-input", "50");
await expenseFrame.click("#rec-save");
await page.waitForTimeout(500);
const transfer = await expenseFrame.evaluate(() => ({
  rows: [...document.querySelectorAll(".item")].slice(0, 3).map((x) => x.textContent.replace(/\s+/g, " ")),
}));
ok("转账进流水且带转入账户", toVisible && transfer.rows.join("|").includes("→"), JSON.stringify(transfer.rows.slice(0, 2)));

/* 编辑账户 */
await expenseFrame.evaluate(() => document.querySelector(".acct").click());
await page.waitForTimeout(250);
const editVisible = await expenseFrame.evaluate(() => getComputedStyle(document.querySelector("#acc-edit")).display !== "none");
await expenseFrame.click("#acc-edit");
await expenseFrame.fill("#acc-name", "微信零钱");
await expenseFrame.click("#acc-save");
await page.waitForTimeout(400);
const renamed = await expenseFrame.evaluate(() => [...document.querySelectorAll(".acct .n")].map((x) => x.textContent.trim()).join("/"));
ok("账户可改名", editVisible && renamed.includes("微信零钱"), renamed);

/* 分期到期自动记一期：把计划改成两个月前开始，重载页面 */
await expenseFrame.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  const d = new Date(); d.setMonth(d.getMonth() - 2);
  const past = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  db.plans[0].startDate = past; db.plans[0].paid = 0;
  localStorage.setItem("lifeflow-ledger-v1", JSON.stringify(db));
});
await expenseFrame.evaluate(() => location.reload());
await page.waitForTimeout(1500);
const autoPay = await expenseFrame.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  return {
    sub: document.querySelector(".plan-sub")?.textContent || "",
    auto: db.tx.filter((t) => t.category === "分期自动还款").length,
    paid: db.plans[0].paid,
  };
});
ok("到期自动记一期（可补多期）", /已还 2\/12/.test(autoPay.sub) && autoPay.auto === 2 && autoPay.paid === 2, JSON.stringify(autoPay));

/* 手动清空 */
await expenseFrame.evaluate(() => { window.confirm = () => true; });
await expenseFrame.click("#wipe");
await page.waitForTimeout(500);
const wiped = await expenseFrame.evaluate(() => ({
  accts: document.querySelectorAll(".acct").length,
  first: !!document.querySelector("#acc-first"),
  store: !!localStorage.getItem("lifeflow-ledger-v1"),
}));
ok("清空账本后回到空状态", wiped.accts === 0 && wiped.first && !wiped.store, JSON.stringify(wiped));

await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(500);
const lamp = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  return { light: st.light, means: rows.find((x) => x.startsWith("志")), verdict: document.querySelector("#dayVerdict")?.textContent };
});
ok("记账回壳志账户有分", (lamp.means || "").includes("100"), lamp.means);
ok("记账点亮第一缕", lamp.light === 1, JSON.stringify(lamp));
ok("四账户里 志 不再是 0", !(lamp.means || "").includes("0 —"), lamp.means);

await page.screenshot({ path: OUT + "p2-expense.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n记账校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);





