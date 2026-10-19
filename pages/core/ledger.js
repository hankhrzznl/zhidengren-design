/* ============================================================
   执灯人 · 账本内核 ledger.js（v1）
   ------------------------------------------------------------
   职责：账户、流水、分期的纯数据层；钱怎么算都在这里，页面只负责画。

   存储：localStorage['lifeflow-ledger-v1']
     {
       v: 1,
       accounts: [{id,name,type:'asset'|'credit',kind,opening,limit,billDay,repayDay,color}],
       tx:      [{id,ts,date,type:'expense'|'income'|'transfer'|'repay',amount,accountId,toId,category,note}],
       plans:   [{id,accountId,name,principal,periods,feeRate,monthly,startDate,paid}]
     }

   口径：
   - 资产账户余额 = opening + income + transferIn - expense - transferOut - repayOut
   - 信用账户已用 = opening + expense - repayIn
   - 净资产 = 资产合计 - 信用已用
   - 分期只做「还款计划」，本金已在信用已用里，不再重复计负债
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'lifeflow-ledger-v1';
  var VERSION = 1;

  function empty() { return { v: VERSION, accounts: [], tx: [], plans: [] }; }

  function load() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return empty();
      var db = JSON.parse(raw);
      if (!db || typeof db !== 'object') return empty();
      db.v = db.v || VERSION;
      db.accounts = db.accounts || [];
      db.tx = db.tx || [];
      db.plans = db.plans || [];
      return db;
    } catch (e) { return empty(); }
  }

  function save(db) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) { return false; }
  }

  function id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function monthKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1);
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* 默认账户：先能用，再让用户改名/改余额 */
  function ensureSeed() {
    var db = load();
    if (db.accounts.length) return db;
    db.accounts = [
      { id: 'acc_wechat', name: '微信钱包', type: 'asset', kind: 'wechat', opening: 0, color: '#3EB575' },
      { id: 'acc_alipay', name: '支付宝', type: 'asset', kind: 'alipay', opening: 0, color: '#1677FF' },
      { id: 'acc_bank1', name: '招商银行卡', type: 'asset', kind: 'bank', opening: 0, color: '#C0392B' },
      { id: 'acc_huabei', name: '花呗', type: 'credit', kind: 'huabei', opening: 0, limit: 5000, billDay: 1, repayDay: 10, color: '#8B5CF6' },
      { id: 'acc_baitiao', name: '白条', type: 'credit', kind: 'baitiao', opening: 0, limit: 5000, billDay: 1, repayDay: 10, color: '#D97706' }
    ];
    save(db);
    return db;
  }

  function listAccounts() { return load().accounts.slice(); }

  function accountById(db, accountId) {
    db = db || load();
    for (var i = 0; i < db.accounts.length; i++) if (db.accounts[i].id === accountId) return db.accounts[i];
    return null;
  }

  function addAccount(input) {
    input = input || {};
    var name = String(input.name || '').trim();
    if (!name) return null;
    var db = load();
    var acc = {
      id: id('acc_'),
      name: name,
      type: input.type === 'credit' ? 'credit' : 'asset',
      kind: input.kind || (input.type === 'credit' ? 'credit' : 'bank'),
      opening: num(input.opening),
      limit: input.type === 'credit' ? num(input.limit) : 0,
      billDay: num(input.billDay) || 1,
      repayDay: num(input.repayDay) || 10,
      color: input.color || (input.type === 'credit' ? '#8B5CF6' : '#4DC3FF')
    };
    db.accounts.push(acc);
    if (!save(db)) return null;
    return acc;
  }

  function updateAccount(accountId, patch) {
    var db = load();
    var acc = accountById(db, accountId);
    if (!acc) return null;
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'opening' || k === 'limit' || k === 'billDay' || k === 'repayDay') acc[k] = num(patch[k]);
      else if (k === 'name') acc.name = String(patch[k]).slice(0, 20);
      else acc[k] = patch[k];
    });
    save(db);
    return acc;
  }

  /* 账户余额：从 opening + 流水实时算，不存冗余 */
  function accountBalance(db, accountId) {
    db = db || load();
    var acc = accountById(db, accountId);
    if (!acc) return 0;
    var bal = num(acc.opening);
    db.tx.forEach(function (t) {
      var a = num(t.amount);
      if (acc.type === 'asset') {
        if (t.type === 'income' && t.accountId === accountId) bal += a;
        else if (t.type === 'expense' && t.accountId === accountId) bal -= a;
        else if (t.type === 'transfer' && t.accountId === accountId) bal -= a;
        else if (t.type === 'transfer' && t.toId === accountId) bal += a;
        else if (t.type === 'repay' && t.accountId === accountId) bal -= a;
      } else {
        if (t.type === 'expense' && t.accountId === accountId) bal += a;
        else if (t.type === 'repay' && t.toId === accountId) bal -= a;
      }
    });
    return Math.round(bal * 100) / 100;
  }

  function addTx(input) {
    input = input || {};
    var amount = num(input.amount);
    if (amount <= 0) return null;
    var type = input.type || 'expense';
    if (!['expense', 'income', 'transfer', 'repay'].includes(type)) return null;
    if (!input.accountId) return null;
    var db = load();
    if (!accountById(db, input.accountId)) return null;
    var tx = {
      id: id('tx_'),
      ts: Date.now(),
      date: input.date || dateKey(),
      type: type,
      amount: Math.round(amount * 100) / 100,
      accountId: input.accountId,
      category: String(input.category || (type === 'income' ? '收入' : '日常')),
      note: String(input.note || '').slice(0, 60)
    };
    if (type === 'transfer' || type === 'repay') {
      if (!input.toId || input.toId === input.accountId) return null;
      tx.toId = input.toId;
    }
    db.tx.push(tx);
    if (!save(db)) return null;
    return tx;
  }

  function removeTx(txId) {
    var db = load();
    var i = db.tx.findIndex(function (t) { return t.id === txId; });
    if (i < 0) return false;
    db.tx.splice(i, 1);
    return save(db);
  }

  function plans() { return load().plans.slice(); }

  function addPlan(input) {
    input = input || {};
    var principal = num(input.principal);
    var periods = Math.round(num(input.periods));
    if (principal <= 0 || periods < 1 || !input.accountId) return null;
    var feeRate = num(input.feeRate);
    var monthly = Math.round((principal * (1 + feeRate / 100) / periods) * 100) / 100;
    var db = load();
    var plan = {
      id: id('plan_'),
      accountId: input.accountId,
      name: String(input.name || '分期').slice(0, 20),
      principal: Math.round(principal * 100) / 100,
      periods: periods,
      feeRate: feeRate,
      monthly: monthly,
      startDate: input.startDate || dateKey(),
      paid: 0
    };
    db.plans.push(plan);
    /* 本金记成一笔信用支出（这样「已用」就包含了它，计划只管还款节奏） */
    db.tx.push({
      id: id('tx_'),
      ts: Date.now(),
      date: plan.startDate,
      type: 'expense',
      amount: principal,
      accountId: plan.accountId,
      category: '分期本金',
      note: plan.name
    });
    if (!save(db)) return null;
    return plan;
  }

  function repayPlan(planId, fromAccountId) {
    var db = load();
    var plan = db.plans.find(function (p) { return p.id === planId; });
    if (!plan) return null;
    if (plan.paid >= plan.periods) return null;
    if (!fromAccountId) return null;
    db.tx.push({
      id: id('tx_'),
      ts: Date.now(),
      date: dateKey(),
      type: 'repay',
      amount: plan.monthly,
      accountId: fromAccountId,
      toId: plan.accountId,
      category: '分期还款',
      note: plan.name
    });
    plan.paid += 1;
    if (!save(db)) return null;
    return plan;
  }

  function planRemaining(plan) { return Math.max(0, plan.periods - plan.paid) * plan.monthly; }

  /* ---- 本月预算 / 分类汇总 ---- */
  function setBudget(amount, month) {
    var db = load();
    db.budget = { month: month || monthKey(), amount: Math.max(0, num(amount)) };
    if (!save(db)) return null;
    return db.budget;
  }

  function budgetOf(month) {
    var db = load();
    var mk = month || monthKey();
    return db.budget && db.budget.month === mk ? num(db.budget.amount) : 0;
  }

  function categoryBreakdown(month, limit) {
    var db = load();
    var mk = month || monthKey();
    var map = {};
    db.tx.forEach(function (t) {
      if (t.type !== 'expense') return;
      var d = String(t.date || '');
      if (d.slice(0, d.lastIndexOf('-')) !== mk) return;
      var c = t.category || '日常';
      map[c] = (map[c] || 0) + num(t.amount);
    });
    return Object.keys(map).map(function (c) {
      return { category: c, amount: Math.round(map[c] * 100) / 100 };
    }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, limit || 3);
  }

  function totals(month) {
    var db = load();
    var mk = month || monthKey();
    var assets = 0, creditUsed = 0, monthSpend = 0, monthIncome = 0;
    db.accounts.forEach(function (a) {
      var bal = accountBalance(db, a.id);
      if (a.type === 'credit') creditUsed += Math.max(0, bal);
      else assets += bal;
    });
    db.tx.forEach(function (t) {
      if (String(t.date).slice(0, t.date.lastIndexOf('-')) !== mk) return;
      if (t.type === 'expense') monthSpend += num(t.amount);
      if (t.type === 'income') monthIncome += num(t.amount);
    });
    var net = assets - creditUsed;
    return {
      assets: Math.round(assets * 100) / 100,
      creditUsed: Math.round(creditUsed * 100) / 100,
      net: Math.round(net * 100) / 100,
      monthSpend: Math.round(monthSpend * 100) / 100,
      monthIncome: Math.round(monthIncome * 100) / 100,
      accounts: db.accounts.length,
      plans: db.plans.length
    };
  }

  /* ---- 月报：单月汇总 / 六个月趋势 / 分期自动还款 ---- */
  function monthSummary(month) {
    var db = load();
    var mk = month || monthKey();
    var income = 0, expense = 0;
    var byCat = {}, byAcc = {};
    db.tx.forEach(function (t) {
      if (t.type !== 'expense' && t.type !== 'income') return;
      var d = String(t.date || '');
      if (d.slice(0, d.lastIndexOf('-')) !== mk) return;
      var a = num(t.amount);
      if (t.type === 'income') { income += a; return; }
      expense += a;
      var c = t.category || '日常';
      byCat[c] = (byCat[c] || 0) + a;
      byAcc[t.accountId] = (byAcc[t.accountId] || 0) + a;
    });
    var round = function (x) { return Math.round(x * 100) / 100; };
    var categories = Object.keys(byCat).map(function (c) {
      return { category: c, amount: round(byCat[c]), share: expense ? Math.round(byCat[c] / expense * 100) : 0 };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var accounts = Object.keys(byAcc).map(function (id) {
      var acc = accountById(db, id);
      return { id: id, name: acc ? acc.name : '账户', amount: round(byAcc[id]) };
    }).sort(function (a, b) { return b.amount - a.amount; });
    return { month: mk, income: round(income), expense: round(expense), balance: round(income - expense), byCategory: categories, byAccount: accounts };
  }

  function monthlyTrend(n, endMonth) {
    var db = load();
    var count = n || 6;
    var out = [];
    var end = endMonth ? endMonth.split('-').map(Number) : null;
    var now = end ? new Date(end[0], end[1] - 1, 1) : new Date();
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var mk = d.getFullYear() + '-' + (d.getMonth() + 1);
      var expense = 0, income = 0;
      db.tx.forEach(function (t) {
        var ds = String(t.date || '');
        if (ds.slice(0, ds.lastIndexOf('-')) !== mk) return;
        if (t.type === 'expense') expense += num(t.amount);
        if (t.type === 'income') income += num(t.amount);
      });
      out.push({ month: mk, label: (d.getMonth() + 1) + '月', expense: Math.round(expense * 100) / 100, income: Math.round(income * 100) / 100 });
    }
    return out;
  }

  /* 加 n 个月；月末对齐（1/31 + 1 月 = 2/28/29） */
  function addMonths(dateStr, n) {
    var p = String(dateStr).split('-').map(Number);
    var y = p[0], m = p[1] - 1, day = p[2] || 1;
    var d = new Date(y, m + n, 1);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* 日期比较用数字，避免 2026-9-15 与 2026-10-15 的字符串坑 */
  function dateNum(dateStr) {
    var p = String(dateStr || '').split('-').map(Number);
    return (p[0] || 0) * 10000 + (p[1] || 0) * 100 + (p[2] || 1);
  }

  /* 到期自动记一期：从第一个资产账户扣，记在应还日；可补多期 */
  function autoRepayDue(today) {
    var db = load();
    var t = today || dateKey();
    var n = 0;
    db.plans.forEach(function (p) {
      while (p.paid < p.periods) {
        var due = addMonths(p.startDate, p.paid + 1);
        if (dateNum(due) > dateNum(t)) break;
        var from = db.accounts.filter(function (a) { return a.type === 'asset'; })[0];
        if (!from) break;
        db.tx.push({
          id: id('tx_'),
          ts: Date.now(),
          date: due,
          type: 'repay',
          amount: p.monthly,
          accountId: from.id,
          toId: p.accountId,
          category: '分期自动还款',
          note: p.name
        });
        p.paid += 1;
        n += 1;
        if (n > 60) break;
      }
    });
    if (n) save(db);
    return n;
  }

  /* 旧「记账」页的数据迁移：一次性把历史条目导入微信钱包 */  function migrateLegacy() {
    var KEY_OLD = 'lifeflow-expense-items';
    var FLAG = 'lifeflow-ledger-migrated';
    try {
      if (root.localStorage.getItem(FLAG)) return 0;
      var raw = root.localStorage.getItem(KEY_OLD);
      var db = load();
      var n = 0;
      if (raw) {
        var old = JSON.parse(raw);
        var items = (old && old.items) || [];
        items.forEach(function (it) {
          var amount = num(it.amount);
          if (amount <= 0) return;
          db.tx.push({
            id: id('tx_'),
            ts: Number(it.ts) || Date.now(),
            date: it.date || dateKey(),
            type: 'expense',
            amount: amount,
            accountId: 'acc_wechat',
            category: it.cat || it.category || '日常',
            note: String(it.note || '').slice(0, 60)
          });
          n++;
        });
      }
      if (n) save(db);
      root.localStorage.setItem(FLAG, '1');
      return n;
    } catch (e) { return 0; }
  }

  root.LightLedger = {
    KEY: KEY,
    load: load,
    save: save,
    ensureSeed: ensureSeed,
    listAccounts: listAccounts,
    accountById: accountById,
    addAccount: addAccount,
    updateAccount: updateAccount,
    accountBalance: accountBalance,
    addTx: addTx,
    removeTx: removeTx,
    plans: plans,
    addPlan: addPlan,
    repayPlan: repayPlan,
    planRemaining: planRemaining,
    setBudget: setBudget,
    budgetOf: budgetOf,
    categoryBreakdown: categoryBreakdown,
    monthSummary: monthSummary,
    monthlyTrend: monthlyTrend,
    addMonths: addMonths,
    autoRepayDue: autoRepayDue,
    totals: totals,
    monthKey: monthKey,
    dateKey: dateKey,
    migrateLegacy: migrateLegacy
  };
})(typeof window !== 'undefined' ? window : globalThis);
