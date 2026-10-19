/**
 * 线上检查：Vercel 路径化部署（方案 A）是否真的可用
 *
 *   node scripts/check-live.mjs                  # 默认 https://my-lifeos.com
 *   node scripts/check-live.mjs https://xxx.com  # 指定域名
 *
 * 校验：四个路径 200、关键资源 200、落地页链接指向 app/desktop/work。
 * 纯 Node（Node 18+ 自带 fetch），零依赖；不依赖浏览器。
 */
const base = (process.argv[2] || "https://my-lifeos.com").replace(/\/+$/, "");
const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

async function get(pathname) {
  const url = base + pathname;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "zhidengren-check" } });
    const text = r.status === 200 && /html/.test(r.headers.get("content-type") || "") ? await r.text() : "";
    return { status: r.status, text, url };
  } catch (e) {
    return { status: 0, text: "", url, error: String(e.message || e) };
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
