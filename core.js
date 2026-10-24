/* Money app: pure logic (no DOM). Loaded by index.html and by test/unit.js.
   Everything here must return finite numbers and plain strings, never NaN. */
(function (root) {
  "use strict";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var NEAR = 0.85; // amber from 85% of budget, red once over 100%
  var DASH = "\u2014";

  /* ---------- numbers and formatting ---------- */
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v === undefined || v === null) return 0;
    var t = String(v).replace(/,/g, "").replace(/^\s*(QAR|QR)\s*/i, "").trim();
    if (t === "") return 0;
    var n = Number(t);
    return isFinite(n) ? n : 0;
  }
  function has(v) {
    if (typeof v === "number") return isFinite(v);
    if (v === undefined || v === null) return false;
    var t = String(v).replace(/,/g, "").trim();
    return t !== "" && isFinite(Number(t));
  }
  function safe(n) { return typeof n === "number" && isFinite(n) ? n : 0; }
  function group3(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function fmt(n, dp) {
    var v = safe(n), neg = v < 0; v = Math.abs(v);
    var s = dp && Math.abs(v - Math.round(v)) > 1e-9 ? v.toFixed(dp) : String(Math.round(v));
    var p = s.split(".");
    return (neg && Number(s) !== 0 ? "\u2212" : "") + group3(p[0]) + (p[1] ? "." + p[1] : "");
  }
  function qar(n) { return "QAR " + fmt(n, 0); }
  function qar2(n) { return "QAR " + fmt(n, 2); }
  function pct(n, dp) { if (dp === undefined) dp = 1; return (safe(n) * 100).toFixed(dp) + "%"; }

  /* ---------- dates and money months ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function isoOf(dt) { return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }
  function validYMD(y, m, d) { return y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m); }
  function parseDate(v) {
    var t = String(v === undefined || v === null ? "" : v).trim(), a;
    if ((a = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/.exec(t))) {
      if (validYMD(+a[1], +a[2], +a[3])) return iso(+a[1], +a[2], +a[3]);
      return null;
    }
    if ((a = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(t))) { // day/month/year (Qatar, UK)
      if (validYMD(+a[3], +a[2], +a[1])) return iso(+a[3], +a[2], +a[1]);
      return null;
    }
    return null;
  }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }
  function startDay(v) { var n = Math.floor(num(v)); return n >= 1 && n <= 31 ? n : 1; }
  function startOn(y, m, sd) { return Math.min(startDay(sd), daysIn(y, m)); }
  function keyOf(y, m) { return y + "-" + pad(m); }
  function splitKey(k) { var p = String(k).split("-"); return [Number(p[0]), Number(p[1])]; }
  function shiftKey(k, by) {
    var ym = splitKey(k), idx = ym[0] * 12 + (ym[1] - 1) + by;
    return keyOf(Math.floor(idx / 12), (idx % 12) + 1);
  }
  /* The money month a date belongs to, named after the calendar month it starts in. */
  function moneyMonth(date, sd) {
    var p = String(date).split("-"), y = +p[0], m = +p[1], d = +p[2];
    var k = keyOf(y, m);
    return d >= startOn(y, m, sd) ? k : shiftKey(k, -1);
  }
  function monthRange(k, sd) {
    var ym = splitKey(k), n = splitKey(shiftKey(k, 1));
    var start = iso(ym[0], ym[1], startOn(ym[0], ym[1], sd));
    var end = isoOf(new Date(n[0], n[1] - 1, startOn(n[0], n[1], sd) - 1));
    return { start: start, end: end };
  }
  function nice(isoDate, withYear) {
    var p = isoDate.split("-");
    return +p[2] + " " + MON[+p[1] - 1] + (withYear ? " " + p[0] : "");
  }
  function monthLabel(k, sd) {
    var ym = splitKey(k);
    if (startDay(sd) === 1) return MON[ym[1] - 1] + " " + ym[0];
    var r = monthRange(k, sd), sameYear = r.start.slice(0, 4) === r.end.slice(0, 4);
    return nice(r.start, !sameYear) + " \u2013 " + nice(r.end, true);
  }

  /* ---------- defaults (blank, generic) ---------- */
  var DEFAULT_GROUPS = ["Income", "Financial freedom", "Big expenses", "Bills", "Day-to-day", "Transfers"];
  var DEFAULT_CATEGORIES = [
    ["Income", "Salary"], ["Income", "Refunds and paybacks"], ["Income", "Side hustle income"],
    ["Financial freedom", "Debt repayment"], ["Financial freedom", "Emergency fund"], ["Financial freedom", "Table flip fund"],
    ["Financial freedom", "Retirement"], ["Financial freedom", "Freedom fund"],
    ["Big expenses", "Christmas"], ["Big expenses", "Car \u2013 Maintenance"], ["Big expenses", "Car \u2013 Fuel"],
    ["Big expenses", "Side hustle costs"], ["Big expenses", "Emergencies"], ["Big expenses", "Education"],
    ["Bills", "Rent"], ["Bills", "Electricity"], ["Bills", "Water"], ["Bills", "Subscriptions"], ["Bills", "Domestic worker"],
    ["Bills", "Bank fees"], ["Bills", "Transport"], ["Bills", "Internet"],
    ["Day-to-day", "Supplements"], ["Day-to-day", "Miscellaneous"], ["Day-to-day", "Cash"], ["Day-to-day", "Airtime"],
    ["Day-to-day", "Eating out & takeaways"], ["Day-to-day", "Entertainment & hobbies"], ["Day-to-day", "Gifts"],
    ["Day-to-day", "Groceries \u2013 Food"], ["Day-to-day", "Groceries \u2013 Fruit & veg"], ["Day-to-day", "Groceries \u2013 Cleaning"],
    ["Day-to-day", "Personal care"], ["Day-to-day", "Pets \u2013 Food"], ["Day-to-day", "Pets \u2013 Litter & care"],
    ["Day-to-day", "Adventures & holidays"],
    ["Transfers", "Transfers between accounts"], ["Transfers", "Money sent home"]
  ];
  var DEFAULT_GOALS = ["Emergency fund", "Debt-free", "Table flip fund", "Special savings", "Freedom fund", "Retirement"];
  var DEFAULT_REVIEW = [
    ["balances", "Update every account balance"],
    ["budget", "Check spending against budget"],
    ["savings", "Move money to savings and goal accounts"],
    ["goals", "Update goal amounts"],
    ["next", "Set next month's budgets"]
  ];
  var _id = 0;
  function uid(p) { _id += 1; return (p || "x") + Date.now().toString(36) + _id.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function defaultState() {
    return {
      app: "money", format: 1,
      settings: { currency: "QAR", startDay: "" },
      categories: DEFAULT_CATEGORIES.map(function (c, i) { return { id: "c" + (i + 1), group: c[0], name: c[1], budget: "" }; }),
      transactions: [],
      accounts: [],
      goals: DEFAULT_GOALS.map(function (g, i) { return { id: "g" + (i + 1), name: g, current: "", target: "", monthly: "" }; }),
      reviewSteps: DEFAULT_REVIEW.map(function (r) { return { id: r[0], text: r[1] }; }),
      review: {},
      calc: {}
    };
  }

  /* ---------- totals and budgets ---------- */
  function isIncome(g) { return String(g).toLowerCase() === "income"; }
  function isFreedom(g) { return String(g).toLowerCase().indexOf("financial freedom") === 0; }
  function groupMap(state) { var m = {}; state.categories.forEach(function (c) { m[c.name] = c.group; }); return m; }
  function txIn(state, k) {
    var sd = state.settings.startDay;
    return state.transactions.filter(function (t) { return moneyMonth(t.date, sd) === k; });
  }
  function totals(state, k) {
    var gm = groupMap(state), inc = 0, freedom = 0, spent = 0, debt = 0;
    txIn(state, k).forEach(function (t) {
      var g = gm[t.category] || "Other", a = num(t.amount);
      if (isIncome(g)) inc += a;
      else if (isFreedom(g)) { freedom += a; if (/^debt/i.test(t.category)) debt += a; }
      else spent += a;
    });
    var out = freedom + spent;
    return { inc: inc, freedom: freedom, spent: spent, out: out, debt: debt, saved: freedom - debt, ratio: inc > 0 ? spent / inc : 0, hasRatio: inc > 0, left: inc - out };
  }
  function status(spent, budget) {
    if (!(budget > 0)) return spent > 0 ? "nobudget" : "none";
    var r = spent / budget;
    return r > 1 ? "over" : r >= NEAR ? "near" : "ok";
  }
  function line(name, budget, spent) {
    return { name: name, budget: budget, spent: spent, left: budget - spent, ratio: budget > 0 ? spent / budget : 0, status: status(spent, budget) };
  }
  function budgetStats(state, k) {
    var gm = groupMap(state), spentBy = {};
    txIn(state, k).forEach(function (t) { spentBy[t.category] = (spentBy[t.category] || 0) + num(t.amount); });
    var order = [], groups = {};
    state.categories.forEach(function (c) {
      if (isIncome(c.group)) return;
      if (!groups[c.group]) { groups[c.group] = []; order.push(c.group); }
      groups[c.group].push(c);
    });
    var unknown = Object.keys(spentBy).filter(function (n) { return !(n in gm); });
    if (unknown.length && !groups.Other) { groups.Other = []; order.push("Other"); }
    var out = order.map(function (g) {
      var cats = groups[g].map(function (c) { return Object.assign(line(c.name, num(c.budget), spentBy[c.name] || 0), { id: c.id }); });
      if (g === "Other") unknown.forEach(function (n) { cats.push(Object.assign(line(n, 0, spentBy[n]), { id: null })); });
      var b = cats.reduce(function (a, c) { return a + c.budget; }, 0), s = cats.reduce(function (a, c) { return a + c.spent; }, 0);
      return { group: g, cats: cats, total: line(g + " total", b, s) };
    });
    var income = state.categories.filter(function (c) { return isIncome(c.group); }).map(function (c) {
      return Object.assign(line(c.name, num(c.budget), spentBy[c.name] || 0), { id: c.id });
    });
    var budgeted = out.reduce(function (a, g) { return a + g.total.budget; }, 0);
    var t = totals(state, k);
    var over = 0; out.forEach(function (g) { g.cats.forEach(function (c) { if (c.status === "over") over += 1; }); });
    return {
      groups: out, income: income, budgeted: budgeted, paidOut: t.out, left: budgeted - t.out, hasBudget: budgeted > 0,
      expectedIncome: income.reduce(function (a, c) { return a + c.budget; }, 0), overCount: over,
      overallStatus: status(t.out, budgeted)
    };
  }
  function monthKeys(state, today) {
    var sd = state.settings.startDay, seen = {}, cur = moneyMonth(today, sd);
    seen[cur] = 1;
    state.transactions.forEach(function (t) { seen[moneyMonth(t.date, sd)] = 1; });
    return Object.keys(seen).sort();
  }
  function netWorth(accounts) {
    var assets = 0, debts = 0;
    accounts.forEach(function (a) { if (a.type === "Debt") debts += Math.abs(num(a.balance)); else assets += num(a.balance); });
    return { assets: assets, debts: debts, net: assets - debts };
  }
  function goalStats(g) {
    var target = num(g.target), cur = num(g.current), m = num(g.monthly), togo = Math.max(0, target - cur);
    return {
      target: target, togo: togo, progress: target > 0 ? Math.min(1, Math.max(0, cur / target)) : 0, hasTarget: target > 0,
      monthsLeft: target <= 0 ? null : togo <= 0 ? 0 : m > 0 ? togo / m : null
    };
  }

  /* ---------- calculators (classic budgeting-workbook formulas) ---------- */
  var calc = {
    paycheques: function (age, month) { // (65 - age) * 12 - month, for ages 17-64
      if (!has(age)) return null; var a = num(age);
      if (!(a > 16 && a < 65)) return "age";
      return Math.max(0, (65 - a) * 12 - num(month));
    },
    lifeRatio: function (savings, earnings) { return has(earnings) && num(earnings) > 0 ? 1 - num(savings) / num(earnings) : null; },
    futureEarnings: function (age, salary) { // salary * 12 * ((1.07^(65-age) - 1) / 0.07)
      if (!has(age) || !has(salary) || num(age) >= 65) return null;
      return num(salary) * 12 * ((Math.pow(1.07, 65 - num(age)) - 1) / 0.07);
    },
    rule72: function (rate) { return has(rate) && num(rate) > 0 ? 72 / num(rate) : null; },
    effAnnual: function (monthly, daily) {
      if (has(monthly)) return Math.pow(1 + num(monthly) / 100, 12) - 1;
      if (has(daily)) return Math.pow(1 + num(daily) / 100, 365) - 1;
      return null;
    },
    lumpSum: function (pv, rate, years) {
      if (!has(pv) || !has(years)) return null;
      return num(pv) * Math.pow(1 + num(rate) / 100 / 12, 12 * num(years));
    },
    monthlyFV: function (c, rate, years) {
      if (!has(c) || !has(years)) return null;
      var r = num(rate) / 100 / 12, n = 12 * num(years);
      return r > 0 ? num(c) * ((Math.pow(1 + r, n) - 1) / r) : num(c) * n;
    },
    investTarget: function (goal, current, rate, years) { // goal grown by 6% inflation a year
      var n = num(years) * 12;
      if (!has(goal) || !(n > 0)) return null;
      var r = num(rate) / 100 / 12, fv = num(goal) * Math.pow(1.06, num(years)), cur = num(current);
      var p = r > 0 ? (r * (fv - cur * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1) : (fv - cur) / n;
      return Math.max(0, p);
    },
    car: function (o) {
      var f = ["repay", "insurance", "running", "months", "alt", "value", "settle"];
      if (!f.some(function (k) { return has(o[k]); })) return null;
      var monthly = num(o.repay) + num(o.insurance) + num(o.running), m = num(o.months), run = num(o.insurance) + num(o.running);
      var net = num(o.settle) - num(o.value);
      var r = {
        keepX: monthly * m, keep5: monthly * m + run * Math.max(0, 60 - m), keep10: monthly * m + run * Math.max(0, 120 - m),
        sellX: num(o.alt) * m + net, sell5: num(o.alt) * 60 + net, sell10: num(o.alt) * 120 + net
      };
      r.verdict = r.keep10 > r.sell10 ? "sell" : r.keep10 < r.sell10 ? "keep" : "same";
      return r;
    }
  };

  /* ---------- quick add ---------- */
  function matchCat(text, names) {
    var t = String(text).trim().toLowerCase();
    if (!t) return "";
    for (var i = 0; i < names.length; i++) if (names[i].toLowerCase() === t) return names[i];
    var words = t.split(/[^a-z0-9&]+/).filter(function (w) { return w.length >= 3; });
    var best = "", bestScore = 0;
    names.forEach(function (n) {
      var cl = n.toLowerCase(), score = 0;
      words.forEach(function (w) { var stem = w.length > 5 ? w.slice(0, w.length - 2) : w; if (cl.indexOf(stem) >= 0) score += stem.length; });
      if (score > bestScore) { best = n; bestScore = score; }
    });
    return best;
  }
  /* "QAR 85 groceries - weekly shop" -> amount 85, category text "groceries", note "weekly shop" */
  function parseQuick(s) {
    var t = String(s || "").trim(), amount = null;
    var am = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/.exec(t);
    if (am) {
      var n = Number(am[1].replace(/,/g, ""));
      if (isFinite(n) && n > 0) amount = n;
      t = t.slice(0, am.index) + " " + t.slice(am.index + am[0].length);
    }
    t = t.replace(/\b(qar|qr|riyals?)\b/gi, " ").replace(/\s+/g, " ").trim();
    var catText = t, note = "", sp = /\s[-\u2013\u2014:]\s|[,;]/.exec(t);
    if (sp) { catText = t.slice(0, sp.index).trim(); note = t.slice(sp.index + sp[0].length).trim(); }
    return { amount: amount, catText: catText, note: note };
  }

  /* ---------- CSV ---------- */
  function parseCSV(s) {
    var rows = [], row = [], f = "", q = false;
    s = String(s).replace(/^\uFEFF/, "");
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) { if (c === '"') { if (s.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c !== "\r") f += c;
    }
    row.push(f); rows.push(row);
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
  }
  function csvCell(v) { var s = String(v === undefined || v === null ? "" : v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"' : s; }
  function txToCSV(state) {
    var gm = groupMap(state);
    var lines = ["date,amount,category,group,paid_from,note"];
    state.transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      lines.push([t.date, String(num(t.amount)), t.category, gm[t.category] || "Other", t.paidFrom, t.note].map(csvCell).join(","));
    });
    return lines.join("\n") + "\n";
  }
  /* Returns {rows: [tx], skipped: n, newCategories: [names]} without touching state. */
  function csvToTx(text, state) {
    var rows = parseCSV(text);
    if (!rows.length) return { rows: [], skipped: 0, newCategories: [] };
    var head = rows[0].map(function (h) { return h.trim().toLowerCase().replace(/[^a-z]/g, ""); });
    var col = function (names) { for (var i = 0; i < head.length; i++) for (var j = 0; j < names.length; j++) if (head[i].indexOf(names[j]) === 0) return i; return -1; };
    var ci = { date: col(["date"]), amount: col(["amount"]), cat: col(["category"]), paid: col(["paidfrom", "account"]), note: col(["note", "description"]) };
    var body = rows.slice(1);
    if (ci.date < 0 || ci.amount < 0) { ci = { date: 0, amount: 1, cat: 2, paid: 3, note: 4 }; body = rows; }
    var known = {}; state.categories.forEach(function (c) { known[c.name] = 1; });
    var out = [], skipped = 0, added = [];
    body.forEach(function (r) {
      var g = function (i) { return i >= 0 ? String(r[i] === undefined ? "" : r[i]).trim().replace(/^'(?=[=+\-@])/, "") : ""; };
      var date = parseDate(g(ci.date)), amount = num(g(ci.amount));
      if (!date || !(amount > 0)) { skipped += 1; return; }
      var cat = g(ci.cat) || "Uncategorised";
      if (!known[cat]) { known[cat] = 1; added.push(cat); }
      out.push({ id: uid("t"), date: date, amount: amount, category: cat, paidFrom: g(ci.paid), note: g(ci.note) });
    });
    return { rows: out, skipped: skipped, newCategories: added };
  }

  /* ---------- JSON backup ---------- */
  function str(v) { return v === undefined || v === null ? "" : String(v); }
  function amt(v) { return has(v) ? String(num(v)) : ""; }
  function normalize(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("This file is not a Money app backup.");
    if (o.app !== undefined && o.app !== "money") throw new Error("This file is not a Money app backup.");
    var d = defaultState(), ids = {};
    var arr = function (v) { return Array.isArray(v) ? v : []; };
    var fresh = function (id, p) { var s = str(id); if (!s || ids[s]) s = uid(p); ids[s] = 1; return s; };
    var s = {
      app: "money", format: 1,
      settings: { currency: "QAR", startDay: o.settings && has(o.settings.startDay) && num(o.settings.startDay) >= 1 && num(o.settings.startDay) <= 31 ? String(Math.floor(num(o.settings.startDay))) : "" },
      categories: Array.isArray(o.categories) ? o.categories.filter(function (c) { return c && str(c.name).trim(); }).map(function (c) {
        return { id: fresh(c.id, "c"), group: str(c.group).trim() || "Other", name: str(c.name).trim(), budget: amt(c.budget) };
      }) : d.categories,
      transactions: arr(o.transactions).map(function (t) {
        var date = t && parseDate(t.date);
        if (!date || !(num(t.amount) > 0)) return null;
        return { id: fresh(t.id, "t"), date: date, amount: num(t.amount), category: str(t.category).trim() || "Uncategorised", paidFrom: str(t.paidFrom).trim(), note: str(t.note).trim() };
      }).filter(Boolean),
      accounts: arr(o.accounts).filter(Boolean).map(function (a) {
        return { id: fresh(a.id, "a"), name: str(a.name), type: a.type === "Debt" ? "Debt" : "Asset", balance: amt(a.balance) };
      }),
      goals: Array.isArray(o.goals) ? o.goals.filter(Boolean).map(function (g) {
        return { id: fresh(g.id, "g"), name: str(g.name), current: amt(g.current), target: amt(g.target), monthly: amt(g.monthly) };
      }) : d.goals,
      reviewSteps: Array.isArray(o.reviewSteps) && o.reviewSteps.length ? o.reviewSteps.filter(function (r) { return r && str(r.text).trim(); }).map(function (r) { return { id: fresh(r.id, "r"), text: str(r.text) }; }) : d.reviewSteps,
      review: {},
      calc: {}
    };
    if (o.review && typeof o.review === "object") Object.keys(o.review).forEach(function (k) {
      if (!/^\d{4}-\d{2}$/.test(k) || !o.review[k] || typeof o.review[k] !== "object") return;
      var m = {}; Object.keys(o.review[k]).forEach(function (id) { if (o.review[k][id] === true) m[id] = true; });
      s.review[k] = m;
    });
    if (o.calc && typeof o.calc === "object") Object.keys(o.calc).forEach(function (k) { if (/^[a-zA-Z0-9]+$/.test(k)) s.calc[k] = str(o.calc[k]).slice(0, 30); });
    return s;
  }
  function toBackup(state, now) {
    var o = JSON.parse(JSON.stringify(state));
    o.app = "money"; o.format = 1; o.exportedAt = (now || new Date()).toISOString();
    return JSON.stringify(o, null, 2);
  }
  function fromBackup(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error("This file is not valid JSON."); }
    return normalize(o);
  }

  var api = {
    MON: MON, NEAR: NEAR, DASH: DASH, DEFAULT_GROUPS: DEFAULT_GROUPS,
    num: num, has: has, safe: safe, fmt: fmt, qar: qar, qar2: qar2, pct: pct,
    iso: iso, isoOf: isoOf, parseDate: parseDate, daysIn: daysIn, startDay: startDay, startOn: startOn, keyOf: keyOf, shiftKey: shiftKey,
    moneyMonth: moneyMonth, monthRange: monthRange, monthLabel: monthLabel, nice: nice,
    uid: uid, defaultState: defaultState, isIncome: isIncome, isFreedom: isFreedom, groupMap: groupMap,
    txIn: txIn, totals: totals, status: status, budgetStats: budgetStats, monthKeys: monthKeys, netWorth: netWorth, goalStats: goalStats,
    calc: calc, matchCat: matchCat, parseQuick: parseQuick,
    parseCSV: parseCSV, txToCSV: txToCSV, csvToTx: csvToTx, normalize: normalize, toBackup: toBackup, fromBackup: fromBackup
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Money = api;
})(typeof self !== "undefined" ? self : this);
