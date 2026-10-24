/* Money app UI. All data stays on this device in localStorage; Backup exports and imports JSON/CSV. */
(function () {
  "use strict";
  var M = window.Money;
  var KEY = "money-app-v1", UNDO_KEY = KEY + "-before-import", REC_KEY = KEY + "-recovery";
  var TABS = [["home", "Home"], ["budget", "Budget"], ["spend", "Spending"], ["worth", "Net worth"], ["tools", "Tools"]];
  var S, storageOk = true, readOnly = false, problem = "", newer = 0; // newer: format of data saved by a newer app version (#28)
  var U = { tab: "home", sel: "", onlyActive: false, editTx: null, form: { qa: "", cat: "", paid: "", date: "" }, msg: "" };

  function hasUndo() { try { return !!localStorage.getItem(UNDO_KEY); } catch (e) { return false; } }
  function today() { return M.isoOf(new Date()); }
  /* Damaged saved data is copied, byte for byte, to a recovery slot before anything can overwrite it (#10). */
  function recKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k === REC_KEY || (k && k.indexOf(REC_KEY + "-") === 0)) out.push(k); } } catch (e) { /* ignore */ }
    return out.sort();
  }
  function quarantine(raw) {
    var ks = recKeys();
    for (var i = 0; i < ks.length; i++) { try { if (localStorage.getItem(ks[i]) === raw) return true; } catch (e) { return false; } }
    try { localStorage.setItem(ks.length ? REC_KEY + "-" + Date.now() : REC_KEY, raw); return true; } catch (e) { return false; }
  }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    var r = M.readStored(raw);
    S = r.state;
    var wasNewer = newer; newer = r.newer || 0;
    if (newer) { problem = r.problem; readOnly = true; } // #28: never write, so the newer data stays exactly as it is
    else {
      if (wasNewer) { readOnly = false; problem = ""; } // the newer data was replaced (e.g. by an updated tab)
      if (r.problem) {
        problem = r.problem;
        readOnly = !quarantine(raw);
      } else if (!readOnly) problem = "";
    }
    try { var t = localStorage.getItem(KEY + "-tab"); if (t && TABS.some(function (x) { return x[0] === t; })) U.tab = t; } catch (e) { /* ignore */ }
  }
  function save() {
    if (newer) { toast(NEWER_MSG + " Nothing is saved until then."); return; }
    if (readOnly) { toast("Saving is paused so your damaged saved data isn't overwritten. Download it first (see the box at the top)."); return; }
    try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }
    catch (e) { storageOk = false; toast("Couldn't save on this device (storage full or blocked). Export a backup now."); }
  }
  // Erase removes every money key on this device (undo copy, damaged-data copies, last tab), not just the main save.
  function wipeOtherKeys() {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k !== KEY && k.indexOf(KEY + "-") === 0) localStorage.removeItem(k); } } catch (e) { /* ignore */ }
  }
  var NEWER_MSG = "This data was saved by a newer version of Money. Reload while online to update.";
  function rawSaved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function recoveryBox() {
    if (newer) return '<section class="card recovery" aria-labelledby="rec-h"><h2 id="rec-h">Update Money to use your data</h2><p>' + h(NEWER_MSG) +
      " Until then the app is read-only and saves nothing, so your newer data stays exactly as it is.</p>" +
      '<div class="row">' + btn("Reload", "reload", undefined, "primary") + btn("Download saved data", "newerdownload") + "</div></section>";
    var ks = recKeys();
    if (!readOnly && !ks.length) return "";
    var why = problem ? "Your saved data on this device was damaged: " + problem + ". " : "A copy of damaged saved data is being kept on this device. ";
    var what = readOnly
      ? "There wasn't room to keep a safe copy of it, so <strong>saving is paused</strong> to avoid overwriting it. Download it now, then choose Start fresh to carry on."
      : "The original was kept safe, unchanged, before anything was saved" + (S.transactions.length ? ", and what could be read is shown below." : ". The app is showing a fresh start.") + " Download the damaged copy and keep it, then delete it here when you no longer need it.";
    return '<section class="card recovery" aria-labelledby="rec-h"><h2 id="rec-h">Saved data needs attention</h2><p>' + h(why) + what + "</p>" +
      '<div class="row">' + btn("Download damaged data", "recdownload", undefined, "primary") + btn("Export current data", "exportjson") +
      btn("Start fresh", "recfresh") + (ks.length ? btn("Delete damaged copy", "recdelete", undefined, "danger") : "") + "</div></section>";
  }
  function commit() { save(); render(); }

  /* ---------- helpers ---------- */
  function h(v) { return String(v === undefined || v === null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var D = M.DASH;
  var toastTimer = null;
  function toast(t) {
    var el = document.getElementById("toast"); if (!el) return;
    el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }
  function sd() { return S.settings.startDay; }
  function curKey() { return M.moneyMonth(today(), sd()); }
  function selKey() { return /^\d{4}-\d{2}$/.test(U.sel) ? U.sel : curKey(); }
  // #7: row title for accessible names. Unnamed rows get "Account 2" etc.; a repeated name gets its number too.
  function rowName(list, i, kind) {
    var n = String(list[i].name || "").trim();
    if (!n) return kind + " " + (i + 1);
    return list.filter(function (x) { return String(x.name || "").trim() === n; }).length > 1 ? n + " (" + kind.toLowerCase() + " " + (i + 1) + ")" : n;
  }
  function catNames() { return S.categories.map(function (c) { return c.name; }); }
  function field(id, label, value, opts) {
    opts = opts || {};
    return '<label class="field' + (opts.cls ? " " + opts.cls : "") + '" for="' + h(id) + '"><span>' + h(label) + '</span>' +
      '<input id="' + h(id) + '" ' + (opts.money ? 'inputmode="decimal" autocomplete="off" ' : "") + (opts.type ? 'type="' + opts.type + '" ' : 'type="text" ') +
      'value="' + h(value) + '" placeholder="' + h(opts.ph || "") + '" ' + (opts.aria ? 'aria-label="' + h(opts.aria) + '" ' : "") + (opts.bind ? 'data-bind="' + h(opts.bind) + '"' : "") + (opts.attrs || "") + '></label>';
  }
  function select(id, label, options, value, bind, hideLabel, aria) {
    return '<label class="field" for="' + h(id) + '"><span' + (hideLabel ? ' class="sr"' : "") + '>' + h(label) + '</span><select id="' + h(id) + '" data-bind="' + h(bind) + '"' + (aria ? ' aria-label="' + h(aria) + '"' : "") + '>' +
      options.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + h(v) + '"' + (v === value ? " selected" : "") + ">" + h(l) + "</option>"; }).join("") +
      "</select></label>";
  }
  function btn(label, act, arg, cls, extra) { return '<button type="button" class="btn' + (cls ? " " + cls : "") + '" data-act="' + act + '"' + (arg !== undefined ? ' data-arg="' + h(arg) + '"' : "") + (extra || "") + ">" + label + "</button>"; }
  var STATUS = { over: ["Over", "bad"], near: ["Near budget", "warn"], ok: ["On track", "good"], nobudget: ["No budget", "muted"], none: ["", ""] };
  function meter(c, label) {
    if (!(c.budget > 0)) return '<div class="meter-none">' + (c.spent > 0 ? "No budget set" : "No budget") + "</div>";
    var w = Math.max(0, Math.min(100, Math.round(M.safe(c.ratio) * 100)));
    return '<div class="meter ' + c.status + '" role="progressbar" aria-label="' + h(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.max(0, Math.round(M.safe(c.ratio) * 100)) + '" aria-valuetext="' + M.pct(c.ratio, 0) + ' of budget, ' + h(STATUS[c.status][0]) + '"><i style="width:' + w + '%"></i></div>';
  }
  function chip(st, extra) { var s = STATUS[st]; return s && s[0] ? '<span class="chip ' + s[1] + '">' + s[0] + (extra || "") + "</span>" : ""; }
  function money(n) { return M.qar2(n); }
  function monthPicker() {
    var sel = selKey(), cur = curKey(), keys = M.monthKeys(S, today());
    if (keys.indexOf(sel) < 0) { keys.push(sel); keys.sort(); }
    return '<div class="picker">' + btn("&#8249;", "month", "-1", "icon", ' aria-label="Previous money month"') +
      select("month-sel", "Money month", keys.map(function (k) { return [k, M.monthLabel(k, sd()) + (k === cur ? " (now)" : "")]; }), sel, "month", true) +
      btn("&#8250;", "month", "1", "icon", ' aria-label="Next money month"') + "</div>";
  }

  /* ---------- screens ---------- */
  function home() {
    var k = selKey(), t = M.totals(S, k), b = M.budgetStats(S, k), nw = M.netWorth(S.accounts), label = M.monthLabel(k, sd());
    var any = t.inc > 0 || t.out > 0 || b.hasBudget;
    var intro = any
      ? label + ": " + M.qar(b.budgeted) + " budgeted, " + M.qar(t.out) + " paid out" + (b.hasBudget ? ", " + M.qar(Math.abs(b.left)) + (b.left < 0 ? " over budget" : " left in budget") : "") +
        (b.overCount ? ". " + b.overCount + (b.overCount === 1 ? " category is" : " categories are") + " over budget." : ".")
      : "Nothing for " + label + " yet. Set monthly budgets on the Budget tab and add spending on the Spending tab.";
    var cards = [
      ["Budgeted", b.hasBudget ? M.qar(b.budgeted) : D, "Money out planned", ""],
      ["Paid out", M.qar(t.out), "Everything except income and transfers", ""],
      [b.left < 0 ? "Over budget" : "Left in budget", b.hasBudget ? M.qar(Math.abs(b.left)) : D, "Budgeted minus paid out", b.hasBudget ? (b.overallStatus === "over" ? "bad" : b.overallStatus === "near" ? "warn" : "") : ""],
      ["Spending ratio", t.hasRatio ? M.pct(t.ratio) : D, "Spending groups \u00f7 money in", t.ratio > 0.8 ? "warn" : ""]
    ];
    var groups = b.groups.filter(function (g) { return g.type !== "transfer" && (g.total.budget > 0 || g.total.spent > 0); });
    var keys = M.monthKeys(S, today()).slice(-6), hist = keys.map(function (x) { return { k: x, t: M.totals(S, x) }; });
    var maxH = Math.max.apply(null, hist.map(function (x) { return Math.max(x.t.inc, x.t.out); }).concat([0]));
    var done = S.review[k] || {}, nd = S.reviewSteps.filter(function (r) { return done[r.id]; }).length;
    return '<section aria-labelledby="h-home"><div class="head"><h1 id="h-home">Overview</h1>' + monthPicker() + "</div>" +
      '<p class="lead">' + h(intro) + "</p>" +
      '<div class="metrics">' + cards.map(function (c) { return '<div class="metric ' + c[3] + '"><div class="mv">' + h(c[1]) + '</div><div class="ml">' + h(c[0]) + '</div><div class="md">' + h(c[2]) + "</div></div>"; }).join("") + "</div>" +
      '<dl class="props">' +
      [["Money in", money(t.inc) + (b.expectedIncome > 0 ? " of " + money(b.expectedIncome) + " expected" : "")],
       ["Left over (money in \u2212 paid out)", any ? money(t.left) : D], ["Saved and invested", money(t.saved)], ["Debt repaid", money(t.debt)]]
        .concat(t.other > 0 ? [["Other money out (not spending)", money(t.other)]] : []).concat(t.transfers > 0 ? [["Transfers between your accounts (not counted)", money(t.transfers)]] : []).concat([["Net worth", money(nw.net)]])
        .map(function (p) { return "<div><dt>" + h(p[0]) + "</dt><dd>" + h(p[1]) + "</dd></div>"; }).join("") + "</dl>" +
      '<h2>Spending by group</h2>' +
      (groups.length ? '<ul class="bars">' + groups.map(function (g) {
        return '<li><div class="bl"><span>' + h(g.group) + '</span><span>' + money(g.total.spent) + (g.total.budget > 0 ? " of " + money(g.total.budget) : "") + "</span></div>" + meter(g.total, g.group) + "</li>";
      }).join("") + "</ul>" : '<p class="empty">Budgets and spending by group will show here.</p>') +
      '<h2>Money in vs paid out</h2>' +
      (maxH > 0 ? '<ul class="hist">' + hist.map(function (x) {
        return '<li><span class="hl">' + h(M.monthLabel(x.k, sd())) + '</span><span class="hb"><i class="in" style="width:' + Math.max(0, Math.round(x.t.inc / maxH * 100)) + '%"></i></span><span class="hv">In ' + M.qar(x.t.inc) + '</span><span class="hb"><i class="out" style="width:' + Math.max(0, Math.round(x.t.out / maxH * 100)) + '%"></i></span><span class="hv">Out ' + M.qar(x.t.out) + "</span></li>";
      }).join("") + "</ul>" : '<p class="empty">Once you add transactions you will see money in and paid out for each money month.</p>') +
      '<h2 id="h-review">Monthly money review</h2><p class="hint">Do this on payday, at the start of each money month. ' + nd + " of " + S.reviewSteps.length + " done for " + h(label) + ".</p>" +
      '<ul class="check" aria-labelledby="h-review">' + S.reviewSteps.map(function (r) {
        return '<li><label><input type="checkbox" data-bind="review:' + h(r.id) + '"' + (done[r.id] ? " checked" : "") + "><span>" + h(r.text) + "</span></label></li>";
      }).join("") + "</ul></section>";
  }

  // #30: in a saving group, each category says whether it counts as debt repaid (renaming doesn't change it)
  function debtBox(c) {
    var cat = find(S.categories, c.id); if (!cat) return "";
    return '<label class="toggle debt"><input type="checkbox" data-bind="debt:' + h(c.id) + '"' + (cat.debt === true ? " checked" : "") + ' aria-label="' + h(c.name) + ' counts as debt repaid"><span>Counts as debt repaid</span></label>';
  }
  var GT_OPTS = [["spending", "Spending: paid out and in the spending ratio"], ["saving", "Saving or debt: paid out, not spending"], ["outflow", "Other money out: paid out, not spending"], ["transfer", "Transfer between my accounts: not counted"]];
  function budget() {
    var k = selKey(), b = M.budgetStats(S, k);
    var row = function (c, isTotal, gtype) {
      if (!isTotal && U.onlyActive && !(c.budget > 0) && !(c.spent > 0)) return "";
      var bid = h("b-" + (c.id || "x"));
      return '<li class="brow' + (isTotal ? " total" : "") + '"><div class="bt"><span class="bn">' + h(c.name) + "</span>" + chip(c.status, c.status === "over" ? " by " + M.qar(c.spent - c.budget) : "") + "</div>" +
        '<div class="bg">' + (isTotal || !c.id ? '<div class="bv"><span>Budget</span><b>' + (c.budget > 0 ? money(c.budget) : D) + "</b></div>"
          : '<label class="bv" for="' + bid + '"><span>Budget</span><input id="' + bid + '" aria-label="' + h(c.name + " budget") + '" inputmode="decimal" autocomplete="off" placeholder="0" value="' + h(S.categories.filter(function (x) { return x.id === c.id; })[0].budget) + '" data-bind="budget:' + h(c.id) + '"></label>') +
        '<div class="bv"><span>Spent</span><b>' + money(c.spent) + '</b></div><div class="bv"><span>Left</span><b class="' + (c.budget > 0 && c.left < 0 ? "neg" : "") + '">' + (c.budget > 0 ? money(c.left) : D) + "</b></div></div>" +
        meter(c, c.name) + (!isTotal && c.id && gtype === "saving" ? debtBox(c) : "") + (!isTotal && c.id ? btn("Remove", "delcat", c.id, "link small", ' aria-label="Remove category ' + h(c.name) + '"') : "") + "</li>";
    };
    var groupOpts = M.DEFAULT_GROUPS.concat(S.categories.map(function (c) { return c.group; })).filter(function (g, i, a) { return a.indexOf(g) === i; });
    return '<section aria-labelledby="h-budget"><div class="head"><h1 id="h-budget">Budget vs actual</h1>' + monthPicker() + "</div>" +
      '<p class="lead">' + (b.hasBudget ? M.qar(b.budgeted) + " budgeted, " + M.qar(b.paidOut) + " paid out, " + M.qar(Math.abs(b.left)) + (b.left < 0 ? " over." : " left.") : "Type a monthly budget for each category you plan to spend on. Bars turn amber from 85% of budget and red once over.") + "</p>" +
      '<label class="toggle"><input type="checkbox" data-bind="onlyActive"' + (U.onlyActive ? " checked" : "") + "><span>Only show categories with a budget or spending</span></label>" +
      b.groups.map(function (g, i) { return '<h2>' + h(g.group) + '</h2>' + select("gt-" + i, "How " + g.group + " counts", GT_OPTS, g.type, "gtype:" + encodeURIComponent(g.group)) +
        (g.type === "transfer" ? '<p class="hint">Moving your own money between accounts. Not counted in paid out, budgeted, left over or the spending ratio.</p>' : "") + '<ul class="blist">' + g.cats.map(function (c) { return row(c, false, g.type); }).join("") + row(g.total, true) + "</ul>"; }).join("") +
      '<h2>Income</h2><p class="hint">Expected income for the month. It is not counted as spending. Paybacks are money owed to you coming back (e.g. a friend repaying a loan). A shop refund isn\u2019t income: add it as a minus amount against the category it refunds.</p><ul class="blist">' + b.income.map(function (c) {
        if (U.onlyActive && !(c.budget > 0) && !(c.spent > 0)) return "";
        var bid = h("b-" + c.id);
        return '<li class="brow"><div class="bt"><span class="bn">' + h(c.name) + '</span></div><div class="bg"><label class="bv" for="' + bid + '"><span>Expected</span><input id="' + bid + '" aria-label="' + h(c.name + " expected") + '" inputmode="decimal" autocomplete="off" placeholder="0" value="' + h(S.categories.filter(function (x) { return x.id === c.id; })[0].budget) + '" data-bind="budget:' + h(c.id) + '"></label><div class="bv"><span>Received</span><b>' + money(c.spent) + "</b></div></div>" + btn("Remove", "delcat", c.id, "link small", ' aria-label="Remove category ' + h(c.name) + '"') + "</li>";
      }).join("") + "</ul>" +
      '<h2>Add a category</h2><div class="row">' + select("nc-group", "Group", groupOpts, groupOpts[4] || groupOpts[0], "ncGroup") + field("nc-name", "Category name", "", { ph: "e.g. School fees", bind: "ncName" }) + "</div>" + btn("Add category", "addcat", undefined, "primary") +
      "</section>";
  }

  function quickPreview() {
    var f = U.form, p = M.parseQuick(f.qa), auto = M.matchCat(p.catText, catNames()), cat = f.cat || auto || p.catText, date = M.parseDate(f.date || today());
    if (!f.qa.trim()) return { ready: false, text: "Type an amount and a category, e.g. \u201cQAR 85 groceries\u201d or \u201c120 eating out - lunch\u201d. For a refund, put a minus before the amount: \u201c-400 groceries - refund\u201d." };
    if (p.amount === null) return { ready: false, text: "Add an amount, e.g. 85." };
    if (!cat) return { ready: false, text: "Add a category word or pick one from the list." };
    if (!date) return { ready: false, text: "Enter the date as YYYY-MM-DD." };
    var gm = M.groupMap(S);
    return { ready: true, amount: p.amount, cat: cat, note: p.note, date: date, auto: auto,
      text: (p.amount < 0 ? "Refund of " + money(-p.amount) + " against " : "Adds " + money(p.amount) + " to ") + cat + (gm[cat] ? " (" + gm[cat] + ")" : " (new category, counted under Other)") + (p.note ? ", note \u201c" + p.note + "\u201d" : "") + ", on " + M.nice(date, true) + "." + (p.amount < 0 ? " It counts in the money month of that date." : "") };
  }
  function spend() {
    var k = selKey(), list = M.txIn(S, k).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var pv = quickPreview(), gm = M.groupMap(S), names = catNames();
    var auto = M.matchCat(M.parseQuick(U.form.qa).catText, names);
    var paid = Object.create(null); list.forEach(function (t) { if (!M.isIncome(gm[t.category] || "")) { var n = t.paidFrom || "Not set"; paid[n] = (paid[n] || 0) + M.num(t.amount); } });
    var paidList = Object.keys(paid).sort(function (a, b) { return paid[b] - paid[a]; });
    var txRow = function (t) {
      if (U.editTx === t.id) {
        return '<li class="tx edit">' + field("e-amount", "Amount (QAR)", String(t.amount), { money: true, bind: "edit:amount" }) +
          select("e-cat", "Category", (names.indexOf(t.category) < 0 ? [t.category] : []).concat(names), t.category, "edit:category") +
          field("e-date", "Date", t.date, { type: "date", bind: "edit:date" }) + field("e-paid", "Paid from", t.paidFrom, { bind: "edit:paidFrom", ph: "Account" }) +
          field("e-note", "Note", t.note, { bind: "edit:note" }) + '<div class="row">' + btn("Done", "editdone", t.id, "primary") + btn("Delete", "deltx", t.id, "danger") + "</div></li>";
      }
      return '<li class="tx"><div><div class="tn">' + h(t.category) + '</div><div class="tm">' + h(M.nice(t.date, false)) + (t.paidFrom ? " \u00b7 " + h(t.paidFrom) : "") + (t.note ? " \u00b7 " + h(t.note) : "") + '</div></div><div class="ta' + (M.isIncome(gm[t.category] || "") ? " inc" : "") + '">' + money(t.amount) + "</div>" + btn("Edit", "edittx", t.id, "link small", ' aria-label="Edit ' + h(t.category) + " " + h(money(t.amount)) + '"') + "</li>";
    };
    return '<section aria-labelledby="h-spend"><div class="head"><h1 id="h-spend">Spending</h1>' + monthPicker() + "</div>" +
      '<div class="card"><h2 class="first">Quick add</h2>' +
      field("qa", "Amount, category and an optional note", U.form.qa, { ph: "QAR 85 groceries - weekly shop", bind: "qa", attrs: ' enterkeyhint="done" aria-describedby="qa-prev"' }) +
      '<div class="row">' + select("qa-cat", "Category", [["", auto ? "Auto: " + auto : "Auto (from what you typed)"]].concat(names.map(function (n) { return [n, n]; })), U.form.cat, "qaCat") +
      field("qa-paid", "Paid from (optional)", U.form.paid, { ph: "Account", bind: "qaPaid" }) + field("qa-date", "Date", U.form.date || today(), { type: "date", bind: "qaDate" }) + "</div>" +
      '<p id="qa-prev" class="hint" aria-live="polite">' + h(U.msg || pv.text) + "</p>" + btn("Add transaction", "quickadd", undefined, "primary", pv.ready ? "" : " disabled") + "</div>" +
      "<h2>" + h(M.monthLabel(k, sd())) + "</h2>" +
      (list.length ? '<ul class="txs">' + list.map(txRow).join("") + "</ul>" : '<p class="empty">No transactions in this money month yet.</p>') +
      (paidList.length ? '<h2>Paid from</h2><dl class="props">' + paidList.map(function (n) { return "<div><dt>" + h(n) + "</dt><dd>" + money(paid[n]) + "</dd></div>"; }).join("") + "</dl>" : "") +
      "</section>";
  }

  function worth() {
    var nw = M.netWorth(S.accounts);
    return '<section aria-labelledby="h-worth"><div class="head"><h1 id="h-worth">Accounts and net worth</h1></div>' +
      '<div class="metrics three"><div class="metric"><div class="mv">' + M.qar(nw.assets) + '</div><div class="ml">Assets</div></div><div class="metric"><div class="mv">' + M.qar(nw.debts) + '</div><div class="ml">Debts</div></div><div class="metric ' + (nw.net < 0 ? "bad" : "") + '"><div class="mv">' + M.qar(nw.net) + '</div><div class="ml">Net worth</div></div></div>' +
      (S.accounts.length ? '<ul class="items">' + S.accounts.map(function (a, ai) {
        var an = rowName(S.accounts, ai, "Account"); // #7: every repeated field names its row
        return '<li class="item">' + field("an-" + a.id, "Account name", a.name, { ph: "e.g. Current account", bind: "acc:" + a.id + ":name", aria: "Account name, account " + (ai + 1) }) +
          '<div class="row">' + select("at-" + a.id, "Type", [["Asset", "Asset"], ["Debt", "Debt (subtracted)"]], a.type, "acc:" + a.id + ":type", false, an + " type") +
          field("ab-" + a.id, "Balance (QAR)", a.balance, { money: true, ph: "0", bind: "acc:" + a.id + ":balance", aria: an + " balance (QAR)" }) + "</div>" + btn("Remove", "delacc", a.id, "link small", ' aria-label="Remove account ' + h(a.name || "unnamed") + '"') + "</li>";
      }).join("") + "</ul>" : '<p class="empty">No accounts yet. Add each bank account, savings pot, investment and debt with its balance.</p>') +
      btn("Add account", "addacc", undefined, "primary") +
      '<h2>Goals</h2>' + (S.goals.length ? '<ul class="items">' + S.goals.map(function (g, gi) {
        var st = M.goalStats(g);
        var ml = st.unreachable ? "not reachable at this rate (over 100 years)" : st.monthsLeft === null ? D : st.monthsLeft === 0 ? "Reached" : M.fmt(st.monthsLeft, 1) + " months";
        var gn = rowName(S.goals, gi, "Goal");
        return '<li class="item">' + field("gn-" + g.id, "Goal", g.name, { ph: "Goal name", bind: "goal:" + g.id + ":name", aria: "Goal " + (gi + 1) + " name" }) +
          '<div class="row">' + field("gc-" + g.id, "Current", g.current, { money: true, ph: "0", bind: "goal:" + g.id + ":current", aria: gn + " current" }) + field("gt-" + g.id, "Target", g.target, { money: true, ph: "0", bind: "goal:" + g.id + ":target", aria: gn + " target" }) +
          field("gm-" + g.id, "Monthly", g.monthly, { money: true, ph: "0", bind: "goal:" + g.id + ":monthly", aria: gn + " monthly" }) + "</div>" +
          '<div class="meter ok" role="progressbar" aria-label="' + h(g.name || "Goal") + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(st.progress * 100) + '"><i style="width:' + Math.round(st.progress * 100) + '%"></i></div>' +
          '<p class="hint">' + (st.hasTarget ? M.pct(st.progress, 0) + " \u00b7 " + money(st.togo) + " to go \u00b7 " + ml : "Set a target to see progress.") + "</p>" +
          btn("Remove", "delgoal", g.id, "link small", ' aria-label="Remove goal ' + h(g.name || "unnamed") + '"') + "</li>";
      }).join("") + "</ul>" : '<p class="empty">No goals yet.</p>') +
      '<div class="row">' + btn("Add goal", "addgoal", undefined, "primary") + btn("Table flip target = 3 \u00d7 emergency target", "flip") + "</div>" +
      '<p class="hint">Months left = still to go \u00f7 monthly contribution. For Debt-free, enter the debt you want to clear as the target.</p></section>';
  }

  var SIGNED = { rrate: 1, lrate: 1, mrate: 1, trate: 1 }; // calculator rates where a negative return makes sense
  var CALCS = [
    ["paycheques", "Remaining paycheques", "How many monthly paycheques you have left until the birthday you retire on, assuming no breaks.", [["age", "Current age", "e.g. 35"], ["msince", "Months since your last birthday (0\u201311)", "0\u201311"], ["rage", "Retirement age (blank = 65)", "65"]]],
    ["life", "Lifetime spending ratio", "The share of everything you have earned so far that you have spent.", [["lsav", "Total savings today (QAR)", "0"], ["learn", "Lifetime earnings so far (QAR)", "0"]]],
    ["future", "Future lifetime earnings", "What you might earn from now until you retire, with your pay rising each year. Shown in future riyals and in today's money.", [["fage", "Current age", "e.g. 35"], ["fsal", "Monthly salary after tax (QAR)", "0"], ["fgrow", "Pay rise each year % (blank = 4)", "4"], ["fret", "Retirement age (blank = 65)", "65"], ["finf", "Inflation each year % (blank = 3)", "3"]]],
    ["r72", "Rule of 72", "How many years it takes an investment to double.", [["rrate", "Annual interest rate %", "e.g. 6"]]],
    ["eff", "Effective annual cost", "Turns a monthly or daily interest rate into its yearly equivalent. Fill in one.", [["emon", "Monthly interest rate %", "0"], ["eday", "Or daily interest rate %", "0"]]],
    ["lump", "Lump sum growth", "What a lump sum grows to, compounding monthly.", [["lpv", "Amount invested now (QAR)", "0"], ["lrate", "Annual interest rate %", "0"], ["lyears", "Years", "0"]]],
    ["monthly", "Investing monthly", "What regular monthly investing grows to, compounding monthly.", [["mc", "Monthly contribution (QAR)", "0"], ["mrate", "Annual interest rate %", "0"], ["myears", "Years", "0"]]],
    ["target", "Investment target", "How much to invest each month to reach a goal set in today's money, allowing for inflation.", [["tgoal", "Goal amount, today's money (QAR)", "0"], ["tcur", "Current savings (QAR)", "0"], ["trate", "Annual interest rate %", "0"], ["tyears", "Years", "0"], ["tinf", "Inflation each year % (blank = 3)", "3"]]],
    ["car", "Keep or sell the car", "Compares keeping your car with selling it and using other transport. Each column covers the same months for both; loan repayments stop when the loan ends. Add what the car might still be worth later to credit it to keeping.", [["crepay", "Car repayment / month", "0"], ["cins", "Car insurance / month", "0"], ["crun", "Fuel, tolls, parking / month", "0"], ["cmonths", "Months left on car loan", "0"], ["calt", "Alternative transport / month", "0"], ["cvalue", "Value of car if sold", "0"], ["csettle", "Loan settlement cost", "0"], ["cv5", "Estimated car value in 5 years (optional)", "0"], ["cv10", "Estimated car value in 10 years (optional)", "0"]]]
  ];
  var CALC_MSG = { rate: "Enter an annual rate above −100%", years: "Enter a number of years from 0 to 1,000", big: "Too large to show — check the inputs", nodouble: "Never doubles at a zero or negative rate" };
  function money(r) { return r === null ? D : CALC_MSG[r] || M.qar(r); }
  function calcOut(id) {
    var c = S.calc, C = M.calc, r;
    switch (id) {
      case "paycheques": r = C.paycheques(c.age, c.msince, c.rage);
        var ra = M.has(c.rage) ? M.num(c.rage) : 65;
        return [["Paycheques left to " + (r === "retire" ? "retirement" : M.fmt(ra, 0)), r === null ? D : r === "retire" ? "Enter a retirement age from 18 to 100" : r === "age" ? "Enter a whole age from 17 to " + M.fmt(ra - 1, 0) : r === "months" ? "Enter whole months since your birthday, 0 to 11" : M.fmt(r, 0)]];
      case "life": r = C.lifeRatio(c.lsav, c.learn); return [["Lifetime spending ratio", r === null ? D : M.pct(r)]];
      case "future":
        r = C.futureEarnings(c.fage, c.fsal, c.fgrow, c.fret, c.finf);
        var fr = M.has(c.fret) ? M.num(c.fret) : M.ASSUME.retire, fg = M.has(c.fgrow) ? M.num(c.fgrow) : M.ASSUME.payGrowth, fi = M.has(c.finf) ? M.num(c.finf) : M.ASSUME.inflation;
        if (r === null || typeof r === "object") return [["Earnings to " + M.fmt(fr, 0) + " (future riyals)", r ? M.qar(r.nominal) : D], ["Same in today\u2019s money", r ? M.qar(r.today) : D],
          ["Assuming", M.fmt(fg, 2) + "% pay rises, " + M.fmt(fi, 2) + "% inflation, retirement at " + M.fmt(fr, 0)]];
        return [["Earnings to retirement", r === "retire" ? "Enter a whole retirement age from 18 to 100" : r === "age" ? "Enter an age below the retirement age" : "Enter rates above \u2212100%"]];
      case "r72": r = C.rule72(c.rrate); return [["Years for money to double", r === null ? D : CALC_MSG[r] || M.fmt(r, 1)]];
      case "eff": r = C.effAnnual(c.emon, c.eday); return [["Effective annual rate", r === null ? D : CALC_MSG[r] || M.pct(r)]];
      case "lump": r = C.lumpSum(c.lpv, c.lrate, c.lyears); return [["Future value", money(r)]];
      case "monthly": r = C.monthlyFV(c.mc, c.mrate, c.myears); return [["Future value", money(r)]];
      case "target":
        r = C.investTarget(c.tgoal, c.tcur, c.trate, c.tyears, c.tinf);
        var ti = M.has(c.tinf) ? M.num(c.tinf) : M.ASSUME.inflation, gfv = typeof r === "number" ? M.num(c.tgoal) * Math.pow(1 + ti / 100, M.num(c.tyears)) : null;
        return [["Monthly contribution needed (the same riyal amount each month, starting now)", r === "years" ? "Enter a number of years above 0" : r === "inflation" ? "Enter an inflation rate above \u2212100%" : money(r)],
          ["Goal in future riyals", gfv === null || !isFinite(gfv) ? D : M.qar(gfv)], ["Assuming", M.fmt(ti, 2) + "% inflation a year"],
          ["Note", "The goal already allows for inflation, so each later payment is worth a little less in today\u2019s money."]];
      case "car":
        r = C.car({ repay: c.crepay, insurance: c.cins, running: c.crun, months: c.cmonths, alt: c.calt, value: c.cvalue, settle: c.csettle, later5: c.cv5, later10: c.cv10 });
        if (!r) return [["Keep: loan term / 5 / 10 years", D], ["Sell: loan term / 5 / 10 years", D], ["Outcome", "Fill in the car inputs to compare."]];
        var later = M.has(c.cv5) || M.has(c.cv10);
        return [["Keep: loan term / 5 / 10 years" + (later ? " (less the car\u2019s value then)" : ""), M.qar(r.keepX) + " / " + M.qar(r.keep5) + " / " + M.qar(r.keep10)], ["Sell: loan term / 5 / 10 years", M.qar(r.sellX) + " / " + M.qar(r.sell5) + " / " + M.qar(r.sell10)],
          ["Outcome", r.verdict === "sell" ? "Selling is cheaper over 10 years by " + M.qar(r.keep10 - r.sell10) : r.verdict === "keep" ? "Keeping is cheaper over 10 years by " + M.qar(r.sell10 - r.keep10) : "Same cost over 10 years"]];
    }
    return [];
  }
  function calcOutHTML(id) { return calcOut(id).map(function (p) { return "<div><dt>" + h(p[0]) + "</dt><dd>" + h(p[1]) + "</dd></div>"; }).join(""); }
  function tools() {
    var sdv = S.settings.startDay, k = curKey(), r = M.monthRange(k, sdv);
    return '<section aria-labelledby="h-tools"><div class="head"><h1 id="h-tools">Tools</h1></div>' +
      '<h2 id="settings">Money month</h2><p class="hint">Set the day you get paid. Each money month runs from payday to the day before the next payday, and every total follows. Leave blank for calendar months. If payday is the 29th\u201331st, short months start on their last day.</p>' +
      field("set-sd", "Money-month start day (1\u201331)", sdv, { money: true, ph: "e.g. 25", bind: "startDay" }) +
      '<dl class="props"><div><dt>Current money month</dt><dd>' + h(M.nice(r.start, true) + " \u2013 " + M.nice(r.end, true)) + '</dd></div><div><dt>Next money month starts</dt><dd>' + h(M.nice(M.monthRange(M.shiftKey(k, 1), sdv).start, true)) + "</dd></div><div><dt>Currency</dt><dd>Qatari riyal (QAR)</dd></div></dl>" +
      '<h2 id="calculators">Calculators</h2><p class="hint">Results appear once the inputs are filled in.</p><div class="calcs">' +
      CALCS.map(function (c) {
        return '<div class="card calc"><h3>' + h(c[1]) + '</h3><p class="hint">' + h(c[2]) + "</p>" +
          c[3].map(function (f) {
            var fld = field("calc-" + f[0], f[1], S.calc[f[0]] || "", { money: true, ph: f[2], bind: "calc:" + f[0] });
            // the iPhone decimal keypad has no minus key, so rates that can be negative get a +/- button
            return SIGNED[f[0]] ? '<div class="signed">' + fld + btn("\u00b1", "negate", f[0], "small", ' aria-label="Make the ' + h(c[1]) + ' rate negative or positive"') + "</div>" : fld;
          }).join("") +
          '<dl class="props out" id="out-' + c[0] + '" aria-live="polite">' + calcOutHTML(c[0]) + "</dl></div>";
      }).join("") + "</div>" +
      '<h2 id="backup">Backup and devices</h2><p class="hint">Your data is saved only on this device' + (storageOk ? "" : " (saving is failing here)") + '. Export a backup regularly and import it on another phone or computer. ' + S.transactions.length + " transactions, " + S.categories.length + " categories, " + S.accounts.length + " accounts, " + S.goals.length + " goals.</p>" +
      '<div class="row">' + btn("Export backup (JSON)", "exportjson", undefined, "primary") + btn("Export transactions (CSV)", "exportcsv") + "</div>" +
      '<label class="field" for="imp"><span>Import a backup (.json replaces everything) or transactions (.csv adds them)</span><input id="imp" type="file" accept=".json,.csv,application/json,text/csv" data-bind="import"></label>' +
      '<p class="hint">CSV columns: date (YYYY-MM-DD or DD/MM/YYYY), amount, category, paid_from, note.</p>' +
      (hasUndo() ? btn("Undo last import", "undoimport") : "") +
      btn("Erase all data on this device", "erase", undefined, "danger") +
      '<p class="hint ver">Money app ' + h(window.MONEY_VERSION || "") + ". Works offline once opened.</p></section>";
  }

  /* ---------- render ---------- */
  function render() {
    var app = document.getElementById("app"), active = document.activeElement, fid = active && active.id, y = window.scrollY;
    var body = { home: home, budget: budget, spend: spend, worth: worth, tools: tools }[U.tab]();
    app.innerHTML = '<main id="main">' + recoveryBox() + body + "</main>" +
      '<nav class="tabbar" aria-label="Sections">' + TABS.map(function (t) {
        return '<button type="button" data-act="tab" data-arg="' + t[0] + '"' + (U.tab === t[0] ? ' aria-current="page" class="on"' : "") + ">" + t[1] + "</button>";
      }).join("") + "</nav>";
    window.scrollTo(0, y);
    if (fid) { var el = document.getElementById(fid); if (el && el.focus && el.type !== "file") el.focus({ preventScroll: true }); }
  }
  function later() { setTimeout(render, 0); }

  /* ---------- actions ---------- */
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  var NC = { group: "Day-to-day", name: "" };
  var ACT = {
    negate: function (k) {
      var el = document.getElementById("calc-" + k); if (!el) return;
      var v = el.value.trim();
      el.value = /^[-\u2212]/.test(v) ? v.replace(/^[-\u2212]\s*/, "") : "-" + v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    },
    tab: function (a) { U.tab = a; U.editTx = null; try { localStorage.setItem(KEY + "-tab", a); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); },
    month: function (a) {
      U.sel = M.shiftKey(selKey(), Number(a)); render();
    },
    quickadd: function () {
      var p = quickPreview(); if (!p.ready) return;
      if (M.groupMap(S)[p.cat] === undefined) S.categories.push({ id: M.uid("c"), group: "Other", name: p.cat, budget: "", debt: M.defaultDebt(p.cat) });
      S.transactions.push({ id: M.uid("t"), date: p.date, amount: p.amount, category: p.cat, paidFrom: U.form.paid.trim(), note: p.note });
      U.sel = M.moneyMonth(p.date, sd());
      U.msg = p.amount < 0 ? "Refund of " + money(-p.amount) + " recorded against " + p.cat + "." : "Added " + money(p.amount) + " to " + p.cat + ".";
      U.form.qa = ""; U.form.cat = "";
      commit(); toast(U.msg);
      var q = document.getElementById("qa"); if (q) q.focus();
    },
    edittx: function (id) { U.editTx = id; render(); var el = document.getElementById("e-amount"); if (el) el.focus(); },
    editdone: function () { U.editTx = null; render(); },
    deltx: function (id) { if (!confirm("Delete this transaction?")) return; S.transactions = S.transactions.filter(function (t) { return t.id !== id; }); U.editTx = null; commit(); toast("Transaction deleted."); },
    addcat: function () {
      var name = NC.name.trim(); if (!name) { toast("Type a category name first."); return; }
      if (M.groupMap(S)[name] !== undefined) { toast("That category already exists."); return; }
      S.categories.push({ id: M.uid("c"), group: NC.group, name: name, budget: "", debt: M.defaultDebt(name) }); NC.name = ""; commit(); toast("Added " + name + ".");
    },
    delcat: function (id) {
      var c = find(S.categories, id); if (!c) return;
      var used = S.transactions.filter(function (t) { return t.category === c.name; }).length;
      if (!confirm("Remove the category \u201c" + c.name + "\u201d?" + (used ? " Its " + used + " transaction(s) stay and are counted under Other." : ""))) return;
      S.categories = S.categories.filter(function (x) { return x.id !== id; }); commit();
    },
    addacc: function () { S.accounts.push({ id: M.uid("a"), name: "", type: "Asset", balance: "" }); commit(); var l = S.accounts[S.accounts.length - 1]; var el = document.getElementById("an-" + l.id); if (el) el.focus(); },
    delacc: function (id) { if (!confirm("Remove this account?")) return; S.accounts = S.accounts.filter(function (a) { return a.id !== id; }); commit(); },
    addgoal: function () { S.goals.push({ id: M.uid("g"), name: "", current: "", target: "", monthly: "" }); commit(); var l = S.goals[S.goals.length - 1]; var el = document.getElementById("gn-" + l.id); if (el) el.focus(); },
    delgoal: function (id) { if (!confirm("Remove this goal?")) return; S.goals = S.goals.filter(function (g) { return g.id !== id; }); commit(); },
    flip: function () {
      var em = S.goals.filter(function (g) { return g.name === "Emergency fund"; })[0], tf = S.goals.filter(function (g) { return g.name === "Table flip fund"; })[0];
      if (!em || !M.has(em.target) || !tf) { toast("Set a target for Emergency fund first (and keep a Table flip fund goal)."); return; }
      tf.target = String(M.num(em.target) * 3); commit(); toast("Table flip target set to " + M.qar(M.num(tf.target)) + ".");
    },
    recdownload: function () {
      var ks = recKeys(), parts = [];
      if (ks.length) ks.forEach(function (k) { try { parts.push(localStorage.getItem(k)); } catch (e) { /* ignore */ } });
      else { try { parts.push(localStorage.getItem(KEY)); } catch (e) { /* ignore */ } }
      parts.forEach(function (raw, i) { download("money-damaged-data-" + today() + (parts.length > 1 ? "-" + (i + 1) : "") + ".txt", raw || "", "text/plain"); });
      toast("Damaged data downloaded. Keep the file; it is the original, unchanged.");
    },
    recfresh: function () {
      if (!confirm(readOnly ? "Start fresh? The damaged data hasn't been kept on this device, so download it first if you haven't. Start fresh now?" : "Start fresh with a blank app? The damaged copy stays kept until you delete it.")) return;
      readOnly = false; problem = ""; S = M.defaultState(); U.sel = ""; commit(); toast("Started fresh.");
    },
    recdelete: function () {
      if (!confirm("Delete the kept copy of the damaged data? Download it first if you might need it.")) return;
      recKeys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      problem = ""; render(); toast("Damaged copy deleted.");
    },
    reload: function () { location.reload(); },
    // #28: the saved data itself (newer format) is the backup; it imports into the updated app
    newerdownload: function () { download("money-backup-" + today() + ".json", rawSaved() || "", "application/json"); toast("Saved data downloaded, unchanged."); },
    exportjson: function () { if (newer) { ACT.newerdownload(); return; } download("money-backup-" + today() + ".json", M.toBackup(S), "application/json"); toast("Backup exported."); },
    exportcsv: function () { download("money-transactions-" + today() + ".csv", M.txToCSV(S), "text/csv"); toast("Transactions exported."); },
    undoimport: function () {
      var raw = null; try { raw = localStorage.getItem(UNDO_KEY); } catch (e) { /* ignore */ }
      if (!raw) { toast("There's no import to undo."); return; }
      var prev; try { prev = M.normalize(JSON.parse(raw)); } catch (e) { toast("The undo copy is damaged, so nothing was changed."); return; }
      if (!confirm("Put back the data you had before the last import? Anything changed since then is replaced.")) return;
      S = prev; U.sel = ""; commit();
      try { localStorage.removeItem(UNDO_KEY); } catch (e) { /* ignore */ }
      render(); toast("Your data from before the import is back.");
    },
    erase: function () {
      if (!confirm("Erase all money data on this device, including any undo or damaged-data copies? Export a backup first if you might need it.")) return;
      readOnly = false; problem = ""; newer = 0; wipeOtherKeys(); S = M.defaultState(); U.sel = ""; commit(); toast("All data erased.");
    }
  };
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result || "");
      if (newer) { toast(NEWER_MSG + " Nothing was imported."); return; }
      try {
        if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) {
          var rb = M.readBackup(text), c = rb.counts; // throws (and changes nothing) unless it's a supported Money backup
          var msg = "Replace all data on this device with this backup?\n\nIt has " + c.transactions + " transactions, " + c.categories + " categories, " + c.accounts + " accounts and " + c.goals + " goals." +
            (rb.droppedTotal ? "\n" + rb.droppedTotal + " damaged record(s) in the file will be skipped." : "") +
            "\n\nYour current data is kept as an undo copy (Tools \u2192 Undo last import).";
          if (!confirm(msg)) return;
          try { localStorage.setItem(UNDO_KEY, JSON.stringify(S)); }
          catch (e2) { toast("Couldn't keep an undo copy on this device, so nothing was changed. Export a backup first, then try again."); return; }
          S = rb.state; U.sel = ""; commit();
          toast("Backup imported: " + c.transactions + " transactions" + (rb.droppedTotal ? ", " + rb.droppedTotal + " damaged record(s) skipped" : "") + ".");
        } else {
          var res = M.csvToTx(text, S);
          var neg = res.negatives ? " Skipped " + res.negatives + " negative amount" + (res.negatives === 1 ? "" : "s") + ": in most bank statements a minus means money out, but in Money it means a refund, so enter those by hand." : "";
          if (!res.rows.length) { toast("No transactions found in that CSV" + (res.skipped ? " (" + res.skipped + " rows skipped)." : ".") + neg); return; }
          res.newCategories.forEach(function (n) { S.categories.push({ id: M.uid("c"), group: "Other", name: n, budget: "", debt: M.defaultDebt(n) }); });
          S.transactions = S.transactions.concat(res.rows); commit();
          toast("Imported " + res.rows.length + " transactions" + (res.skipped ? ", skipped " + res.skipped : "") + (res.newCategories.length ? ", added " + res.newCategories.length + " new categories under Other" : "") + "." + neg);
        }
      } catch (e) { toast(e.message || "Couldn't import that file."); }
    };
    r.readAsText(file);
  }

  function onBind(el, isInput) {
    var b = el.getAttribute("data-bind"); if (!b) return;
    var p = b.split(":"), v = el.type === "checkbox" ? el.checked : el.value;
    switch (p[0]) {
      case "gtype": if (isInput) return; var gn = decodeURIComponent(p.slice(1).join(":"));
        if (M.GROUP_TYPES.indexOf(v) >= 0) { S.settings.groupTypes = S.settings.groupTypes || Object.create(null); S.settings.groupTypes[gn] = v; save(); later(); toast(gn + " now counts as: " + GT_OPTS.filter(function (o) { return o[0] === v; })[0][1] + "."); }
        return;
      case "debt": if (isInput) return; var dc = find(S.categories, p[1]);
        if (dc) { dc.debt = !!v; save(); later(); toast(dc.name + (dc.debt ? " now counts as debt repaid." : " now counts as saved, not debt repaid.")); }
        return;
      case "budget": var c = find(S.categories, p[1]); if (c && !isInput) { c.budget = M.has(v) ? String(M.num(v)) : ""; save(); later(); } return;
      case "acc": var a = find(S.accounts, p[1]); if (a) { a[p[2]] = p[2] === "balance" ? (M.has(v) ? String(M.num(v)) : "") : v; if (!isInput || p[2] === "name") { save(); } if (!isInput) later(); } return;
      case "goal": var g = find(S.goals, p[1]); if (g) { g[p[2]] = p[2] === "name" ? v : (M.has(v) ? String(M.num(v)) : ""); if (!isInput) { save(); later(); } } return;
      case "edit": var t = find(S.transactions, U.editTx); if (!t || isInput) return;
        if (p[1] === "amount") { if (M.num(v) !== 0 && M.has(v)) t.amount = M.num(v); else { toast("Enter an amount (a minus amount is a refund)."); later(); return; } }
        else if (p[1] === "date") { var d = M.parseDate(v); if (d) t.date = d; else { toast("Enter a valid date."); later(); return; } }
        else t[p[1]] = String(v).trim();
        if (p[1] === "date") U.sel = M.moneyMonth(t.date, sd());
        save(); later(); return;
      case "review": if (isInput) return; var k = selKey(); S.review[k] = S.review[k] || {}; if (v) S.review[k][p[1]] = true; else delete S.review[k][p[1]]; commit(); return;
      case "onlyActive": if (!isInput) { U.onlyActive = !!v; render(); } return;
      case "month": if (!isInput) { U.sel = v; render(); } return;
      case "startDay": if (isInput) return; var n = Math.floor(M.num(v)); S.settings.startDay = M.has(v) && n >= 1 && n <= 31 ? String(n) : ""; if (M.has(v) && !(n >= 1 && n <= 31)) toast("Use a day from 1 to 31."); U.sel = ""; save(); later(); return;
      case "calc": S.calc[p[1]] = v; save(); CALCS.forEach(function (c) { var o = document.getElementById("out-" + c[0]); if (o && c[3].some(function (f) { return f[0] === p[1]; })) o.innerHTML = calcOutHTML(c[0]); }); return;
      case "qa": U.form.qa = v; U.msg = ""; updateQuick(); return;
      case "qaCat": U.form.cat = v; updateQuick(); return;
      case "qaPaid": U.form.paid = v; return;
      case "qaDate": U.form.date = v; updateQuick(); return;
      case "ncGroup": NC.group = v; return;
      case "ncName": NC.name = v; return;
      case "import": if (!isInput && el.files && el.files[0]) { importFile(el.files[0]); el.value = ""; } return;
    }
  }
  function updateQuick() {
    var pv = quickPreview(), el = document.getElementById("qa-prev"), b = document.querySelector("[data-act=quickadd]"), sel = document.getElementById("qa-cat");
    if (el) el.textContent = pv.text; if (b) b.disabled = !pv.ready;
    if (sel && sel.options[0]) { var auto = M.matchCat(M.parseQuick(U.form.qa).catText, catNames()); sel.options[0].textContent = auto ? "Auto: " + auto : "Auto (from what you typed)"; }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-act]"); if (!t || t.disabled) return;
    var f = ACT[t.getAttribute("data-act")]; if (f) { e.preventDefault(); f(t.getAttribute("data-arg")); }
  });
  document.addEventListener("input", function (e) { if (e.target.matches("[data-bind]") && e.target.type !== "checkbox" && e.target.type !== "file" && e.target.tagName !== "SELECT") onBind(e.target, true); });
  document.addEventListener("change", function (e) { if (e.target.matches("[data-bind]")) onBind(e.target, false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "qa") { e.preventDefault(); ACT.quickadd(); } });
  window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) { load(); render(); } else if (e.key && e.key.indexOf(REC_KEY) === 0) render(); });

  load(); render();
  if (problem || readOnly) setTimeout(function () { window.scrollTo(0, 0); }, 0);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () { /* offline install not available */ });
  }
  window.MoneyApp = { state: function () { return S; }, render: render, U: U, readOnly: function () { return readOnly; }, newer: function () { return newer; } };
})();
