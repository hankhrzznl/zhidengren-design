/**
 * 账单文本解析纯函数验收：node scripts/test-bill-parse.mjs
 */
import fs from 'node:fs';

new Function(fs.readFileSync('pages/core/bill-parse.js', 'utf8'))();
const P = globalThis.LightBillParse;

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

/* 微信支付 */
const wx = P.parse('微信支付\n商户：瑞幸咖啡\n金额：¥19.90\n支付成功');
ok('微信：金额 19.9', wx && wx.amount === 19.9, JSON.stringify(wx));
ok('微信：商户瑞幸', wx && wx.note === '瑞幸咖啡', wx && wx.note);
ok('微信：分类餐饮', wx && wx.cat === '餐饮', wx && wx.cat);
ok('微信：账户提示微信', wx && wx.accountHint === '微信', wx && wx.accountHint);

/* 支付宝 */
const ali = P.parse('支付宝账单\n付款金额 38.50\n收款方：滴滴出行\n订单号 20261020001');
ok('支付宝：金额 38.5', ali && ali.amount === 38.5, JSON.stringify(ali));
ok('支付宝：收款方滴滴', ali && ali.note === '滴滴出行', ali && ali.note);
ok('支付宝：分类交通', ali && ali.cat === '交通', ali && ali.cat);

/* 银行短信 */
const bank = P.parse('【招商银行】您尾号1234的账户10月20日消费人民币126.50元，商户：盒马鲜生，余额5000.00元。');
ok('银行短信：取第一个消费金额 126.5', bank && bank.amount === 126.5, JSON.stringify(bank && bank.amount));
ok('银行短信：分类购物', bank && bank.cat === '购物', bank && bank.cat);
ok('银行短信：账户提示招商', bank && bank.accountHint === '招商', bank && bank.accountHint);

/* 没有符号的纯金额 */
const plain = P.parse('看电影 88.00');
ok('无符号：取小数金额 88', plain && plain.amount === 88, JSON.stringify(plain));

/* 无金额 / 空文本 */
ok('无金额返回 null', P.parse('今天天气不错') === null);
ok('空文本返回 null', P.parse('') === null);

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n账单解析校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);
