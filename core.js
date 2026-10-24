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
  var DEFAULT_GROUPS = ["Income", "Financial freedom", "Big expenses", "Bills", "Day-to-day", "Family & remittances", "Transfers"];
  var DEFAULT_CATEGORIES = [
    ["Income", "Salary"], ["Income", "Paybacks"], ["Income", "Side hustle income"],
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
    ["Family & remittances", "Money sent home"],
    ["Transfers", "Transfers between accounts"]
  ];
  var DEFAULT_GOALS = ["Emergency fund", "Debt-free", "Table flip fund", "Special savings", "Freedom fund", "Retirement"];
  var DEFAULT_REVIEW = [
    ["balances", "Update every account balance"],
    ["budget", "Check spending against budget"],
    ["savings", "Move money to savings and goal accounts"],
    ["goals", "Update goal amounts"],
    ["next", "Set next month's budgets"]
  ];
  var SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
  // Stored/backup format; add a migration in normalize() when this changes.
  // 2: "Money sent home" moved out of Transfers into "Family & remittances"; settings.groupTypes (#2).
  // 3: negative amounts are refunds against their category; "Refunds and paybacks" renamed "Paybacks" (#3).
  // 4: calculator assumptions are inputs (#5); older saved inputs keep the old fixed 6% / 7%.
  // 5: per-category `debt` flag (#30); older data gets it from the old "name starts with Debt" rule.
  var FORMAT = 5, SUPPORTED_FORMATS = [1, 2, 3, 4, 5];
  var _id = 0;
  function uid(p) { _id += 1; return (p || "x") + Date.now().toString(36) + _id.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function defaultState() {
    return {
      app: "money", format: FORMAT,
      settings: { currency: "QAR", startDay: "", groupTypes: dict() },
      categories: DEFAULT_CATEGORIES.map(function (c, i) { return { id: "c" + (i + 1), group: c[0], name: c[1], budget: "", debt: c[1] === "Debt repayment" }; }),
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
  /* Maps keyed by user/imported names (categories, groups, paid-from) have no prototype, so names like
     "constructor", "__proto__" or "toString" are ordinary keys (#12). */
  function dict() { return Object.create(null); }
  /* How a group counts (#2). income: money in. spending: paid out and in the spending ratio. saving: paid out,
     counted as saved (debt categories as debt repaid), not spending. outflow: paid out, not spending.
     transfer: moving your own money between accounts; not counted anywhere except "Paid from". */
  var GROUP_TYPES = ["spending", "saving", "outflow", "transfer"];
  function defaultGroupType(g) { return isIncome(g) ? "income" : isFreedom(g) ? "saving" : String(g).toLowerCase() === "transfers" ? "transfer" : "spending"; }
  function groupType(state, g) {
    if (isIncome(g)) return "income";
    var t = state.settings && state.settings.groupTypes;
    if (t && Object.prototype.hasOwnProperty.call(t, g) && GROUP_TYPES.indexOf(t[g]) >= 0) return t[g];
    return defaultGroupType(g);
  }
  function groupMap(state) { var m = dict(); state.categories.forEach(function (c) { m[c.name] = c.group; }); return m; }
  /* Debt repayment is a per-category flag (#30), set on the Budget tab; renaming a category doesn't change it.
     defaultDebt() is only the starting value for a new category (and the format 4 -> 5 migration). A transaction
     whose category no longer exists has no flag, so it keeps the old name rule; that keeps older totals unchanged. */
  function defaultDebt(name) { return /^debt/i.test(String(name)); }
  function debtMap(state) { var m = dict(); state.categories.forEach(function (c) { m[c.name] = c.debt === true; }); return m; }
  function txIn(state, k) {
    var sd = state.settings.startDay;
    return state.transactions.filter(function (t) { return moneyMonth(t.date, sd) === k; });
  }
  function totals(state, k) {
    var gm = groupMap(state), dm = debtMap(state), inc = 0, freedom = 0, spent = 0, debt = 0, other = 0, moved = 0;
    txIn(state, k).forEach(function (t) {
      var g = gm[t.category] || "Other", a = num(t.amount), ty = groupType(state, g);
      if (ty === "income") inc += a;
      else if (ty === "saving") { freedom += a; if (t.category in dm ? dm[t.category] : defaultDebt(t.category)) debt += a; }
      else if (ty === "outflow") other += a;
      else if (ty === "transfer") moved += a;
      else spent += a;
    });
    var out = freedom + spent + other;
    return { inc: inc, freedom: freedom, spent: spent, other: other, transfers: moved, out: out, debt: debt, saved: freedom - debt, ratio: inc > 0 ? spent / inc : 0, hasRatio: inc > 0, left: inc - out };
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
    var gm = groupMap(state), spentBy = dict();
    txIn(state, k).forEach(function (t) { spentBy[t.category] = (spentBy[t.category] || 0) + num(t.amount); });
    var order = [], groups = dict();
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
      return { group: g, type: groupType(state, g), cats: cats, total: line(g + " total", b, s) };
    });
    var counted = out.filter(function (g) { return g.type !== "transfer"; }); // transfers aren't budgeted spending
    var income = state.categories.filter(function (c) { return isIncome(c.group); }).map(function (c) {
      return Object.assign(line(c.name, num(c.budget), spentBy[c.name] || 0), { id: c.id });
    });
    var budgeted = counted.reduce(function (a, g) { return a + g.total.budget; }, 0);
    var t = totals(state, k);
    var over = 0; counted.forEach(function (g) { g.cats.forEach(function (c) { if (c.status === "over") over += 1; }); });
    return {
      groups: out, income: income, budgeted: budgeted, paidOut: t.out, left: budgeted - t.out, hasBudget: budgeted > 0,
      expectedIncome: income.reduce(function (a, c) { return a + c.budget; }, 0), overCount: over,
      overallStatus: status(t.out, budgeted)
    };
  }
  function monthKeys(state, today) {
    var sd = state.settings.startDay, seen = dict(), cur = moneyMonth(today, sd);
    seen[cur] = 1;
    state.transactions.forEach(function (t) { seen[moneyMonth(t.date, sd)] = 1; });
    return Object.keys(seen).sort();
  }
  function netWorth(accounts) {
    var assets = 0, debts = 0;
    accounts.forEach(function (a) { if (a.type === "Debt") debts += Math.abs(num(a.balance)); else assets += num(a.balance); });
    return { assets: assets, debts: debts, net: assets - debts };
  }
  /* Months left = still to go / monthly. A positive monthly amount so small that the goal would take more than
     MAX_GOAL_MONTHS (100 years), or overflow to Infinity, is "not reachable at this rate": monthsLeft is null and
     `unreachable` is true, so nothing shows a nonsense or infinite figure (#29). A zero or blank monthly is just null. */
  var MAX_GOAL_MONTHS = 1200;
  function goalStats(g) {
    var target = num(g.target), cur = num(g.current), m = num(g.monthly), togo = Math.max(0, target - cur);
    if (!isFinite(togo)) togo = Number.MAX_VALUE; // e.g. target 1e308 with current -1e308
    var months = target <= 0 ? null : togo <= 0 ? 0 : m > 0 ? togo / m : null;
    var unreachable = months !== null && months > 0 && !(months <= MAX_GOAL_MONTHS);
    return {
      target: target, togo: togo, progress: target > 0 ? Math.min(1, Math.max(0, cur / target)) : 0, hasTarget: target > 0,
      monthsLeft: unreachable ? null : months, unreachable: unreachable
    };
  }

  /* ---------- calculators (classic budgeting-workbook formulas) ---------- */
  /* Rate/term validation (#11). Calculators return null for "not filled in yet", a number, or a string code
     the UI turns into a message: "rate" (annual rate must be above -100%), "years" (term must be a finite
     number of years >= 0, or > 0 where noted), "big" (result too large to show), "nodouble". */
  var MAX_SHOW = 1e15;
  function badRate(rate) { return has(rate) && !(num(rate) > -100); }
  function badYears(years, positive) { var y = num(years); return !(isFinite(y) && (positive ? y > 0 : y >= 0) && y <= 1000); }
  function shown(x) { return isFinite(x) && Math.abs(x) < MAX_SHOW ? x : "big"; }
  /* (1+r)^n and the annuity factor ((1+r)^n - 1) / r, computed stably for tiny |r| (and exactly n at r = 0). */
  function growth(r, n) { return Math.exp(n * Math.log1p(r)); }
  function annuity(r, n) { return r === 0 ? n : Math.expm1(n * Math.log1p(r)) / r; }
  /* Default assumptions (#5), shown next to each result and editable there. */
  var ASSUME = { inflation: 3, payGrowth: 4, retire: 65 };
  function pctIn(v, dflt) { return has(v) ? num(v) : dflt; }
  var calc = {
    // Monthly paycheques until the retirement-age birthday: (retire - age) * 12 - months since the last birthday (#4).
    paycheques: function (age, monthsSince, retire) {
      if (!has(age)) return null;
      var a = num(age), m = has(monthsSince) ? num(monthsSince) : 0, ra = has(retire) ? num(retire) : 65;
      if (!(ra >= 18 && ra <= 100 && Math.floor(ra) === ra)) return "retire";
      if (!(a > 16 && a < ra && Math.floor(a) === a)) return "age";
      if (!(m >= 0 && m <= 11 && Math.floor(m) === m)) return "months";
      return (ra - a) * 12 - m;
    },
    lifeRatio: function (savings, earnings) { return has(earnings) && num(earnings) > 0 ? 1 - num(savings) / num(earnings) : null; },
    // Earnings from now to the retirement birthday with pay rising `growth` % a year (year 1 = 12 x salary).
    // Returns { nominal: future riyals, today: the same in today's money (deflated by `inflation` %), years }.
    futureEarnings: function (age, salary, growth, retire, inflation) {
      if (!has(age) || !has(salary)) return null;
      var ra = pctIn(retire, ASSUME.retire), g = pctIn(growth, ASSUME.payGrowth) / 100, inf = pctIn(inflation, ASSUME.inflation) / 100;
      if (!(ra >= 18 && ra <= 100 && Math.floor(ra) === ra)) return "retire"; // whole ages, as in paycheques
      if (!(num(age) >= 0 && num(age) < ra)) return "age";
      if (!(g > -1) || !(inf > -1)) return "rate";
      var n = ra - num(age), y1 = num(salary) * 12;
      var series = function (q) { return Math.abs(q - 1) < 1e-12 ? n : Math.expm1(n * Math.log(q)) / (q - 1); }; // 1 + q + ... + q^(n-1)
      return { nominal: y1 * series(1 + g), today: y1 * series((1 + g) / (1 + inf)), years: n };
    },
    rule72: function (rate) {
      if (!has(rate)) return null;
      return num(rate) > 0 ? shown(72 / num(rate)) : "nodouble";
    },
    effAnnual: function (monthly, daily) {
      var v = has(monthly) ? [monthly, 12] : has(daily) ? [daily, 365] : null;
      if (!v) return null;
      if (!(num(v[0]) > -100)) return "rate";
      return shown(Math.expm1(v[1] * Math.log1p(num(v[0]) / 100)));
    },
    lumpSum: function (pv, rate, years) {
      if (!has(pv) || !has(years)) return null;
      if (badRate(rate)) return "rate";
      if (badYears(years)) return "years";
      return shown(num(pv) * growth(num(rate) / 100 / 12, 12 * num(years)));
    },
    monthlyFV: function (c, rate, years) {
      if (!has(c) || !has(years)) return null;
      if (badRate(rate)) return "rate";
      if (badYears(years)) return "years";
      return shown(num(c) * annuity(num(rate) / 100 / 12, 12 * num(years)));
    },
    investTarget: function (goal, current, rate, years, inflation) { // goal (today's money) grown by `inflation` % a year (#5)
      if (!has(goal) || !has(years)) return null;
      if (badRate(rate)) return "rate";
      if (badYears(years, true)) return "years";
      var inf = pctIn(inflation, ASSUME.inflation);
      if (!(inf > -100)) return "inflation";
      var r = num(rate) / 100 / 12, n = num(years) * 12, fv = num(goal) * growth(inf / 100, num(years)), cur = num(current);
      var p = (fv - cur * growth(r, n)) / annuity(r, n);
      return shown(Math.max(0, p));
    },
    car: function (o) {
      var f = ["repay", "insurance", "running", "months", "alt", "value", "settle", "later5", "later10"];
      if (!f.some(function (k) { return has(o[k]); })) return null;
      var monthly = num(o.repay) + num(o.insurance) + num(o.running), m = num(o.months), run = num(o.insurance) + num(o.running);
      var net = num(o.settle) - num(o.value);
      var keepFor = function (n) { var paying = Math.min(Math.max(0, m), n); return monthly * paying + run * (n - paying); };
      var r = {
        // each "N years" figure covers exactly N months on both sides (#6): repayments stop when the loan ends
        // optional: what the kept car is still worth after 5 / 10 years is credited to keeping (selling gets its value via net)
        keepX: monthly * m, keep5: keepFor(60) - num(o.later5), keep10: keepFor(120) - num(o.later10),
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
      var n = Number(am[1].replace(/,/g, "")), before = t.slice(0, am.index);
      // A minus right before the amount (optionally "QAR -400" or "-QAR 400") makes it a refund (#3).
      var neg = /(?:^|\s)[-\u2212](?:(?:qar|qr)\s*)?$/i.exec(before); // "-400", "QAR -400", "-QAR 400"; not "groceries - 400"
      if (neg) before = before.slice(0, neg.index);
      if (isFinite(n) && n > 0) amount = neg ? -n : n;
      t = before + " " + t.slice(am.index + am[0].length);
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
  function csvCell(v) { var s = String(v === undefined || v === null ? "" : v); if (/^-?\d+(\.\d+)?$/.test(s)) return s; /* plain numbers (refunds are negative) need no formula guard */ return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"' : s; }
  function txToCSV(state) {
    var gm = groupMap(state);
    var lines = ["date,amount,category,group,paid_from,note"];
    state.transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      lines.push([t.date, String(num(t.amount)), t.category, gm[t.category] || "Other", t.paidFrom, t.note].map(csvCell).join(","));
    });
    return lines.join("\n") + "\n";
  }
  /* Returns {rows: [tx], skipped: n, negatives: n, newCategories: [names]} without touching state.
     A minus means a refund only in Money's own export (its exact header). In other CSVs, such as bank statements,
     a minus usually means money out, so those rows are skipped and counted in `negatives` (never imported as refunds). */
  var CSV_HEAD = "date,amount,category,group,paid_from,note";
  function csvToTx(text, state) {
    var rows = parseCSV(text);
    if (!rows.length) return { rows: [], skipped: 0, newCategories: [] };
    var head = rows[0].map(function (h) { return h.trim().toLowerCase().replace(/[^a-z]/g, ""); });
    var col = function (names) { for (var i = 0; i < head.length; i++) for (var j = 0; j < names.length; j++) if (head[i].indexOf(names[j]) === 0) return i; return -1; };
    var ci = { date: col(["date"]), amount: col(["amount"]), cat: col(["category"]), paid: col(["paidfrom", "account"]), note: col(["note", "description"]) };
    var own = rows[0].map(function (h) { return String(h).replace(/^\uFEFF/, "").trim().toLowerCase(); }).join(",") === CSV_HEAD;
    var body = rows.slice(1);
    if (ci.date < 0 || ci.amount < 0) { ci = { date: 0, amount: 1, cat: 2, paid: 3, note: 4 }; body = rows; }
    var known = dict(); state.categories.forEach(function (c) { known[c.name] = 1; });
    var out = [], skipped = 0, negatives = 0, added = [];
    body.forEach(function (r) {
      var g = function (i) { return i >= 0 ? String(r[i] === undefined ? "" : r[i]).trim().replace(/^'(?=[=+\-@])/, "") : ""; };
      var date = parseDate(g(ci.date)), amount = num(g(ci.amount));
      if (!date || !amount) { skipped += 1; return; } // zero is skipped
      if (amount < 0 && !own) { negatives += 1; return; } // negative = refund (#3), but only in Money's own CSV
      var cat = g(ci.cat) || "Uncategorised";
      if (!known[cat]) { known[cat] = 1; added.push(cat); }
      out.push({ id: uid("t"), date: date, amount: amount, category: cat, paidFrom: g(ci.paid), note: g(ci.note) });
    });
    return { rows: out, skipped: skipped, negatives: negatives, newCategories: added };
  }

  /* ---------- JSON backup ---------- */
  function str(v) { return v === undefined || v === null ? "" : String(v); }
  function amt(v) { return has(v) ? String(num(v)) : ""; }
  /* Lenient: repairs what it can and counts what it had to drop in `report.dropped` (if given). */
  function normalize(o, report) {
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("This file is not a Money app backup.");
    var dropped = { transactions: 0, categories: 0, accounts: 0, goals: 0, reviewSteps: 0 };
    var keep = function (kind) { return function (x) { if (x) return true; dropped[kind] += 1; return false; }; };
    if (o.app !== undefined && o.app !== "money") throw new Error("This file is not a Money app backup.");
    var d = defaultState(), ids = Object.create(null), stepMap = Object.create(null), keptStep = Object.create(null);
    var arr = function (v) { return Array.isArray(v) ? v : []; };
    // Ids are opaque, safe tokens: anything else (quotes, angle brackets, colons, over-long) is regenerated.
    var fresh = function (id, p) { var s = str(id); if (!SAFE_ID.test(s) || ids[s]) s = uid(p); ids[s] = 1; return s; };
    var s = {
      app: "money", format: FORMAT,
      settings: { currency: "QAR", groupTypes: dict(), startDay: o.settings && has(o.settings.startDay) && num(o.settings.startDay) >= 1 && num(o.settings.startDay) <= 31 ? String(Math.floor(num(o.settings.startDay))) : "" },
      categories: Array.isArray(o.categories) ? o.categories.filter(function (c) { return keep("categories")(c && typeof c === "object" && str(c.name).trim()); }).map(function (c) {
        return { id: fresh(c.id, "c"), group: str(c.group).trim() || "Other", name: str(c.name).trim(), budget: amt(c.budget), debt: c.debt === true };
      }) : d.categories,
      transactions: arr(o.transactions).map(function (t) {
        var date = t && parseDate(t.date);
        if (!date || !num(t.amount)) return null; // negative = refund against the category (#3)
        return { id: fresh(t.id, "t"), date: date, amount: num(t.amount), category: str(t.category).trim() || "Uncategorised", paidFrom: str(t.paidFrom).trim(), note: str(t.note).trim() };
      }).filter(keep("transactions")),
      accounts: arr(o.accounts).filter(function (a) { return keep("accounts")(a && typeof a === "object"); }).map(function (a) {
        return { id: fresh(a.id, "a"), name: str(a.name), type: a.type === "Debt" ? "Debt" : "Asset", balance: amt(a.balance) };
      }),
      goals: Array.isArray(o.goals) ? o.goals.filter(function (g) { return keep("goals")(g && typeof g === "object"); }).map(function (g) {
        return { id: fresh(g.id, "g"), name: str(g.name), current: amt(g.current), target: amt(g.target), monthly: amt(g.monthly) };
      }) : d.goals,
      reviewSteps: Array.isArray(o.reviewSteps) && o.reviewSteps.length ? o.reviewSteps.filter(function (r) { return keep("reviewSteps")(r && typeof r === "object" && str(r.text).trim()); }).map(function (r) {
        var id = fresh(r.id, "r"), was = str(r.id);
        if (id === was) keptStep[was] = 1; // keep ticks pointing at a regenerated step id, but never move a tick off a step that kept its id
        else if (!keptStep[was] && !(was in stepMap)) stepMap[was] = id;
        return { id: id, text: str(r.text) };
      }) : d.reviewSteps,
      review: {},
      calc: {}
    };
    if (o.review && typeof o.review === "object") Object.keys(o.review).forEach(function (k) {
      if (!/^\d{4}-\d{2}$/.test(k) || !o.review[k] || typeof o.review[k] !== "object") return;
      var m = Object.create(null); Object.keys(o.review[k]).forEach(function (id) {
        if (o.review[k][id] !== true) return;
        var to = Object.prototype.hasOwnProperty.call(stepMap, id) ? stepMap[id] : id;
        if (SAFE_ID.test(to)) m[to] = true;
      });
      s.review[k] = m;
    });
    var gt = o.settings && o.settings.groupTypes;
    if (gt && typeof gt === "object" && !Array.isArray(gt)) Object.keys(gt).forEach(function (g) {
      if (g.trim() && g.length <= 80 && GROUP_TYPES.indexOf(gt[g]) >= 0 && !isIncome(g)) s.settings.groupTypes[g] = gt[g];
    });
    var fmt = typeof o.format === "number" ? o.format : 1;
    // Format 1 -> 2 (#2): "Money sent home" was in Transfers, which is now neutral. It is real money leaving,
    // so it moves to its own group (counted as spending unless the user changes that group's type).
    if (fmt < 2) s.categories.forEach(function (c) {
      if (c.group === "Transfers" && c.name === "Money sent home") c.group = "Family & remittances";
    });
    // Format 2 -> 3 (#3): refunds are now negative amounts against their category, so the default income
    // category is just "Paybacks" (money owed to you coming back). Existing entries keep their amounts.
    if (fmt < 3 && !s.categories.some(function (c) { return c.name === "Paybacks"; })) s.categories.forEach(function (c) {
      if (c.name === "Refunds and paybacks" && isIncome(c.group)) {
        c.name = "Paybacks";
        s.transactions.forEach(function (t) { if (t.category === "Refunds and paybacks") t.category = "Paybacks"; });
      }
    });
    if (o.calc && typeof o.calc === "object") Object.keys(o.calc).forEach(function (k) { if (/^[a-zA-Z0-9]+$/.test(k)) s.calc[k] = str(o.calc[k]).slice(0, 30); });
    // Format 3 -> 4 (#5): v1 fixed 6% inflation (investment target) and 7% pay rises (future earnings).
    // Someone who already filled those calculators keeps those assumptions, now visible and editable.
    if (fmt < 4) {
      var filled = function (ks) { return ks.some(function (k) { return has(s.calc[k]); }); };
      if (filled(["tgoal", "tcur", "trate", "tyears"]) && !has(s.calc.tinf)) s.calc.tinf = "6";
      if (filled(["fage", "fsal"]) && !has(s.calc.fgrow)) s.calc.fgrow = "7";
    }
    // Format 4 -> 5 (#30): debt repayment was "category name starts with Debt"; it is now a per-category flag.
    // Older data gets the flag from that rule, so its totals don't change; after that, renaming keeps the flag.
    if (fmt < 5) s.categories.forEach(function (c) { c.debt = defaultDebt(c.name); });
    if (report) report.dropped = dropped;
    return s;
  }
  /* Strict envelope check for a backup that is about to replace everything (#9). */
  function checkBackup(o) {
    if (!o || typeof o !== "object" || Array.isArray(o) || o.app !== "money") throw new Error("This file is not a Money app backup.");
    if (typeof o.format !== "number" || Math.floor(o.format) !== o.format || o.format < 1) throw new Error("This file is not a Money app backup (it has no valid format number).");
    if (o.format > FORMAT) throw new Error("This backup was made by a newer version of the Money app (format " + o.format + "). Reload the app while online to update it, then import again. Nothing was changed.");
    if (SUPPORTED_FORMATS.indexOf(o.format) < 0) throw new Error("This backup format (" + o.format + ") isn't supported. Nothing was changed.");
    if (!Array.isArray(o.transactions) || !Array.isArray(o.categories)) throw new Error("This backup is incomplete (no transactions or categories list). Nothing was changed.");
  }
  /* Parse + check + normalize. Returns {state, counts, dropped, droppedTotal}. Throws with a user-facing message. */
  function readBackup(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error("This file is not valid JSON."); }
    checkBackup(o);
    var report = {}, state = normalize(o, report), d = report.dropped;
    try { selfCheck(state); } catch (e) { throw new Error("This backup couldn't be read safely, so nothing was changed."); } // #12
    return {
      state: state, dropped: d, droppedTotal: d.transactions + d.categories + d.accounts + d.goals + d.reviewSteps,
      counts: { transactions: state.transactions.length, categories: state.categories.length, accounts: state.accounts.length, goals: state.goals.length }
    };
  }
  /* Read what this app saved on the device (#10). Never throws. `problem` is null when the saved data is
     healthy, otherwise a short reason; the caller must then keep the raw text safe before saving anything.
     `newer` is set (to the saved format) when a newer version of the app saved it: open read-only and never save (#28). */
  function readStored(raw) {
    if (raw === null || raw === undefined) return { state: defaultState(), problem: null };
    var o;
    try { o = JSON.parse(raw); } catch (e) { return { state: defaultState(), problem: "it isn't readable (damaged JSON)" }; }
    if (!o || typeof o !== "object" || Array.isArray(o) || (o.app !== undefined && o.app !== "money")) return { state: defaultState(), problem: "it isn't Money app data" };
    // #28: data saved by a newer version (an old cached app is running). Show what can be read, but the caller
    // must not save over it: re-saving it in this version's older shape would silently drop fields it doesn't know.
    if (typeof o.format === "number" && o.format > FORMAT) {
      var shown = defaultState();
      try { var n = normalize(o); selfCheck(n); shown = n; } catch (e) { /* show a blank app; the raw data stays untouched */ }
      return { state: shown, problem: "it was saved by a newer version of Money (format " + o.format + ")", newer: o.format };
    }
    var report = {}, st;
    try { st = normalize(o, report); } catch (e) { return { state: defaultState(), problem: "it couldn't be read" }; }
    try { selfCheck(st); } catch (e) { return { state: defaultState(), problem: "it couldn't be shown safely" }; } // #12
    var bad = ["transactions", "categories"].filter(function (k) { return !Array.isArray(o[k]); })
      .concat(["accounts", "goals", "reviewSteps"].filter(function (k) { return o[k] !== undefined && !Array.isArray(o[k]); }));
    if (bad.length) return { state: st, problem: "part of it is missing or damaged (" + bad.join(", ") + ")" };
    var d = report.dropped, n = d.transactions + d.categories + d.accounts + d.goals + d.reviewSteps;
    if (n) return { state: st, problem: n + " damaged record" + (n === 1 ? "" : "s") + " couldn't be read" };
    return { state: st, problem: null };
  }
  /* Run every screen's maths on a candidate state; throws if anything fails or isn't finite (#12).
     Used before an import is committed and when saved data is loaded. */
  function selfCheck(state, today) {
    var bad = function (v, path) {
      if (typeof v === "number" && !isFinite(v)) throw new Error("Calculation check failed (" + path + ").");
      if (v && typeof v === "object") Object.keys(v).forEach(function (k) { bad(v[k], path + "." + k); });
    };
    monthKeys(state, today || isoOf(new Date())).forEach(function (k) { bad(totals(state, k), "totals"); bad(budgetStats(state, k), "budget"); });
    bad(netWorth(state.accounts), "netWorth");
    state.goals.forEach(function (g, i) { bad(goalStats(g), "goals." + i); }); // #29
    txToCSV(state); toBackup(state);
    return true;
  }
  function toBackup(state, now) {
    var o = JSON.parse(JSON.stringify(state));
    o.app = "money"; o.format = FORMAT; o.exportedAt = (now || new Date()).toISOString();
    return JSON.stringify(o, null, 2);
  }
  function fromBackup(text) { return readBackup(text).state; }

  var api = {
    ASSUME: ASSUME, MON: MON, NEAR: NEAR, DASH: DASH, SAFE_ID: SAFE_ID, DEFAULT_GROUPS: DEFAULT_GROUPS,
    num: num, has: has, safe: safe, fmt: fmt, qar: qar, qar2: qar2, pct: pct,
    iso: iso, isoOf: isoOf, parseDate: parseDate, daysIn: daysIn, startDay: startDay, startOn: startOn, keyOf: keyOf, shiftKey: shiftKey,
    moneyMonth: moneyMonth, monthRange: monthRange, monthLabel: monthLabel, nice: nice,
    uid: uid, defaultState: defaultState, isIncome: isIncome, isFreedom: isFreedom, groupMap: groupMap, groupType: groupType, GROUP_TYPES: GROUP_TYPES,
    txIn: txIn, totals: totals, status: status, budgetStats: budgetStats, monthKeys: monthKeys, netWorth: netWorth, goalStats: goalStats, MAX_GOAL_MONTHS: MAX_GOAL_MONTHS,
    calc: calc, matchCat: matchCat, parseQuick: parseQuick,
    parseCSV: parseCSV, txToCSV: txToCSV, csvToTx: csvToTx, normalize: normalize, toBackup: toBackup, fromBackup: fromBackup, readBackup: readBackup, checkBackup: checkBackup, FORMAT: FORMAT, readStored: readStored, selfCheck: selfCheck
  };
  api.defaultDebt = defaultDebt; // #30
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Money = api;
})(typeof self !== "undefined" ? self : this);
