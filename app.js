const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = 'fastTracker';
const S = Object.assign(
  { fast: null, past: [], logs: {}, energy: [], hunger: [], hours: 16, range: 30, show: { s: true, w: true, e: true, h: true } },
  JSON.parse(localStorage.getItem(KEY) || '{}')
);
if (S.show.h === undefined) S.show.h = true; // older saved data has no hunger toggle
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const H = 36e5;

// [start hour, end hour, name, description, colour]
const PH = [
  [0, 4, 'Fed state', 'Digesting and absorbing your last meal', '#38bdf8'],
  [4, 12, 'Blood sugar falling', 'Insulin drops and the body uses stored glycogen', '#2dd4bf'],
  [12, 16, 'Fat burning begins', 'Shifting towards fat as the main fuel', '#4ade80'],
  [16, 24, 'Deeper fat burning', 'Ketones start to rise', '#facc15'],
  [24, 999, 'Extended fast', 'Go carefully and listen to your body', '#fb923c']
];

// ---------- Dial ----------
const R = 92, C = 2 * Math.PI * R;
function arcs(L, upto, op) {
  let o = '';
  PH.forEach(([a, b, , , c]) => {
    const e = Math.min(b, L, upto);
    if (e <= a) return;
    const len = ((e - a) / L) * C;
    o += `<circle r="${R}" cx="110" cy="110" fill="none" stroke="${c}" stroke-width="16" stroke-opacity="${op}" stroke-dasharray="${Math.max(len - 2, 0.1)} ${C}" stroke-dashoffset="${(-a / L) * C}" transform="rotate(-90 110 110)"/>`;
  });
  return o;
}
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
const nice = t => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const elapsed = () => (S.fast ? (Date.now() - S.fast.start) / H : 0);

function tick() {
  const f = S.fast, L = f ? f.hours : S.hours, el = elapsed();
  $('#ring').innerHTML = arcs(L, L, 0.22) + (f && el > 0 ? arcs(L, el, 1) : '');
  if (!f) { $('#big').textContent = fmt(L * H); $('#sub').textContent = `Ready for a ${L} hour fast`; $('#eatAt').textContent = ''; }
  else {
    const end = f.start + f.hours * H;
    if (el < 0) { $('#big').textContent = fmt(f.start - Date.now()); $('#sub').textContent = 'until your fast starts'; }
    else if (Date.now() < end) { $('#big').textContent = fmt(end - Date.now()); $('#sub').textContent = 'left until you can eat'; }
    else { $('#big').textContent = 'Done'; $('#sub').textContent = `You can eat now. Fasted ${el.toFixed(1)} hours`; }
    $('#eatAt').textContent = `Eat at ${nice(end)}`;
  }
  $('#phases').innerHTML = PH.filter(p => p[0] < L).map(([a, b, n, d, c]) =>
    `<li class="${f && el >= a && el < b ? 'now' : ''}"><i style="background:${c}"></i><div>${n} (${a}h${b < 999 ? '-' + Math.min(b, L) + 'h' : '+'})<span>${d}</span></div></li>`).join('');
  $('#main').textContent = f ? 'End fast' : 'Start my fast';
  $('#main').classList.toggle('end', !!f);
}

// ---------- Fast controls ----------
function renderPresets() {
  $('#presets').innerHTML = [12, 15, 16, 17, 18, 19].map(h => `<button class="chip ${S.hours === h ? 'on' : ''}" data-h="${h}">${h}h</button>`).join('');
  $('#custom').value = S.hours;
  $$('#presets .chip').forEach(b => b.onclick = () => setHours(+b.dataset.h));
}
function setHours(h) {
  h = Math.max(12, parseFloat(h) || 12);
  S.hours = h;
  if (S.fast) S.fast.hours = h;
  save(); renderPresets(); tick();
}
$('#custom').onchange = e => setHours(e.target.value);

$('#main').onclick = () => {
  if (!S.fast) {
    const v = $('#startAt').value;
    S.fast = { start: v ? new Date(v).getTime() : Date.now(), hours: S.hours };
    $('#startAt').value = '';
  } else {
    const done = Date.now() >= S.fast.start + S.fast.hours * H;
    if (!done && !confirm('End your fast early?')) return;
    S.past.push({ start: S.fast.start, end: Date.now(), hours: S.fast.hours, done });
    S.fast = null;
  }
  save(); tick(); energyNote(); hungerNote();
};

// ---------- Energy check-ins ----------
$('#energyBtns').innerHTML = [1, 2, 3, 4, 5].map(n => `<button data-l="${n}">${n}</button>`).join('');
function energyNote(msg) {
  $('#energyNote').textContent = msg || (S.fast ? 'Tap a number to log your energy at this point in the fast.' : 'Start a fast to log your energy (1 = drained, 5 = great).');
}
$$('#energyBtns button').forEach(b => b.onclick = () => {
  if (!S.fast || elapsed() < 0) return energyNote('Start a fast first, then log your energy.');
  S.energy.push({ t: Date.now(), h: elapsed(), l: +b.dataset.l, fs: S.fast.start });
  save(); energyNote(`Logged ${b.dataset.l}/5 at hour ${elapsed().toFixed(1)}`);
});

// ---------- Hunger check-ins ----------
$('#hungerBtns').innerHTML = [1, 2, 3, 4, 5].map(n => `<button data-l="${n}">${n}</button>`).join('');
function hungerNote(msg) {
  $('#hungerNote').textContent = msg || (S.fast ? 'Tap a number to log your hunger at this point in the fast.' : 'Start a fast to log your hunger (1 = not hungry, 5 = starving).');
}
$$('#hungerBtns button').forEach(b => b.onclick = () => {
  if (!S.fast || elapsed() < 0) return hungerNote('Start a fast first, then log your hunger.');
  S.hunger.push({ t: Date.now(), h: elapsed(), l: +b.dataset.l, fs: S.fast.start });
  save(); hungerNote(`Logged ${b.dataset.l}/5 at hour ${elapsed().toFixed(1)}`);
});

// ---------- Daily log ----------
function loadLog() {
  const l = S.logs[$('#logDate').value] || {};
  $('#weight').value = l.weight ?? ''; $('#sleep').value = l.sleep ?? ''; $('#quality').value = l.quality ?? '';
}
$('#logDate').value = dk(new Date());
$('#logDate').onchange = loadLog;
$('#saveLog').onclick = () => {
  const n = v => (v === '' ? null : +v);
  S.logs[$('#logDate').value] = { weight: n($('#weight').value), sleep: n($('#sleep').value), quality: n($('#quality').value) };
  save(); $('#logMsg').textContent = 'Saved.';
};

// ---------- History ----------
let ch1, ch2;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const daily = arr => { const o = {}; arr.forEach(e => { const k = dk(new Date(e.t)); (o[k] = o[k] || []).push(e.l); }); return o; };
const byHour = arr => { const o = {}; arr.forEach(e => { const k = Math.floor(e.h); (o[k] = o[k] || []).push(e.l); }); return o; };

function hist() {
  if (typeof Chart === 'undefined') { $('#hardest').textContent = 'Charts could not load. Check your internet connection and refresh.'; return; }
  Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--muted');
  Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--line');
  const days = [];
  for (let i = S.range - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dk(d)); }
  const hu = daily(S.hunger);
  const g = f => days.map(d => S.logs[d]?.[f] ?? null);
  const dayAvg = o => days.map(d => (o[d] ? +avg(o[d]).toFixed(1) : null));
  const ds = [];
  if (S.show.s) ds.push({ type: 'bar', label: 'Sleep (h)', data: g('sleep'), backgroundColor: '#38bdf899', yAxisID: 'y1' });
  if (S.show.w) ds.push({ type: 'line', label: 'Weight (kg)', data: g('weight'), borderColor: '#35d07f', backgroundColor: '#35d07f', yAxisID: 'y', spanGaps: true, tension: 0.3 });
  if (S.show.h) ds.push({ type: 'line', label: 'Hunger (1-5)', data: dayAvg(hu), borderColor: '#f472b6', backgroundColor: '#f472b6', yAxisID: 'y2', spanGaps: true, tension: 0.3 });
  ch1 && ch1.destroy();
  ch1 = new Chart($('#c1'), {
    data: { labels: days.map(d => d.slice(5)), datasets: ds },
    options: { scales: { y: { display: S.show.w, position: 'left' }, y1: { display: S.show.s, position: 'right', min: 0, max: 12, grid: { drawOnChartArea: false } }, y2: { display: false, min: 0, max: 5 } } }
  });

  const be = byHour(S.energy), bh = byHour(S.hunger);
  const ks = [...new Set([...Object.keys(be), ...Object.keys(bh)].map(Number))].sort((a, b) => a - b);
  const hv = o => ks.map(k => (o[k] ? +avg(o[k]).toFixed(2) : null));
  const ev = hv(be), hg = hv(bh);
  const sets = [
    { type: 'bar', label: 'Energy', data: ev, backgroundColor: '#2dd4bf99' },
    { type: 'line', label: 'Hunger', data: hg, borderColor: '#f472b6', backgroundColor: '#f472b6', spanGaps: true, tension: 0.3 }
  ];
  ch2 && ch2.destroy();
  ch2 = new Chart($('#c2'), {
    type: 'bar',
    data: { labels: ks.map(k => 'h' + k), datasets: sets },
    options: { scales: { y: { min: 0, max: 5 } } }
  });
  const pick = (v, fn) => { const x = v.filter(n => n !== null); return x.length ? v.indexOf(fn(...x)) : -1; };
  const lo = pick(ev, Math.min), hi = pick(hg, Math.max), parts = [];
  if (lo >= 0) parts.push(`Lowest energy: hour ${ks[lo]} (${ev[lo]}/5).`);
  if (hi >= 0) parts.push(`Hunger peaks: hour ${ks[hi]} (${hg[hi]}/5).`);
  $('#hardest').textContent = parts.join(' ') || 'Log energy and hunger check-ins during a fast to see your hardest hour.';

  const done = S.past.filter(p => p.done);
  let streak = 0;
  for (let i = S.past.length - 1; i >= 0 && S.past[i].done; i--) streak++;
  const longest = done.length ? Math.max(...done.map(p => (p.end - p.start) / H)) : 0;
  $('#stats').innerHTML = `<div><b>${done.length}</b>completed</div><div><b>${streak}</b>in a row</div><div><b>${longest.toFixed(1)}h</b>longest</div>`;
  $('#past').innerHTML = S.past.map((p, i) => ({ p, i })).slice(-15).reverse().map(({ p, i }) =>
    `<li><span>${nice(p.start)}</span><span class="res">${((p.end - p.start) / H).toFixed(1)}h of ${p.hours}h ${p.done ? 'completed' : 'ended early'}</span><button class="del" data-i="${i}" aria-label="Delete this fast">Delete</button></li>`).join('') || '<li>No fasts yet.</li>';
  $$('#past .del').forEach(b => b.onclick = () => {
    if (!confirm('Delete this fast? This cannot be undone.')) return;
    S.past.splice(+b.dataset.i, 1);
    save(); hist();
  });
}
$('#showChips').innerHTML = [['s', 'Sleep'], ['w', 'Weight'], ['h', 'Hunger']].map(([k, n]) => `<button class="chip ${S.show[k] ? 'on' : ''}" data-k="${k}">${n}</button>`).join('');
$$('#showChips .chip').forEach(b => b.onclick = () => { S.show[b.dataset.k] = !S.show[b.dataset.k]; b.classList.toggle('on'); save(); hist(); });
$('#rangeChips').innerHTML = [7, 30, 90].map(n => `<button class="chip ${S.range === n ? 'on' : ''}" data-n="${n}">${n} days</button>`).join('');
$$('#rangeChips .chip').forEach(b => b.onclick = () => { S.range = +b.dataset.n; $$('#rangeChips .chip').forEach(x => x.classList.toggle('on', x === b)); save(); hist(); });

// ---------- Backup ----------
function dl(name, txt, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; a.click(); }
$('#expJson').onclick = () => dl('fasting-backup.json', JSON.stringify(S, null, 2), 'application/json');
$('#expCsv').onclick = () => {
  const r = ['type,date_or_start,end_or_weight,planned_hours_or_sleep,done_or_quality'];
  S.past.forEach(p => r.push(`fast,${new Date(p.start).toISOString()},${new Date(p.end).toISOString()},${p.hours},${p.done}`));
  Object.entries(S.logs).forEach(([d, l]) => r.push(`log,${d},${l.weight ?? ''},${l.sleep ?? ''},${l.quality ?? ''}`));
  S.energy.forEach(e => r.push(`energy,${new Date(e.t).toISOString()},${e.l},${e.h.toFixed(2)},`));
  S.hunger.forEach(e => r.push(`hunger,${new Date(e.t).toISOString()},${e.l},${e.h.toFixed(2)},`));
  dl('fasting-data.csv', r.join('\n'), 'text/csv');
};
$('#impBtn').onclick = () => $('#impFile').click();
$('#impFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { try { Object.assign(S, JSON.parse(t)); save(); location.reload(); } catch { alert('That file could not be read. Use a JSON file exported from this app.'); } });
};

// ---------- Tabs and theme ----------
$$('nav button').forEach(b => b.onclick = () => {
  $$('nav button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'history') hist();
  scrollTo(0, 0);
});
function theme(t) { S.theme = t; document.documentElement.dataset.theme = t; $('#theme').textContent = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; save(); }
$('#theme').onclick = () => { theme(S.theme === 'dark' ? 'light' : 'dark'); if ($('#tab-history').classList.contains('active')) hist(); };
theme(S.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

renderPresets(); loadLog(); energyNote(); hungerNote(); tick();
setInterval(tick, 1000);