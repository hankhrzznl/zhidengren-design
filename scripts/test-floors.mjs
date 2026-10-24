/**
 * 今日保底纯逻辑验收：node scripts/test-floors.mjs
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
new Function(fs.readFileSync('pages/core/floors.js', 'utf8'))();
const F = globalThis.LightFloors;
const DAY = '2026-10-24';

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

ok('13 个保底项', F.FLOORS.length === 13, String(F.FLOORS.length));
ok('未填写是 unknown', F.colorOf(F.day(DAY)) === 'unknown');

F.saveDay({ sleep: 4, soreness: 4, mood: 4, stress: 4 }, DAY);
ok('四项都好是绿', F.colorOf(F.day(DAY)) === 'green');
F.saveDay({ sleep: 3 }, DAY);
ok('睡眠 3 是黄', F.colorOf(F.day(DAY)) === 'yellow');
F.saveDay({ sleep: 2 }, DAY);
ok('睡眠 2 是红', F.colorOf(F.day(DAY)) === 'red');
F.saveDay({ sleep: 4, soreness: 2, mood: 2, stress: 4 }, DAY);
ok('两项低也是红', F.colorOf(F.day(DAY)) === 'red');

F.saveDay({ sleep: 4, soreness: 4, mood: 4, stress: 4, tightest: 'attention' }, DAY);
const def = F.defaultChosen(F.day(DAY));
ok('注意力紧时默认专注', def[0] === 'focus' && def.length === 3, JSON.stringify(def));

F.choose(['sleep', 'protein', 'walk', 'focus'], DAY);
ok('最多只保 3 个', F.day(DAY).chosen.length === 3, JSON.stringify(F.day(DAY).chosen));
ok('保底项有中文名', F.summary(DAY).chosen[0].label === '睡够 7h', JSON.stringify(F.summary(DAY).chosen[0]));

F.toggleDone('sleep', DAY);
ok('勾选完成', F.summary(DAY).done === 1 && F.summary(DAY).chosen.some((x) => x.id === 'sleep' && x.done));
F.toggleDone('sleep', DAY);
ok('再点取消', F.summary(DAY).done === 0);

const raw = JSON.parse(localStorage.getItem(F.KEY));
ok('按日期持久化', !!raw.days[DAY] && raw.days[DAY].chosen.length === 3, JSON.stringify(raw.days[DAY]));

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n今日保底校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);
