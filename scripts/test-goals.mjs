/**
 * 目标 v2 数据层验收：node scripts/test-goals.mjs
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
new Function(fs.readFileSync('pages/core/goals.js', 'utf8'))();
const G = globalThis.LightGoals;
const DAY = '2026-10-25';

let pass = 0; const rows = [];
function ok(name, cond, detail = '') { rows.push([cond ? 'PASS' : 'FAIL', name, detail]); if (cond) pass++; }

ok('指标中文名', G.metricLabel('hours') === '睡眠时长', G.metricLabel('hours'));
ok('模块默认值', G.defaultsFor('training').metric === 'sessions' && G.defaultsFor('training').target === 3, JSON.stringify(G.defaultsFor('training')));

/* 空库不写 v2，避免把之后 goals 页的 v1 种子挡掉 */
ok('空库 list 为空', G.list().length === 0);
ok('空库不创建 v2', localStorage.getItem(G.V2_KEY) === null);

/* v1 迁移 */
localStorage.setItem(G.V1_KEY, JSON.stringify({
  v: 1,
  items: [
    {
      id: 'seed-g1', title: '三个月减脂到体脂 22%', status: 'active', domain: '健康',
      progress: 64, measure: { label: '训练', icon: 'dumbbell', href: 'training.html' },
      stages: [{ id: 's1', name: '适应期', state: 'done' }],
      tasks: [{ id: 't1', name: '本周训练 3 次', done: false }]
    },
    {
      id: 'seed-g2', title: '考公上岸', status: 'active', domain: '工作学习',
      progress: 10, measure: { label: '睡眠', icon: 'moon', href: 'sleep.html' },
      stages: [], tasks: []
    }
  ]
}));
const beforeV1 = localStorage.getItem(G.V1_KEY);
const mig = G.migrate();
ok('迁移 2 条目标', mig.migrated === 2 && G.list().length === 2, JSON.stringify({ m: mig.migrated, n: G.list().length }));
ok('迁移保留标题与阶段', G.get('seed-g1').title.includes('减脂') && G.get('seed-g1').legacy.stages.length === 1);
ok('迁移保留旧 measure', G.get('seed-g1').legacyMeasure.label === '训练', JSON.stringify(G.get('seed-g1').legacyMeasure));
ok('迁移不伪造 requirements', G.get('seed-g1').requirements.length === 0, JSON.stringify(G.get('seed-g1').requirements));
ok('v1 原样保留', localStorage.getItem(G.V1_KEY) === beforeV1);
ok('迁移幂等', G.migrate().migrated === 0 && G.list().length === 2, JSON.stringify(G.migrate()));

/* 活跃筛选 */
ok('活跃目标按 priority/primary 排序', G.active(DAY).length === 2, String(G.active(DAY).length));
const g1 = G.get('seed-g1');
g1.activeTo = '2026-10-20';
G.save(g1);
ok('过期目标不活跃', G.active(DAY).filter((g) => g.id === 'seed-g1').length === 0);

/* 保存多模块 requirements */
const g2 = G.get('seed-g2');
g2.requirements = [
  { id: 'r-sleep', moduleId: 'sleep', metric: 'hours', target: 7, unit: 'h', cadence: 'daily' },
  { id: 'r-study', moduleId: 'study', metric: 'minutes', target: 120, unit: 'min', cadence: 'daily' },
  { id: 'r-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }
];
G.save(g2);
const saved = G.get('seed-g2');
ok('保存 3 个模块要求', saved.requirements.length === 3 && saved.requirements[0].moduleId === 'sleep', JSON.stringify(saved.requirements.map((r) => r.moduleId)));

/* 共享模块合并 */
const gA = G.save({
  id: 'g-a', title: '薄肌', status: 'active', priority: 1, primary: true,
  activeFrom: '2026-10-01', activeTo: '2027-03-31',
  requirements: [
    { id: 'a-sleep', moduleId: 'sleep', metric: 'hours', target: 7, unit: 'h', cadence: 'daily' },
    { id: 'a-train', moduleId: 'training', metric: 'sessions', target: 3, unit: '次', cadence: 'weekly' }
  ]
});
const gB = G.save({
  id: 'g-b', title: '考公', status: 'active', priority: 2,
  activeFrom: '2026-10-01', activeTo: '2026-12-20',
  requirements: [
    { id: 'b-sleep', moduleId: 'sleep', metric: 'hours', target: 7, unit: 'h', cadence: 'daily' },
    { id: 'b-study', moduleId: 'study', metric: 'minutes', target: 120, unit: 'min', cadence: 'daily' }
  ]
});
const merged = G.mergeRequirements([gA, gB], '2026-10-25');
const sleep = merged.filter((x) => x.moduleId === 'sleep')[0];
ok('共享睡眠只合并一条', merged.filter((x) => x.moduleId === 'sleep').length === 1);
ok('共享睡眠来源两个目标', sleep.goalIds.length === 2 && sleep.target === 7, JSON.stringify(sleep));

/* 冲突/宽差异 */
const gC = G.save({
  id: 'g-c', title: '减脂', status: 'active', priority: 1,
  activeFrom: '2026-10-01',
  requirements: [{ id: 'c-energy', moduleId: 'diet', metric: 'energy', target: 1800, unit: 'kcal', direction: 'at_most', cadence: 'daily' }]
});
const gD = G.save({
  id: 'g-d', title: '增肌', status: 'active', priority: 2,
  activeFrom: '2026-10-01',
  requirements: [{ id: 'd-energy', moduleId: 'diet', metric: 'energy', target: 2400, unit: 'kcal', direction: 'at_least', cadence: 'daily' }]
});
const conflict = G.mergeRequirements([gC, gD], '2026-10-25').filter((x) => x.moduleId === 'diet')[0];
ok('方向相反标冲突', conflict.conflict === true && conflict.target === null, JSON.stringify(conflict));

const gE = G.save({
  id: 'g-e', title: '目标 E', status: 'active', activeFrom: '2026-10-01',
  requirements: [{ id: 'e-water', moduleId: 'water', metric: 'volume', target: 2, unit: 'L', cadence: 'daily' }]
});
const gF = G.save({
  id: 'g-f', title: '目标 F', status: 'active', activeFrom: '2026-10-01',
  requirements: [{ id: 'f-water', moduleId: 'water', metric: 'volume', target: 1.8, unit: 'L', cadence: 'daily' }]
});
const wide = G.mergeRequirements([gE, gF], '2026-10-25').filter((x) => x.moduleId === 'water')[0];
ok('同向取 max', wide.target === 2 && wide.warning === '', JSON.stringify(wide));

/* 删除 */
ok('删除 requirement', G.removeRequirement('g-a', 'a-train') === true && G.get('g-a').requirements.length === 1);
ok('删除目标', G.remove('g-f') === true && G.get('g-f') === null);

/* 导出 */
const exp = G.exportAll();
ok('导出包含 v2 与旧 v1', exp.goals.length >= 4 && !!exp.legacyV1, JSON.stringify({ n: exp.goals.length, v1: !!exp.legacyV1 }));

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\n目标 v2 校验：${pass}/${rows.length} PASS`);
process.exit(rows.some((r) => r[0] === 'FAIL') ? 1 : 0);



