/* ============================================================
   账单 CSV 导入 bill-csv.js
   支持：支付宝「交易明细」、微信「账单」导出的 CSV。
   纯函数：parse(text) -> {source, rows, skipped}
   ============================================================ */
(function (root) {
  'use strict';

  function splitLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  function splitCsv(text) {
    var raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
    var rows = [], field = '', row = [], q = false;
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i];
      if (q) {
        if (c === '"' && raw[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function findHeader(rows) {
    for (var i = 0; i < Math.min(rows.length, 10); i++) {
      var line = rows[i].join(',');
      if (line.indexOf('交易时间') >= 0 && line.indexOf('金额') >= 0) return i;
    }
    return -1;
  }

  function idx(headers, names) {
    for (var i = 0; i < names.length; i++) {
      var k = headers.indexOf(names[i]);
      if (k >= 0) return k;
    }
    return -1;
  }

  function cleanAmount(v) {
    var s = String(v || '').replace(/[¥￥,\s元]/g, '');
    var n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function normalizeDate(v) {
    var m = String(v || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!m) return '';
    return m[1] + '-' + Number(m[2]) + '-' + Number(m[3]);
  }

  function parse(text) {
    var rows = splitCsv(text);
    var hi = findHeader(rows);
    if (hi < 0) return { source: 'unknown', rows: [], skipped: 0 };
    var headers = rows[hi].map(function (h) { return String(h).trim(); });
    var cDate = idx(headers, ['交易时间', '交易创建时间', '时间']);
    var cType = idx(headers, ['收/支', '收支类型', '收支']);
    var cAmount = idx(headers, ['金额', '金额(元)', '金额（元）']);
    var cNote = idx(headers, ['交易对方', '商品说明', '商品', '备注']);
    var cAccount = idx(headers, ['收/付款方式', '支付方式', '付款方式']);
    var source = headers.some(function (h) { return h.indexOf('收/付款方式') >= 0; }) ? 'alipay' : 'wechat';

    var out = [], skipped = 0;
    rows.slice(hi + 1).forEach(function (r) {
      if (!r || !r.length) return;
      var typeRaw = cType >= 0 ? String(r[cType] || '').trim() : '';
      if (typeRaw.indexOf('不计收支') >= 0 || typeRaw === '') { skipped++; return; }
      var amount = cleanAmount(cAmount >= 0 ? r[cAmount] : '');
      var date = normalizeDate(cDate >= 0 ? r[cDate] : '');
      if (!(amount > 0) || !date) { skipped++; return; }
      var note = [cNote >= 0 ? r[cNote] : '', cNote >= 0 ? r[cNote + 1] : '']
        .filter(function (s) { return s && String(s).trim(); }).join(' · ').slice(0, 40);
      var account = cAccount >= 0 ? String(r[cAccount] || '').trim() : '';
      var cat = '日常';
      try {
        if (root.LightBillParse) {
          var g = root.LightBillParse.parse('¥1 ' + note + ' ' + account);
          if (g && g.cat) cat = g.cat;
        }
      } catch (e) {}
      out.push({
        date: date,
        type: typeRaw.indexOf('收入') >= 0 ? 'income' : 'expense',
        amount: amount,
        note: note,
        account: account,
        cat: cat,
        source: source
      });
    });
    return { source: source, rows: out, skipped: skipped };
  }

  root.LightBillCsv = { parse: parse, splitCsv: splitCsv };
})(typeof window !== 'undefined' ? window : globalThis);

