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

await page.goto(BASE + "/v3/quick-setup.html", { waitUntil: "load" });
await page.waitForTimeout(600);

const setup = await page.evaluate(() => ({
  routes: document.querySelectorAll(".route").length,
  tpl: document.querySelector("#tpl")?.textContent || "",
  acc: [...document.querySelectorAll("#acc option")].map((o) => o.value),
  link: !!document.querySelector('.head a[href="expense.html"]'),
}));
ok("自动记账页有 4 条落地路线", setup.routes === 4, String(setup.routes));
ok("默认模板含 [金额] 与分类", setup.tpl.includes("[金额]") && setup.tpl.includes("cat="), setup.tpl);
ok("账户下拉读到本机账户", setup.acc.includes("微信钱包") && setup.acc.includes("花呗"), JSON.stringify(setup.acc));
ok("可返回记账页", setup.link);

/* 选账户后模板更新 + 复制 */
await page.selectOption("#acc", "花呗");
await page.selectOption("#cat", "购物");
await page.waitForTimeout(200);
const tpl2 = await page.evaluate(() => document.querySelector("#tpl")?.textContent || "");
ok("切换账户/分类后模板更新", tpl2.includes("account=%E8%8A%B1%E5%91%97") && tpl2.includes("cat=%E8%B4%AD%E7%89%A9"), tpl2);

await page.evaluate(() => {
  window.__copied = "";
  if (navigator.clipboard) {
    navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); };
  }
});
await page.click("#copy");
await page.waitForTimeout(300);
const copied = await page.evaluate(() => ({ text: window.__copied, toast: document.querySelector("#toast")?.textContent }));
ok("复制按钮复制模板", copied.text === tpl2 && /已复制/.test(copied.toast || ""), JSON.stringify(copied));

/* 测试一次 → 跳到记账页并真的记 0.01 */
await page.click("#test");
await page.waitForTimeout(900);
const tested = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  return { url: location.pathname, tx: db.tx[0] || null };
});
ok("测试一次真的写入 0.01", /expense\.html$/.test(tested.url) && tested.tx && tested.tx.amount === 0.01, JSON.stringify(tested));

await page.screenshot({ path: OUT + "quick-setup.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n自动记账落地页：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
