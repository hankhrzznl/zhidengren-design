import { chromium, EXE, BASE, OUT } from "./_env.mjs";
import fs from "node:fs";
import path from "node:path";

const csvPath = path.join(OUT, "sample-bill.csv");
fs.writeFileSync(csvPath, [
  "交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注",
  "2026-10-20 12:30:00,餐饮美食,瑞幸咖啡,生椰拿铁,支出,19.90,花呗,交易成功,A001,M001,",
  "2026-10-19 08:00:00,交通出行,滴滴出行,快车,支出,38.50,招商银行储蓄卡(1234),交易成功,A002,M002,",
  "2026-10-18 10:00:00,转账,张三,红包,收入,200.00,余额,交易成功,A003,M003,"
].join("\n"), "utf8");

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

await page.goto(BASE + "/v3/bill-import.html", { waitUntil: "load" });
await page.waitForTimeout(500);
await page.setInputFiles("#file", csvPath);
await page.waitForTimeout(600);

const preview = await page.evaluate(() => ({
  stat: document.querySelector("#stat")?.textContent.replace(/\s+/g, " "),
  rows: document.querySelectorAll("#preview .row").length,
  disabled: document.querySelector("#import")?.disabled,
}));
ok("识别支付宝 CSV 并预览 3 笔", /可导入 3 笔/.test(preview.stat || "") && preview.rows === 3 && preview.disabled === false, JSON.stringify(preview));

await page.click("#import");
await page.waitForTimeout(600);
const imported = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("lifeflow-ledger-v1"));
  return { tx: db.tx.map((t) => ({ a: t.amount, c: t.category, n: t.note, acc: t.accountId })) };
});
ok("导入 3 笔到账本", imported.tx.length === 3, JSON.stringify(imported.tx));
ok("花呗付款归到花呗账户", imported.tx.some((t) => t.acc === "c1" && t.a === 19.9), JSON.stringify(imported.tx[0]));
ok("收入保留", imported.tx.some((t) => t.a === 200 && t.c === "日常"), JSON.stringify(imported.tx));

await page.setInputFiles("#file", csvPath);
await page.waitForTimeout(500);
await page.click("#import");
await page.waitForTimeout(600);
const twice = await page.evaluate(() => ({
  tx: JSON.parse(localStorage.getItem("lifeflow-ledger-v1")).tx.length,
  stat: document.querySelector("#stat")?.textContent,
}));
ok("重复导入不重复记账", twice.tx === 3, JSON.stringify(twice));

await page.screenshot({ path: OUT + "bill-import.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n账单导入校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
