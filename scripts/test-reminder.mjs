/**
 * 每月对账提醒纯函数验收：node scripts/test-reminder.mjs
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
new Function(fs.readFileSync('pages/core/reminder.js', 'utf8'))();
const R = globalThis.LightReminder;

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

ok('未设置时不提醒', R.dueInfo('2026-10-20').enabled === false);
R.save({ day: 5 });
const early = R.dueInfo('2026-10-03');
ok('3 号：还没到 5 号', early.enabled && early.days === 2 && early.should === false, JSON.stringify(early));
const due = R.dueInfo('2026-10-05');
ok('5 号：当天该导出', due.should === true && due.days === 0, JSON.stringify(due));
const late = R.dueInfo('2026-10-20');
ok('20 号：已过期待办', late.should === true && late.days === -15, JSON.stringify(late));
R.markDone('2026-10-20');
const done = R.dueInfo('2026-10-20');
ok('标记本月完成后不再提醒', done.done === true && done.should === false, JSON.stringify(done));
const next = R.dueInfo('2026-11-04');
ok('下个月重新提醒', next.should === false && next.days === 1, JSON.stringify(next));

R.save({ day: 5 });
const cal = R.ics(5);
ok('ICS 有每月重复规则', /RRULE:FREQ=MONTHLY;BYMONTHDAY=5/.test(cal), cal.split('\r\n')[8]);
ok('ICS 有提醒摘要与 VALARM', /SUMMARY:导出支付宝\/微信账单/.test(cal) && /BEGIN:VALARM/.test(cal));
ok('ICS 日期是未来的一次', /DTSTART;VALUE=DATE:\d{8}/.test(cal));

R.save({ day: 99 });
ok('日期上限钳到 28', R.config().day === 28, String(R.config().day));

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n对账提醒校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);
