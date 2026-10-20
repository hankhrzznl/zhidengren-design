/**
 * 云收件箱客户端验收：node scripts/test-cloud-inbox.mjs
 * 用 mock fetch 模拟 Supabase Edge Function，验证拉取、去重、缺账户不丢。
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};

new Function(fs.readFileSync('pages/core/ledger.js', 'utf8'))();
new Function(fs.readFileSync('pages/core/cloud-inbox.js', 'utf8'))();
const L = globalThis.LightLedger;
const Inbox = globalThis.LightInbox;

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

L.addAccount({ name: '微信钱包', type: 'asset', opening: 1000 });
L.addAccount({ name: '花呗', type: 'credit', limit: 5000, billDay: 5, repayDay: 20 });

Inbox.saveConfig({ url: 'https://demo.supabase.co/functions/v1', token: 't0ken' });
ok('配置保存并去掉尾斜杠', Inbox.config().url === 'https://demo.supabase.co/functions/v1', JSON.stringify(Inbox.config()));

const cloud = [
  { id: 'c1', amount: 38, type: 'expense', cat: '餐饮', note: '午饭', account: '微信钱包', date: '2026-10-20' },
  { id: 'c2', amount: 500, type: 'income', cat: '稿费', note: '', account: '花呗', date: '2026-10-19' },
  { id: 'c3', amount: 12, type: 'expense', cat: '交通', note: '地铁', account: '不存在的卡' }
];
let calls = 0;
let current = cloud;
globalThis.fetch = async (url, init) => {
  calls++;
  if (String(url).indexOf('token=t0ken') < 0) return { ok: false, status: 403, json: async () => ({}) };
  if (init && init.method === 'POST') {
    const row = JSON.parse(init.body);
    const rec = Object.assign({ id: 'p' + calls, created_at: new Date().toISOString() }, row);
    current = current.concat([rec]);
    return { ok: true, status: 200, json: async () => rec };
  }
  return { ok: true, status: 200, json: async () => current };
};

const first = await Inbox.pull();
ok('拉取 3 条，入库 3 条（账户名不匹配时回退资产账户）', first.added === 3 && first.total === 3 && L.load().tx.length === 3, JSON.stringify(first));
ok('收入类型保留', L.load().tx.some((t) => t.type === 'income' && t.amount === 500));
ok('日期落到账本', L.load().tx.some((t) => t.date === '2026-10-19'));

const second = await Inbox.pull();
ok('再次拉取不重复记账', second.added === 0 && L.load().tx.length === 3, JSON.stringify(second));
ok('请求带 token 且只调 GET', calls === 2);

/* 没有账户时跳过且不标记已读，补账户后还能补记 */
L.reset();
Inbox.clearSeen();
const none = await Inbox.pull().then((r) => r).catch((e) => ({ err: e.message }));
ok('没有账户时不崩、不标记', none && none.added === 0, JSON.stringify(none));
L.addAccount({ name: '现金', type: 'asset', opening: 0 });
const retry = await Inbox.pull();
ok('补账户后能补记之前跳过的', retry.added === 3 && L.load().tx.length === 3, JSON.stringify(retry));

/* 跨来源去重：短信 + Apple Pay 同一笔，只记一次 */
current = [
  { id: 'd1', amount: 66, type: 'expense', cat: '购物', note: '超市', account: '现金', date: '2026-10-20', source: 'sms', created_at: '2026-10-20T10:00:00Z' },
  { id: 'd2', amount: 66, type: 'expense', cat: '购物', note: '超市', account: '现金', date: '2026-10-20', source: 'applepay', created_at: '2026-10-20T10:00:05Z' }
];
const dedup = await Inbox.pull();
ok('短信与 Apple Pay 同一笔只记一次', dedup.added === 1 && dedup.skipped === 1, JSON.stringify(dedup));
ok('账本保留来源标记', L.load().tx.some((t) => t.amount === 66 && t.meta && t.meta.source === 'sms'), JSON.stringify(L.load().tx.filter((t) => t.amount === 66)));
/* 从 App 发一条测试，再拉回来 */
const pushed = await Inbox.testPush();
ok('testPush 写入并拉回 0.01', pushed.added === 1 && L.load().tx.some((t) => t.amount === 0.01), JSON.stringify(pushed));
/* 未配置 */
Inbox.saveConfig({ url: '', token: '' });
let err = '';
try { await Inbox.pull(); } catch (e) { err = e.message; }
ok('未配置时给出明确错误', err === 'no-config', err);

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n云收件箱校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);


