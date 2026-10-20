// 执灯人 · 自动记账云收件箱（Supabase Edge Function）
// 部署：supabase functions deploy inbox --no-verify-jwt
// 环境变量：INBOX_TOKEN=<自己设的长随机串>
// 已有 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 注入。
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-inbox-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-inbox-token") || "";
  const expected = Deno.env.get("INBOX_TOKEN") || "";
  if (!expected || token !== expected) return json({ error: "forbidden" }, 403);

  const base = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  if (req.method === "GET") {
    const r = await fetch(`${base}/rest/v1/inbox?select=*&order=created_at.asc&limit=200`, { headers });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    let b: any = {};
    try { b = await req.json(); } catch (e) { return json({ error: "bad-json" }, 400); }
    const amount = Number(b.amount ?? b.quick);
    if (!(amount > 0)) return json({ error: "bad-amount" }, 400);
    const row = {
      amount: Math.round(amount * 100) / 100,
      type: b.type === "income" ? "income" : "expense",
      cat: String(b.cat || b.category || "日常").slice(0, 20),
      note: String(b.note || "").slice(0, 80),
      account: String(b.account || "").slice(0, 30),
      date: b.date || null,
      source: "shortcut"
    };
    const r = await fetch(`${base}/rest/v1/inbox`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(row)
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  return json({ error: "method" }, 405);
});
