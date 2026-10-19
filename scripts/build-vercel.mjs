/**
 * 执灯人 · Vercel 构建：把三个形式组装成同一个源下的三个路径
 *
 *   dist/index.html      落地页（三个入口）
 *   dist/app/            手机端（pages/ 全量；入口 index.html）
 *   dist/desktop/        电脑端（pages/ 全量；入口换成 desktop.html）
 *   dist/work/           工作台（workbench/ 全量）
 *
 * 为什么用路径而不是子域名：三端靠 localStorage 共享同一份数据，
 * 子域名是不同 origin，会直接把数据切断（详见 docs/部署-Vercel-域名.md）。
 *
 * 用法：node scripts/build-vercel.mjs   （Vercel 里作为 Build Command）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/* 手写递归拷贝：这台 Windows 上 Node 22.22.2 的 fs.cpSync 会直接崩（0xC0000409） */
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* 1. 落地页：链接从仓库相对路径改成线上路径 */
let landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
landing = landing
  .replaceAll('href="pages/index.html"', 'href="app/"')
  .replaceAll('href="pages/desktop.html"', 'href="desktop/"')
  .replaceAll('href="workbench/index.html"', 'href="work/"')
  .replaceAll('href="pages/assets/icon.svg"', 'href="app/assets/icon.svg"');
fs.writeFileSync(path.join(DIST, "index.html"), landing);

/* 2. 手机端：整份 pages/ 放到 /app/ */
copyDir(path.join(ROOT, "pages"), path.join(DIST, "app"));

/* 3. 电脑端：同一份 pages/ 放到 /desktop/，入口换成 desktop.html */
copyDir(path.join(ROOT, "pages"), path.join(DIST, "desktop"));
let desktop = fs.readFileSync(path.join(ROOT, "pages", "desktop.html"), "utf8");
/* 「返回手机版」原本指向同目录 index.html，路径化之后是 ../app/ */
desktop = desktop.replaceAll('href="index.html"', 'href="../app/"');
fs.writeFileSync(path.join(DIST, "desktop", "index.html"), desktop);

/* 4. 工作台：整份 workbench/ 放到 /work/ */
copyDir(path.join(ROOT, "workbench"), path.join(DIST, "work"));

/* 5. 校验关键文件（构建时失败，比线上 404 好排查） */
const must = [
  "index.html",
  "app/index.html",
  "app/desktop.html",
  "app/core/light.js",
  "app/tokens.css",
  "app/sw.js",
  "desktop/index.html",
  "desktop/core/light.js",
  "desktop/tokens.css",
  "desktop/assets/icon.svg",
  "work/index.html"
];
const missing = must.filter((p) => !fs.existsSync(path.join(DIST, p)));
if (missing.length) {
  console.error("[build-vercel] 缺少文件:", missing.join(", "));
  process.exit(1);
}
console.log(`[build-vercel] dist 就绪：${must.length} 个关键文件校验通过`);

