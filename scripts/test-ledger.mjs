/**
 * 执灯人 · 账本内核 ledger.js 纯函数验收
 *   node scripts/test-ledger.mjs
 * 不需要浏览器：mock localStorage，验证账户/流水/分期/总账口径。
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};

new Function(fs.readFileSync('pages/core/ledger.js', 'utf8'))();
const L = globalThis.LightLedger;

let pass = 0; const rows = [];
function ok(name, cond, detail = '') {
  rows.push([cond ? 'PASS' : 'FAIL', name, detail]);
  if (cond) pass++;
}
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

/* 1. 空账本 + 手动建账户（不再预置演示账户） */
ok('初始账本为空', L.listAccounts().length === 0, String(L.listAccounts().length));
const bank = L.addAccount({ name: '招商储蓄卡', type: 'asset', opening: 1000 });
const wechat = L.addAccount({ name: '微信钱包', type: 'asset', kind: 'wechat' });
const huabei = L.addAccount({ name: '花呗', type: 'credit', kind: 'huabei', limit: 5000 });
ok('资产 2 个 / 信用 1 个', L.listAccounts().filter((a) => a.type === 'asset').length === 2 && L.listAccounts().filter((a) => a.type === 'credit').length === 1);
ok('新增资产账户带期初', bank && near(L.accountBalance(L.load(), bank.id), 1000), String(bank && L.accountBalance(L.load(), bank.id)));

/* 3. 支出 / 收入 */
L.addTx({ type: 'expense', amount: 100, accountId: bank.id, category: '餐饮' });
ok('支出扣账户余额', near(L.accountBalance(L.load(), bank.id), 900), String(L.accountBalance(L.load(), bank.id)));
L.addTx({ type: 'income', amount: 500, accountId: bank.id });
ok('收入加账户余额', near(L.accountBalance(L.load(), bank.id), 1400), String(L.accountBalance(L.load(), bank.id)));

/* 4. 转账不改变总资产 */
L.addTx({ type: 'transfer', amount: 200, accountId: bank.id, toId: wechat.id });
const t1 = L.totals();
ok('转账后两账户余额正确', near(L.accountBalance(L.load(), bank.id), 1200) && near(L.accountBalance(L.load(), wechat.id), 200), JSON.stringify({ bank: L.accountBalance(L.load(), bank.id), wechat: L.accountBalance(L.load(), wechat.id) }));
ok('转账不改变资产合计', near(t1.assets, 1400), String(t1.assets));

/* 5. 信用消费计待还 */
L.addTx({ type: 'expense', amount: 300, accountId: huabei.id, category: '购物' });
const t2 = L.totals();
ok('信用消费计入待还', near(t2.creditUsed, 300), String(t2.creditUsed));
ok('净资产 = 资产 − 待还', near(t2.net, 1100), JSON.stringify(t2));

/* 6. 分期：本金进待还，计划只排还款 */
const plan = L.addPlan({ accountId: huabei.id, principal: 1200, periods: 12, feeRate: 0, name: '手机' });
ok('分期月供 = 本金/期数', plan && near(plan.monthly, 100), JSON.stringify(plan && plan.monthly));
ok('分期本金计入信用待还', near(L.totals().creditUsed, 1500), String(L.totals().creditUsed));
ok('剩余应还 = 月供 × 期数', near(L.planRemaining(plan), 1200), String(L.planRemaining(plan)));

/* 7. 还一期 */
L.repayPlan(plan.id, bank.id);
ok('还一期后信用待还减少', near(L.totals().creditUsed, 1400), String(L.totals().creditUsed));
ok('还一期后资产扣款', near(L.accountBalance(L.load(), bank.id), 1100), String(L.accountBalance(L.load(), bank.id)));
ok('已还期数 +1', L.plans()[0].paid === 1, String(L.plans()[0].paid));
for (let i = 0; i < 11; i++) L.repayPlan(plan.id, bank.id);
ok('还满后不再扣（返回 null）', L.repayPlan(plan.id, bank.id) === null);
ok('还满后信用只剩普通消费', near(L.totals().creditUsed, 300), String(L.totals().creditUsed));

/* 8. 本月口径 */
const t3 = L.totals();
ok('本月支出只算 expense（不含转账/还款）', near(t3.monthSpend, 1600), String(t3.monthSpend));
ok('本月收入只算 income', near(t3.monthIncome, 500), String(t3.monthIncome));

/* 8.5 预算与分类汇总 */
L.setBudget(3000);
ok("预算保存/读取", near(L.budgetOf(), 3000), String(L.budgetOf()));
const cats = L.categoryBreakdown(null, 3);
ok("分类汇总按金额降序", cats.length >= 2 && cats[0].amount >= cats[1].amount, JSON.stringify(cats));
L.setBudget(0); ok("预算可清零", L.budgetOf() === 0, String(L.budgetOf()));

/* 8.6 月报与自动还款 */
const hb2 = huabei;
const mp = L.addPlan({ accountId: hb2.id, principal: 600, periods: 6, startDate: '2026-8-15' });
const dueN = L.autoRepayDue('2026-10-19');
ok('到期自动补 2 期', dueN === 2 && L.plans().find((p) => p.id === mp.id).paid === 2, String(dueN));
ok('自动还款幂等（同一天再跑不重复）', L.autoRepayDue('2026-10-19') === 0);
ok('月末加月对齐', L.addMonths('2026-1-31', 1) === '2026-2-28', L.addMonths('2026-1-31', 1));
const ms = L.monthSummary('2026-10');
ok('月报有支出与收入', ms.expense > 0 && ms.income > 0, JSON.stringify({ e: ms.expense, i: ms.income }));
ok('月报分类按金额降序', ms.byCategory.length >= 2 && ms.byCategory[0].amount >= ms.byCategory[1].amount, JSON.stringify(ms.byCategory.slice(0, 3)));
ok('月报账户维度非空', ms.byAccount.length >= 1, JSON.stringify(ms.byAccount));
const tr = L.monthlyTrend(6);
ok('六个月趋势 6 项且末月为当前', tr.length === 6 && tr[5].month === L.monthKey(), tr.map((x) => x.month).join('/'));

/* 9. 非法输入 */
ok('金额 0 拒绝', L.addTx({ type: 'expense', amount: 0, accountId: bank.id }) === null);
ok('转给自己拒绝', L.addTx({ type: 'transfer', amount: 10, accountId: bank.id, toId: bank.id }) === null);
ok('无账户拒绝', L.addTx({ type: 'expense', amount: 10, accountId: 'nope' }) !== null ? false : true);
ok('分期期数 0 拒绝', L.addPlan({ accountId: huabei.id, principal: 100, periods: 0 }) === null);

/* 10. 删除流水 */
const before = L.load().tx.length;
const tx = L.addTx({ type: 'expense', amount: 9, accountId: wechat.id });
L.removeTx(tx.id);
ok('删除流水后条数还原', L.load().tx.length === before, `${before}->${L.load().tx.length}`);

/* 11. 清演示数据 */
const DEFAULT_ACCS = [
  { id: 'acc_wechat', name: '微信钱包', type: 'asset', opening: 0 },
  { id: 'acc_alipay', name: '支付宝', type: 'asset', opening: 0 },
  { id: 'acc_bank1', name: '招商银行卡', type: 'asset', opening: 0 },
  { id: 'acc_huabei', name: '花呗', type: 'credit', opening: 0, limit: 0 },
  { id: 'acc_baitiao', name: '白条', type: 'credit', opening: 0, limit: 0 }
];
mem.set('lifeflow-ledger-v1', JSON.stringify({
  v: 1, accounts: DEFAULT_ACCS, plans: [],
  tx: [{ id: 'seed-x', date: '2026-10-1', type: 'expense', amount: 38, accountId: 'acc_wechat', category: '餐饮', note: '午餐 · 沙拉碗' }]
}));
ok('清演示：只剩默认空账户时整本清掉', L.cleanDemo() === true && L.listAccounts().length === 0, JSON.stringify(L.listAccounts().length));

mem.set('lifeflow-ledger-v1', JSON.stringify({
  v: 1, plans: [],
  accounts: [{ id: 'real-1', name: '我的卡', type: 'asset', opening: 0 }],
  tx: [
    { id: 'demo-1', date: '2026-10-1', type: 'expense', amount: 38, accountId: 'real-1', category: '餐饮', note: '午餐 · 沙拉碗' },
    { id: 'real-1', date: '2026-10-2', type: 'expense', amount: 10, accountId: 'real-1', category: '日常', note: '真实支出' }
  ]
}));
L.cleanDemo();
ok('清演示：保留真实流水', L.load().tx.length === 1 && L.load().tx[0].note === '真实支出', JSON.stringify(L.load().tx.map((t) => t.note)));

/* 12. 手动清空 */
ok('reset 清掉整本账', L.reset() === true && L.listAccounts().length === 0 && L.load().tx.length === 0);

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
const failed = rows.filter((r) => r[0] === 'FAIL').length;
console.log(`\n账本内核校验：${pass}/${rows.length} PASS`);
process.exit(failed ? 1 : 0);



