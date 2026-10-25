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
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const hm = (d) => pad(d.getHours()) + ":" + pad(d.getMinutes());
  const inAt = new Date(now.getTime() - 8 * 3600 * 1000);
  localStorage.setItem("lifeflow-sleep-goals", JSON.stringify({ v: 1, inTarget: "23:00", outTarget: "07:00", durTarget: 8, ritual: true }));
  localStorage.setItem("lifeflow-sleep-logs", JSON.stringify({ v: 1, items: [{ id: "seed-in", date: key(inAt), time: hm(inAt), type: "in" }] }));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
await page.evaluate(() => { go("profile"); openModulesScreen(); });
await page.waitForTimeout(250);
await page.evaluate(() => [...document.querySelectorAll(".module-row")].find((x) => x.textContent.includes("睡眠")).click());
await page.waitForFunction(() => {
  const f = document.querySelector("#modFrame");
  return !!(f && f.contentDocument && f.contentDocument.querySelector("#wake-btn"));
}, { timeout: 30000 });

const read = () => page.evaluate(() => {
  const d = document.querySelector("#modFrame").contentDocument;
  return {
    wake: d.querySelector("#proto-wake")?.textContent,
    window: d.querySelector("#proto-window")?.textContent,
    caffeine: d.querySelector("#proto-caffeine")?.textContent,
    consistency: d.querySelector("#proto-consistency")?.textContent,
    out: d.querySelector("#last-out")?.textContent,
    dur: d.querySelector("#dur-val")?.textContent,
  };
});
const before = await read();
ok("协议卡显示起床锚点", before.wake === "07:00", JSON.stringify(before));
ok("协议卡显示上床窗口", before.window === "22:50–23:10", before.window);
ok("协议卡显示咖啡因截止", before.caffeine === "15:00", before.caffeine);
ok("协议卡要求至少 3 天", /再记 3 天/.test(before.consistency || ""), before.consistency);

await page.evaluate(() => document.querySelector("#modFrame").contentDocument.querySelector("#wake-btn").click());
await page.waitForTimeout(500);
const after = await read();
const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("lifeflow-sleep-logs") || "{}").items || []);
ok("起床写入 sleep logs", logs.some((r) => r.type === "out"), JSON.stringify(logs));
ok("起床后算出入睡时长", Math.abs(Number(after.dur) - 8) < 0.2, after.dur);
ok("起床波动开始累计", /再记 2 天/.test(after.consistency || ""), after.consistency);

const stored = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("lifeflow-days-v1") || "{}");
  const days = raw.days || {};
  const today = window.LightStore.today();
  return (days[today]?.records || []).filter((r) => r.mod === "睡眠");
});
ok("起床后写入模块事实", stored.some((r) => r.meta && r.meta.source === "sleep-wake"), JSON.stringify(stored));
await page.screenshot({ path: OUT + "sleep-protocol.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n睡眠协议校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
