/**
 * 账单 CSV 解析纯函数验收：node scripts/test-bill-csv.mjs
 */
import fs from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
new Function(fs.readFileSync('pages/core/bill-parse.js', 'utf8'))();
new Function(fs.readFileSync('pages/core/bill-csv.js', 'utf8'))();
const C = globalThis.LightBillCsv;

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

const alipay = `交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-10-20 12:30:00,餐饮美食,瑞幸咖啡,生椰拿铁,支出,19.90,花呗,交易成功,20261020001,SH001,
2026-10-19 08:00:00,交通出行,滴滴出行,快车,支出,38.50,招商银行储蓄卡(1234),交易成功,20261019002,SH002,
2026-10-18 10:00:00,转账,张三,红包,收入,200.00,余额,交易成功,20261018003,SH003,
2026-10-16 12:00:00,转账,李四,转账,支出,50.00,余额,交易成功,20261016004,SH004,
2026-10-17 09:00:00,,,不计收支,0.00,余额,交易关闭,,,`;

const a = C.parse(alipay);
ok('支付宝：识别来源', a.source === 'alipay', a.source);
ok('支付宝：5 行里跳过不计收支，剩 4 笔', a.rows.length === 4 && a.skipped === 1, JSON.stringify(a.rows.length));
ok('转账行被标记 transfer', a.rows.some((r) => r.transfer && r.amount === 50), JSON.stringify(a.rows.map((r) => [r.note, r.transfer])));
ok('支付宝：金额/分类/商户', a.rows[0].amount === 19.9 && a.rows[0].cat === '餐饮' && a.rows[0].note.indexOf('瑞幸') >= 0, JSON.stringify(a.rows[0]));
ok('支付宝：日期规整', a.rows[0].date === '2026-10-20', a.rows[0].date);
ok('支付宝：付款方式带到 account', /花呗/.test(a.rows[0].account), a.rows[0].account);
ok('支付宝：收入类型', a.rows[2].type === 'income' && a.rows[2].amount === 200, JSON.stringify(a.rows[2]));

const wechat = `交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-10-20 09:10:00,商户消费,美团,外卖,支出,¥32.00,零钱,支付成功,WX001,M001,
2026-10-19 18:00:00,商户消费,盒马鲜生,日用品,支出,"1,026.50",招商银行(5678),支付成功,WX002,M002,`;

const w = C.parse(wechat);
ok('微信：识别来源', w.source === 'wechat', w.source);
ok('微信：¥ 与千分位金额', w.rows[0].amount === 32 && w.rows[1].amount === 1026.5, JSON.stringify(w.rows.map((r) => r.amount)));
ok('微信：支付方式带到 account', /零钱/.test(w.rows[0].account) && /招商银行/.test(w.rows[1].account), JSON.stringify(w.rows.map((r) => r.account)));
ok('微信：无表头/无金额时安全', C.parse('随便一段文本').rows.length === 0);

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n账单 CSV 校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);

