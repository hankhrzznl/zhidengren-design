/* ============================================================
   云收件箱 cloud-inbox.js（可选）
   作用：快捷指令不打开 Safari，直接 POST 到 Supabase Edge Function；
        记账页打开时把收件箱里没处理过的条目拉进本地账本。
   存储：localStorage['lifeflow-inbox-config'] = {url, token}
        localStorage['lifeflow-inbox-seen']   = [云端 id]
   ============================================================ */
(function (root) {
  'use strict';
  var CFG = 'lifeflow-inbox-config';
  var SEEN = 'lifeflow-inbox-seen';

  function config() {
    try { return JSON.parse(root.localStorage.getItem(CFG) || 'null'); } catch (e) { return null; }
  }
  function saveConfig(cfg) {
    root.localStorage.setItem(CFG, JSON.stringify({ url: String(cfg.url || '').replace(/\/+$/, ''), token: String(cfg.token || '') }));
  }
  function seen() {
    try { return JSON.parse(root.localStorage.getItem(SEEN) || '[]'); } catch (e) { return []; }
  }
  function markSeen(ids) {
    var all = seen().concat(ids);
    if (all.length > 800) all = all.slice(all.length - 800);
    root.localStorage.setItem(SEEN, JSON.stringify(all));
  }
  function clearSeen() { root.localStorage.removeItem(SEEN); }

  function dateOf(row) {
    var d = String(row.date || row.created_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
    var p = d.split('-').map(Number);
    return p[0] + '-' + p[1] + '-' + p[2];
  }
  function accountFor(row) {
    var L = root.LightLedger;
    if (!L) return null;
    var list = L.listAccounts();
    var wanted = String(row.account || '').trim();
    if (wanted) {
      var byName = list.filter(function (a) { return a.name === wanted; })[0];
      if (byName) return byName;
      var byPart = list.filter(function (a) { return a.name.indexOf(wanted) >= 0 || wanted.indexOf(a.name) >= 0; })[0];
      if (byPart) return byPart;
    }
    return list.filter(function (a) { return a.type === 'asset'; })[0] || list[0] || null;
  }

  /* 拉取并入库；返回 {added, total, skipped} */
  async function pull() {
    var cfg = config();
    if (!cfg || !cfg.url || !cfg.token) throw new Error('no-config');
    var res = await root.fetch(cfg.url + '/inbox?token=' + encodeURIComponent(cfg.token), {
      method: 'GET', headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('http-' + res.status);
    var data = await res.json();
    var rows = Array.isArray(data) ? data : (data.items || []);
    var done = seen();
    var added = 0, skipped = 0;
    rows.forEach(function (r) {
      if (!r || !r.id) return;
      if (done.indexOf(r.id) >= 0) { skipped++; return; }
      var acc = accountFor(r);
      if (!acc) { skipped++; return; }
      var tx = root.LightLedger.addTx({
        type: r.type === 'income' ? 'income' : 'expense',
        amount: Number(r.amount),
        accountId: acc.id,
        category: r.cat || '日常',
        note: r.note || '',
        date: dateOf(r)
      });
      if (!tx) { skipped++; return; }
      done.push(r.id);
      added++;
    });
    markSeen(done);
    return { added: added, total: rows.length, skipped: skipped };
  }

  root.LightInbox = {
    config: config,
    saveConfig: saveConfig,
    pull: pull,
    seen: seen,
    clearSeen: clearSeen
  };
})(typeof window !== 'undefined' ? window : globalThis);
