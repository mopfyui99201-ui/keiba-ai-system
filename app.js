/* app.js - 競馬AI予想（閲覧用）ロジック */
'use strict';

const JRA_VENUES = ["東京","中山","京都","阪神","中京","新潟","福島","小倉","函館","札幌"];
const NAR_VENUES = ["大井","川崎","船橋","浦和","門別","帯広(ばんえい)","盛岡","水沢","金沢","笠松","名古屋","園田","姫路","高知","佐賀"];
const VENUE_EVENTS = {
  "東京":["日本ダービー","天皇賞(秋)","ジャパンC","有馬記念"],"中山":["皐月賞","有馬記念","ホープフルS"],"京都":["菊花賞","天皇賞(春)","エリザベス女王杯"],"阪神":["桜花賞","宝塚記念","大阪杯"],
  "中京":["チャンピオンズC","名古屋大賞典"],"新潟":["新潟2歳S","新潟記念"],"福島":["福島記念","ラジオNIKKEI賞"],"小倉":["小倉記念","北九州記念"],"函館":["函館記念","函館2歳S"],"札幌":["札幌記念","札幌2歳S"],
  "大井":["東京大賞典","大井記念"],"川崎":["川崎記念","戸塚記念"],"船橋":["船橋記念"],"浦和":["浦和記念"],"門別":["門別記念"],"帯広(ばんえい)":["ばんえい記念"],"盛岡":["盛岡記念"],"水沢":["水沢記念"],
  "金沢":["金沢記念"],"笠松":["笠松記念"],"名古屋":["名古屋記念"],"園田":["園田記念"],"姫路":["姫路記念"],"高知":["高知記念"],"佐賀":["佐賀記念"]
};

const BIG_RACES = [
  {name:"皐月賞", meta:"JRA・3歳クラシック第1戦（4月・中山）", url:"https://www.jra.go.jp/keiba/"},
  {name:"東京優駿（日本ダービー）", meta:"JRA・3歳クラシック第2戦（5月・東京）", url:"https://www.jra.go.jp/keiba/"},
  {name:"宝塚記念", meta:"JRA・G1（6月・阪神）", url:"https://www.jra.go.jp/keiba/"},
  {name:"菊花賞", meta:"JRA・3歳クラシック第3戦（10月・京都）", url:"https://www.jra.go.jp/keiba/"},
  {name:"天皇賞（秋）", meta:"JRA・G1（10月・東京）", url:"https://www.jra.go.jp/keiba/"},
  {name:"エリザベス女王杯", meta:"JRA・G1牝馬限定（11月・京都）", url:"https://www.jra.go.jp/keiba/"},
  {name:"ジャパンカップ", meta:"JRA・G1・国際（11月・東京）", url:"https://www.jra.go.jp/keiba/"},
  {name:"マイルチャンピオンシップ", meta:"JRA・G1・国際（10月・京都）", url:"https://www.jra.go.jp/keiba/"},
  {name:"有馬記念", meta:"JRA・G1・年末の大一番（12月・中山）", url:"https://www.jra.go.jp/keiba/"},
  {name:"東京大賞典", meta:"NAR南関東・G1（12月・大井）", url:"https://www.keiba.go.jp/"},
  {name:"ばんえい記念", meta:"ばんえいG1・年間最大（12月頃・帯広）", url:"https://www.keiba.go.jp/"},
];

const RACE_PRESETS = [
  "（レースを選択してください）",
  "東京11R エリザベス女王杯",
  "中山11R 有馬記念",
  "東京11R ジャパンカップ",
  "京都11R 菊花賞",
  "阪神11R 宝塚記念",
  "東京11R 日本ダービー",
  "大井11R 東京大賞典",
  "帯広 メイン ばんえい記念",
];

const LEARN_CATEGORIES = {
  g1:    {label:"大型イベント", venues:["（指定なし）","東京","京都","阪神","中山"]},
  jra:   {label:"中央競馬",     venues:JRA_VENUES},
  nar:   {label:"地方競馬",     venues:NAR_VENUES},
  banei: {label:"特殊競馬",     venues:["帯広（ばんえい）"]},
};

let venueData = {};
let venueToggles = {};
let predictionsHistory = [];
let learnings = [];
let latestData = null;
let windowLastTickets = '';
let selectedRaceName = '';
let editingLearnIndex = -1;

/* ---------- 状態保存 ---------- */
function loadJSON(key, fb) {
  try { return JSON.parse(localStorage.getItem(key) || fb); } catch(e) { return fb; }
}
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- タブ・アコーディオン ---------- */
function setTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
  if (tab === 'predict') document.getElementById('predict-section')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function toggleAccordion(header, sectionId) {
  const content = document.getElementById(sectionId);
  const toggle = header.querySelector('.accordion-toggle');
  const isOpen = content.classList.contains('open');
  document.querySelectorAll('.accordion-content.open').forEach(c => {
    c.classList.remove('open'); c.style.maxHeight = '0';
    const h = c.previousElementSibling;
    if (h) { h.classList.remove('active'); const t = h.querySelector('.accordion-toggle'); if (t) t.textContent = '▼'; }
  });
  if (!isOpen) {
    content.classList.add('open'); content.style.maxHeight = '640px';
    header.classList.add('active'); toggle.textContent = '▲';
  }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- 競馬場リスト ---------- */
function buildVenues() {
  const jraGrid = document.getElementById('jra-venues');
  const narGrid = document.getElementById('nar-venues');
  if (!jraGrid || !narGrid) return;
  jraGrid.innerHTML = ''; narGrid.innerHTML = '';
  [...JRA_VENUES, ...NAR_VENUES].forEach(v => {
    const isJRA = JRA_VENUES.includes(v);
    const d = venueData[v] || {};
    const events = VENUE_EVENTS[v] || [];
    const mainEvent = events[0] || '通常開催';
    const allEvents = events.join(' / ') || 'なし';
    const toggleOn = venueToggles[v] !== false;
    const grid = isJRA ? jraGrid : narGrid;
    const row = document.createElement('div');
    row.className = 'venue-row';
    row.innerHTML =
      '<span class="venue-name" data-v="' + esc(v) + '">' + esc(v) + '</span>' +
      '<span class="venue-event"><span class="ev-star' + (d.favorite ? ' on' : '') + '">★</span>' + esc(mainEvent) + '</span>' +
      '<span class="fav-star' + (d.favorite ? ' on' : '') + '" data-v="' + esc(v) + '">★</span>' +
      '<div class="toggle' + (toggleOn ? ' active' : '') + '" data-v="' + esc(v) + '"></div>';
    grid.appendChild(row);
    const detail = document.createElement('div');
    detail.className = 'venue-detail';
    detail.id = 'detail-' + v;
    detail.innerHTML =
      '<div class="ev-title">主要ビッグイベント</div>' +
      '<div class="ev-list">' + esc(allEvents) + '</div>' +
      '<div class="memo-box">' +
        '<div class="memo-view" id="memo-view-' + esc(v) + '">' + esc(d.memo || '（メモなし）') + '</div>' +
        '<div class="memo-inputs">' +
          '<input type="text" id="memo-input-' + esc(v) + '" placeholder="攻略メモを入力...">' +
          '<button class="save" data-v="' + esc(v) + '">保存</button>' +
          '<button class="del" data-v="' + esc(v) + '">削除</button>' +
        '</div></div>';
    grid.appendChild(detail);
  });
}
function venueAction(v, action) {
  if (action === 'fav') {
    if (!venueData[v]) venueData[v] = {};
    venueData[v].favorite = !venueData[v].favorite;
    saveJSON('keiba_venue_data', venueData); buildVenues();
  } else if (action === 'toggle') {
    venueToggles[v] = venueToggles[v] === false ? true : false;
    saveJSON('keiba_venue_toggles', venueToggles);
    const el = document.querySelector('.toggle[data-v="' + v + '"]');
    if (el) el.classList.toggle('active', venueToggles[v] !== false);
  } else if (action === 'save') {
    const input = document.getElementById('memo-input-' + v);
    if (!venueData[v]) venueData[v] = {};
    venueData[v].memo = input ? input.value.trim() : '';
    saveJSON('keiba_venue_data', venueData);
    const view = document.getElementById('memo-view-' + v);
    if (view) view.textContent = venueData[v].memo || '（メモなし）';
    if (input) input.value = '';
  } else if (action === 'del') {
    if (venueData[v]) venueData[v].memo = '';
    saveJSON('keiba_venue_data', venueData);
    const view = document.getElementById('memo-view-' + v);
    if (view) view.textContent = '（メモなし）';
    const input = document.getElementById('memo-input-' + v);
    if (input) input.value = '';
  }
}
function toggleVenueDetail(v) {
  const detail = document.getElementById('detail-' + v);
  if (!detail) return;
  const wasOpen = detail.classList.contains('open');
  document.querySelectorAll('.venue-detail.open').forEach(d => d.classList.remove('open'));
  if (!wasOpen) detail.classList.add('open');
}

/* ---------- G1カード ---------- */
function renderG1() {
  const grid = document.getElementById('g1-grid');
  if (!grid) return;
  grid.innerHTML = BIG_RACES.map(r =>
    '<div class="g1-card"><div class="g1-name">' + esc(r.name) + '</div>' +
    '<div class="g1-meta">' + esc(r.meta) + '</div>' +
    '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">公式サイト →</a></div>'
  ).join('');
}

/* ---------- 最新情報（同期JSON） ---------- */
function loadLatest() {
  const card = document.getElementById('latest-card');
  const body = document.getElementById('latest-body');
  const timeEl = document.getElementById('latest-time');
  if (!card) return;
  fetch('data/latest_keiba.json?t=' + Date.now()).then(r => {
    if (!r.ok) throw new Error('no data');
    return r.json();
  }).then(data => {
    latestData = data;
    if (!data || (!data.upcoming && !data.results && !data.news)) return;
    populateRaceSelect();
    timeEl.textContent = '更新: ' + (data.synced_at || data.fetched_at || '').replace('T',' ').slice(0,16);
    let html = '';
    const groups = [
      ['直近レース予定・注目', data.upcoming],
      ['過去1週間の主な結果', data.results],
      ['その他ニュース', data.news],
    ];
    groups.forEach(([label, items]) => {
      if (!items || !items.length) return;
      html += '<div class="latest-group"><div class="g-title">' + esc(label) + '</div>';
      items.slice(0, 8).forEach(it => {
        html += '<div class="latest-item"><span class="li-title">' + esc(it.title || '') + '</span>' +
          '<a class="li-src" href="' + esc(it.url || '#') + '" target="_blank" rel="noopener">' + esc(it.source || '') + '</a></div>';
      });
      html += '</div>';
    });
    if (data.ai_text) {
      html += '<div class="latest-ai"><div class="g-title" style="color:#0a84ff;">🤖 AI学習用データ（タップで全選択）</div>' +
        '<textarea readonly onclick="this.select()">' + esc(data.ai_text) + '</textarea></div>';
    }
    body.innerHTML = html;
    card.style.display = 'block';
  }).catch(() => {});
}

/* ---------- レース選択 ---------- */
function populateRaceSelect() {
  const sel = document.getElementById('race-select');
  if (!sel) return;
  const cur = sel.value;
  const opts = [...RACE_PRESETS];
  if (latestData && latestData.upcoming) {
    latestData.upcoming.slice(0, 10).forEach(it => {
      if (it.title && !opts.includes(it.title)) opts.push('【最新】' + it.title);
    });
  }
  sel.innerHTML = opts.map(o => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}
function onRaceSelect() {
  const v = document.getElementById('race-select').value;
  selectedRaceName = (v && !v.startsWith('（')) ? v.replace(/^【最新】/, '') : '';
}
function setBudget(v) {
  document.getElementById('budget').value = v;
  document.querySelectorAll('.quick-btn').forEach(b => b.classList.toggle('active', b.textContent.replace(/,/g,'') === String(v)));
}

/* ---------- 予想ロジック ---------- */
function parseNumList(str) {
  return (str || '').split(/[,、\s]+/).map(s => parseInt(s, 10)).filter(n => n > 0 && n <= 18);
}
function parseHorses(raw) {
  const horses = [];
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    const nums = line.match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return;
    const umaban = parseInt(nums[0], 10);
    if (!(umaban >= 1 && umaban <= 18)) return;
    const odds = parseFloat(nums[nums.length - 1]);
    if (!(odds > 0)) return;
    const name = line.replace(/^\d+\s*/, '').replace(/[\d.,]+\s*$/, '').trim() || ('馬番' + umaban);
    horses.push({umaban, name, odds});
  });
  return horses;
}
function detectRaceName(raw) {
  const m = raw.match(/([^\d\n]{0,15}\d+R[^\d\n]{0,15})/);
  if (m) return m[1].trim();
  const first = raw.split('\n').find(l => l.trim() && !/^\d/.test(l.trim()));
  return first ? first.trim().slice(0, 30) : '';
}
function starStr(conf) {
  return conf >= 90 ? '★★★★★' : conf >= 75 ? '★★★★☆' : conf >= 60 ? '★★★☆☆' : '★★☆☆☆';
}

/* 学習データから馬番の出現回数をカウントしてブースト */
function learningBoostMap(raceName) {
  const boost = {};
  const matched = learnings.filter(l => {
    if (!l.race && !l.text) return false;
    if (!raceName) return true;
    const r = l.race || '';
    return (r && (raceName.includes(r) || r.includes(raceName))) || (l.text || '').includes(raceName);
  });
  const texts = matched.map(l => (l.race ? l.race + ' ' : '') + (l.text || '')).join('\n');
  const nums = texts.match(/(?<!\d)(\d{1,2})(?!\d)/g) || [];
  nums.forEach(n => { const v = parseInt(n, 10); if (v >= 1 && v <= 18) boost[v] = (boost[v] || 0) + 1; });
  return boost;
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function runPredict() {
  const raw = document.getElementById('paste-data').value.trim();
  const raceName = selectedRaceName || detectRaceName(raw) || '選択レース';
  const budget = Math.max(100, Math.round((parseInt(document.getElementById('budget').value) || 3000) / 100) * 100);
  const exclude = new Set(parseNumList(document.getElementById('exclude-horses').value));
  const include = new Set(parseNumList(document.getElementById('include-horses').value));
  const boost = learningBoostMap(raceName);

  let horses = parseHorses(raw).filter(h => !exclude.has(h.umaban));
  let fallback = false;

  if (horses.length >= 3) {
    horses.forEach(h => {
      let s = (1 / h.odds) * (include.has(h.umaban) ? 1.8 : 1);
      if (boost[h.umaban]) s *= 1 + Math.min(boost[h.umaban], 5) * 0.15;
      h.score = s;
    });
    horses.sort((a, b) => b.score - a.score);
  } else {
    /* 出馬表データなし → 学習データ＋レース名シードで参考予想 */
    fallback = true;
    const pool = [];
    for (let n = 1; n <= 18; n++) {
      if (exclude.has(n)) continue;
      let s = ((hashSeed(raceName + ':' + n) % 1000) / 1000);
      if (boost[n]) s += Math.min(boost[n], 5) * 0.15;
      if (include.has(n)) s += 0.3;
      pool.push({umaban: n, name: '馬番' + n, odds: 5.0, score: s});
    }
    pool.sort((a, b) => b.score - a.score);
    horses = pool;
  }
  if (horses.length < 3) { alert('予想に必要なデータが不足しています'); return; }

  const top = horses.slice(0, 3);
  const next3 = horses.slice(3, 6);
  const favOdds = fallback ? 6.0 : top[0].odds;
  const conf = fallback
    ? Math.max(45, Math.min(70, Math.round(70 - favOdds)))
    : Math.max(50, Math.min(98, Math.round(98 - favOdds * 9)));

  const t1 = top[0].umaban + '-' + top[1].umaban;
  const t2 = top[0].umaban + ',' + top[1].umaban + '-' + top[2].umaban;
  const t3 = top[0].umaban + ',' + top[1].umaban + ',' + top[2].umaban + (next3.length ? '-' + next3.map(h=>h.umaban).join(',') : '');
  const tan = top[0].umaban + '→' + top[1].umaban + '→' + top[2].umaban;

  const w1 = Math.round(budget * 0.4 / 100) * 100;
  const w2 = Math.round(budget * 0.2 / 100) * 100;
  const w3 = Math.round(budget * 0.2 / 100) * 100;
  const w4 = Math.max(0, budget - w1 - w2 - w3);
  const budgetText = '馬連 ' + w1 + '円 / 馬単 ' + w2 + '円 / 3連複 ' + w3 + '円 / 3連単 ' + w4 + '円（計 ' + (w1+w2+w3+w4) + '円）';

  document.getElementById('res-race').textContent = raceName + (fallback ? '（参考予想）' : '（' + horses.length + '頭解析）');
  document.getElementById('res-conf').textContent = conf + '%';
  document.getElementById('res-stars').textContent = starStr(conf);
  document.getElementById('res-ticket').textContent = t1;
  document.getElementById('res-waku').textContent = t2;
  document.getElementById('res-renpuku').textContent = t3;
  document.getElementById('res-sanrentan').textContent = tan;
  document.getElementById('res-budget').textContent = budgetText;
  document.getElementById('result-panel').classList.add('show');

  document.getElementById('target-content').textContent = raceName + '：' + t1 + ' / ' + t2 + (fallback ? '（参考）' : '');
  document.getElementById('target-exp').textContent = '期待度 ' + conf + '%';
  document.getElementById('target-stars').textContent = starStr(conf);

  windowLastTickets = 'レース: ' + raceName + (fallback ? '（参考予想）' : '') + '\n馬連 ' + t1 + ' (' + w1 + '円)\n馬単 ' + t2.replace(',', '→') + ' (' + w2 + '円)\n3連複 ' + t3 + ' (' + w3 + '円)\n3連単 ' + tan + ' (' + w4 + '円)';
}

/* ---------- 買い目コピー・結果記録 ---------- */
function copyTickets() {
  if (!windowLastTickets) { alert('買い目がありません。先に予想を実行してください。'); return; }
  const done = () => alert('コピーしました:\n' + windowLastTickets);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(windowLastTickets).then(done).catch(() => fallbackCopy());
  } else { fallbackCopy(); }
  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = windowLastTickets; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
  }
}
function showResultInput() {
  const el = document.getElementById('result-input-area');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function saveResult() {
  const r1 = document.getElementById('in-1st').value.trim();
  const r2 = document.getElementById('in-2nd').value.trim();
  const r3 = document.getElementById('in-3rd').value.trim();
  if (!r1 || !r2 || !r3) { alert('1〜3着を入力してください'); return; }
  predictionsHistory.push({date: new Date().toISOString(), '1st': r1, '2nd': r2, '3rd': r3, tickets: windowLastTickets});
  saveJSON('keiba_predictions', predictionsHistory);
  renderHistory();
  alert('学習記録を保存しました');
  document.getElementById('in-1st').value = '';
  document.getElementById('in-2nd').value = '';
  document.getElementById('in-3rd').value = '';
}
function renderHistory() {
  const box = document.getElementById('history-box');
  if (!box) return;
  if (!predictionsHistory.length) { box.innerHTML = '<div>学習記録はまだありません</div>'; return; }
  box.innerHTML = predictionsHistory.slice(-10).reverse().map(r =>
    '<div>' + esc(new Date(r.date).toLocaleString('ja-JP')) + ' ： ' + esc(r['1st'] || '') + ' → ' + esc(r['2nd'] || '') + ' → ' + esc(r['3rd'] || '') + '</div>'
  ).join('');
}

/* ---------- 学習の記録 ---------- */
function onLearnCategoryChange() {
  const cat = document.getElementById('learn-category').value;
  const venues = LEARN_CATEGORIES[cat].venues;
  const sel = document.getElementById('learn-venue');
  sel.innerHTML = venues.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
}
function saveLearning() {
  const cat = document.getElementById('learn-category').value;
  const venue = document.getElementById('learn-venue').value;
  const race = document.getElementById('learn-race').value.trim();
  const text = document.getElementById('learn-text').value.trim();
  if (!text && !race) { alert('レース名かテキストを入力してください'); return; }
  const rec = {id: Date.now(), category: cat, categoryLabel: LEARN_CATEGORIES[cat].label, venue, race, text, date: new Date().toISOString()};
  if (editingLearnIndex >= 0 && learnings[editingLearnIndex]) {
    learnings[editingLearnIndex] = rec;
    editingLearnIndex = -1;
  } else {
    learnings.push(rec);
  }
  saveJSON('keiba_learnings', learnings);
  document.getElementById('learn-race').value = '';
  document.getElementById('learn-text').value = '';
  renderLearnList();
  alert('AIに覚えさせました（この端末に保存）');
}
function editLearning(id) {
  const i = learnings.findIndex(l => l.id === id);
  if (i < 0) return;
  const l = learnings[i];
  document.getElementById('learn-category').value = l.category;
  onLearnCategoryChange();
  document.getElementById('learn-venue').value = l.venue;
  document.getElementById('learn-race').value = l.race || '';
  document.getElementById('learn-text').value = l.text || '';
  editingLearnIndex = i;
  document.getElementById('panel-learn').scrollIntoView({behavior:'smooth'});
  alert('編集中です。修正後「💾 AIに覚えさせる」で上書き保存されます');
}
function deleteLearning(id) {
  if (!confirm('この学習データを削除しますか？')) return;
  learnings = learnings.filter(l => l.id !== id);
  saveJSON('keiba_learnings', learnings);
  renderLearnList();
}
function renderLearnList() {
  const box = document.getElementById('learn-list');
  if (!box) return;
  if (!learnings.length) { box.innerHTML = '<div>学習データはまだありません</div>'; return; }
  box.innerHTML = learnings.slice().reverse().map(l =>
    '<div class="learn-item">' +
    '<div class="li-head"><span>' + esc(l.categoryLabel) + ' / ' + esc(l.venue) + (l.race ? ' / ' + esc(l.race) : '') + '</span>' +
    '<span class="li-btns"><button class="edit" onclick="editLearning(' + l.id + ')">編集</button>' +
    '<button class="del" onclick="deleteLearning(' + l.id + ')">削除</button></span></div>' +
    '<div class="li-meta">' + esc(new Date(l.date).toLocaleString('ja-JP')) + '</div>' +
    (l.text ? '<div class="li-text">' + esc(l.text.slice(0, 200)) + (l.text.length > 200 ? '…' : '') + '</div>' : '') +
    '</div>'
  ).join('');
}

/* ---------- ばんえいメモ ---------- */
function saveBaneiMemo() {
  const v = document.getElementById('banei-memo').value.trim();
  localStorage.setItem('keiba_banei_memo', v);
  document.getElementById('banei-memo-view').textContent = v || '（メモなし）';
  alert('メモを保存しました');
}

/* ---------- カウンター ---------- */
const COUNT_BASE = 'https://countapi.mileshilliard.com/api/v1';
const COUNT_KEY_TOTAL = 'keiba_elizabeth_viewer_total';
function todayKey() {
  const d = new Date();
  return 'keiba_elizabeth_viewer_' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
}
function countReq(path, key) {
  return fetch(COUNT_BASE + '/' + path + '/' + key, {mode: 'cors'}).then(r => r.json()).catch(() => null);
}
function initCounter() {
  const el = document.getElementById('view-count');
  if (!el) return;
  Promise.all([countReq('hit', COUNT_KEY_TOTAL), countReq('hit', todayKey())]).then(() =>
    Promise.all([countReq('get', COUNT_KEY_TOTAL), countReq('get', todayKey())])
  ).then(([t, d]) => {
    const total = t && t.value ? parseInt(t.value, 10) : 0;
    const today = d && d.value ? parseInt(d.value, 10) : 0;
    if (total > 0) el.textContent = '👀 閲覧数：累計 ' + total + '回（本日 ' + today + '回）';
  }).catch(() => {});
}

/* ---------- イベント委譲 ---------- */
document.addEventListener('click', function(e) {
  const nameEl = e.target.closest('.venue-name');
  if (nameEl) { toggleVenueDetail(nameEl.dataset.v); return; }
  const favEl = e.target.closest('.fav-star');
  if (favEl) { venueAction(favEl.dataset.v, 'fav'); return; }
  const togEl = e.target.closest('.toggle');
  if (togEl) { venueAction(togEl.dataset.v, 'toggle'); return; }
  const btnEl = e.target.closest('.memo-inputs button');
  if (btnEl) { venueAction(btnEl.dataset.v, btnEl.classList.contains('del') ? 'del' : 'save'); return; }
});

/* ---------- 初期化 ---------- */
venueData = loadJSON('keiba_venue_data', {});
venueToggles = loadJSON('keiba_venue_toggles', {});
predictionsHistory = loadJSON('keiba_predictions', []);
learnings = loadJSON('keiba_learnings', []);
const baneiMemo = localStorage.getItem('keiba_banei_memo') || '';
if (baneiMemo && document.getElementById('banei-memo-view')) {
  document.getElementById('banei-memo-view').textContent = baneiMemo;
}

renderG1();
buildVenues();
renderHistory();
renderLearnList();
onLearnCategoryChange();
populateRaceSelect();
initCounter();
loadLatest();
