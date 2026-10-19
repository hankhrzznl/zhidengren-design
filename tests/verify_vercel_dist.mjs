/**
 * Vercel 构建产物校验：三端在同一源下的三个路径
 *   /app/ 手机端   /desktop/ 电脑端   /work/ 工作台
 * 关键点：三个路径共用 localStorage（同一 origin），电脑端能读到手机端写的数据。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, EXE } from "./_env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);
const errors = [];

/* 1. 构建 */
const build = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-vercel.mjs")], { cwd: ROOT, encoding: "utf8" });
ok("dist 构建成功", build.status === 0, (build.stdout || build.stderr || "").trim().split("\n").pop());
ok("落地页/三端入口文件齐全", ["index.html", "app/index.html", "desktop/index.html", "work/index.html"].every((f) => fs.existsSync(path.join(DIST, f))));

/* 2. 静态服务 */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  let f = path.join(DIST, p);
  if (p.endsWith("/")) f = path.join(f, "index.html");
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(8901, "127.0.0.1", r));
const BASE = "http://127.0.0.1:8901";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const bad = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();

await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(300);
const landing = await page.evaluate(() => ({
  links: [...document.querySelectorAll(".grid a")].map((a) => a.getAttribute("href")),
  title: document.title,
}));
ok("落地页三个入口指向 app/desktop/work", landing.links.join(",") === "app/,desktop/,work/", JSON.stringify(landing.links));

await page.goto(BASE + "/app/", { waitUntil: "load" });
await page.waitForTimeout(700);
ok("手机端在 /app/ 正常", (await page.title()).includes("手机端") && (await page.evaluate(() => !!document.querySelector(".phone"))), await page.title());
ok("/app/ 无 4xx/5xx", bad.length === 0, JSON.stringify(bad));
bad.length = 0;

await page.evaluate((today) => {
  localStorage.setItem("zdLight", JSON.stringify({
    v: 2, light: 5, moods: { [today]: "good" }, logs: {}, todos: { high: [], mid: [], low: [], inbox: [] },
    plan: { anytime: [], morning: [{ id: 901, t: "跨路径测试任务", m: 30, dom: "智识", dates: [today], done: false }], noon: [], day: [], evening: [] }
  }));
}, today);

await page.goto(BASE + "/desktop/", { waitUntil: "load" });
await page.waitForTimeout(900);
const desk = await page.evaluate(() => ({
  realm: document.querySelector(".gn-realm")?.textContent || "",
  task: document.querySelector("#stage-day .blk .b-t")?.textContent || "",
  back: document.querySelector('.nv[href]')?.getAttribute("href") || "",
}));
ok("电脑端在 /desktop/ 读到手机端的灯与任务（同源共享）", /5 光/.test(desk.realm) && desk.task === "跨路径测试任务", JSON.stringify(desk));
ok("电脑端返回手机版指向 ../app/", desk.back === "../app/", desk.back);
ok("/desktop/ 无 4xx/5xx", bad.length === 0, JSON.stringify(bad));
bad.length = 0;

await page.goto(BASE + "/work/", { waitUntil: "load" });
await page.waitForTimeout(700);
const wb = await page.evaluate(() => ({
  brand: document.querySelector(".brand-t")?.textContent || "",
  plan: document.querySelectorAll("#view-today .ps-row").length,
}));
ok("工作台在 /work/ 且只读电脑端计划", wb.brand === "执灯人" && wb.plan === 1, JSON.stringify(wb));
ok("/work/ 无 4xx/5xx", bad.length === 0, JSON.stringify(bad));

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\nVercel 产物校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");

await browser.close();
server.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
