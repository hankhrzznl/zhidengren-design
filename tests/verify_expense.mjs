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



