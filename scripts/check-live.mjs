/**
 * 线上检查：Vercel 路径化部署（方案 A）是否真的可用
 *
 *   node scripts/check-live.mjs                  # 默认 https://my-lifeos.com
 *   node scripts/check-live.mjs https://xxx.com  # 指定域名
 *
 * 校验：四个路径 200、关键资源 200、落地页链接指向 app/desktop/work。
 * 零依赖：优先 curl（可走 HTTPS_PROXY，适合本机有系统代理的情况），没有 curl 再退回 fetch。
 */
import { spawnSync } from "node:child_process";

const base = (process.argv[2] || "https://my-lifeos.com").replace(/\/+$/, "");
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || "";
const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

function viaCurl(url) {
  const args = ["-sS", "-L", "--max-time", "30", "-w", "\n__STATUS__%{http_code}"];
  if (proxy) args.push("--proxy", proxy);
  args.push(url);
  const r = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0 || typeof r.stdout !== "string") return null;
  const i = r.stdout.lastIndexOf("\n__STATUS__");
  if (i < 0) return null;
  return { status: Number(r.stdout.slice(i + 11)), text: r.stdout.slice(0, i), url };
}

async function get(pathname) {
  const url = base + pathname;
  const c = viaCurl(url);
  if (c) return c;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "zhidengren-check" } });
    const text = r.status === 200 && /html/.test(r.headers.get("content-type") || "") ? await r.text() : "";
    return { status: r.status, text, url };
  } catch (e) {
    return { status: 0, text: "", url, error: String(e.message || e) + (proxy ? "" : "（本机若在代理后，试 HTTPS_PROXY=http://127.0.0.1:7890）") };
  }
}

const paths = ["/", "/app/", "/desktop/", "/work/"];
for (const p of paths) {
  const r = await get(p);
  ok(`GET ${p}`, r.status === 200, r.error || `HTTP ${r.status}`);
}

for (const p of ["/app/core/light.js", "/app/tokens.css", "/app/manifest.json", "/app/sw.js"]) {
  const r = await get(p);
  ok(`资源 ${p}`, r.status === 200, r.error || `HTTP ${r.status}`);
}

const landing = await get("/");
if (landing.status === 200) {
  ok("落地页三入口指向 app/desktop/work", /href="app\/"/.test(landing.text) && /href="desktop\/"/.test(landing.text) && /href="work\/"/.test(landing.text));
  ok("落地页没有残留仓库相对路径", !/href="pages\//.test(landing.text) && !/href="workbench\//.test(landing.text));
}

const pass = results.filter((r) => r.pass).length;
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.detail ? " · " + r.detail : ""));
console.log(`\n线上检查：${pass}/${results.length} PASS  (${base})`);
process.exit(pass === results.length ? 0 : 1);
