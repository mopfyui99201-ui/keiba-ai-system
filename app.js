/* app.js - 競馬AI予想（閲覧用）ロジック */
'use strict';

const JRA_VENUES = ["東京","中山","京都","阪神","中京","新潟","福島","小倉","函館","札幌"];
const NAR_VENUES = ["大井","川崎","船橋","浦和","門別","盛岡","水沢","金沢","笠松","名古屋","園田","姫路","高知","佐賀"];
const BANEI_VENUES = ["帯広(ばんえい)"];
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
let windowLastPred = null;
let selectedRaceName = '';
let editingLearnIndex = -1;
let reflections = [];
let stationItems = [];
let condTrack = '良';
let condDist = '';
const pct = v => Math.min(100, Math.max(0, Math.round(v)));

/* ---------- 状態保存 ---------- */
function loadJSON(key, fb) {
  try { return JSON.parse(localStorage.getItem(key) || fb); } catch(e) { return fb; }
}
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- 画面遷移（ホーム＋各専用画面） ---------- */
const SCREEN_TITLES = {
  home: '', events: '大型イベント', jra: '中央競馬', nar: '地方競馬',
  banei: '特殊競馬', predict: 'AI予想・買い目', learn: '学習の記録',
};
function setTab(tab) {
  tab = tab || 'home';
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel-' + tab);
  });
  const isHome = (tab === 'home');
  const back = document.getElementById('back-btn');
  if (back) back.style.display = isHome ? 'none' : 'inline-block';
  const sub = document.getElementById('app-sub');
  if (sub) sub.textContent = isHome ? '' : (SCREEN_TITLES[tab] || '');
  if (tab === 'learn') renderLearningGraph();
  window.scrollTo({top: 0});
}
function goHome() { setTab('home'); }
function toggleManual() {
  const el = document.getElementById('manual-overlay');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
  const baneiGrid = document.getElementById('banei-venues');
  if (!jraGrid || !narGrid) return;
  jraGrid.innerHTML = ''; narGrid.innerHTML = '';
  if (baneiGrid) baneiGrid.innerHTML = '';
  [...JRA_VENUES, ...NAR_VENUES, ...BANEI_VENUES].forEach(v => {
    const isJRA = JRA_VENUES.includes(v);
    const isBanei = BANEI_VENUES.includes(v);
    const d = venueData[v] || {};
    const events = VENUE_EVENTS[v] || [];
    const mainEvent = events[0] || '通常開催';
    const allEvents = events.join(' / ') || 'なし';
    const favOn = venueToggles[v] === true;
    const grid = isJRA ? jraGrid : (isBanei ? baneiGrid : narGrid);
    const row = document.createElement('div');
    row.className = 'venue-row';
    row.innerHTML =
      '<span class="venue-name" data-v="' + esc(v) + '">' + esc(v) + '</span>' +
      '<span class="venue-event"><span class="ev-star' + (d.favorite ? ' on' : '') + '">★</span>' + esc(mainEvent) + '</span>' +
      '<span class="fav-star' + (d.favorite ? ' on' : '') + '" data-v="' + esc(v) + '">★</span>' +
      '<div class="toggle' + (favOn ? ' active' : '') + '" data-v="' + esc(v) + '"></div>';
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
    venueToggles[v] = venueToggles[v] === true ? false : true;
    saveJSON('keiba_venue_toggles', venueToggles);
    const el = document.querySelector('.toggle[data-v="' + v + '"]');
    if (el) el.classList.toggle('active', venueToggles[v] === true);
    renderFavorites();
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

/* ---------- お気に入り一覧 ---------- */
function renderFavorites() {
  const groups = [
    ['fav-jra', JRA_VENUES],
    ['fav-nar', NAR_VENUES],
    ['fav-banei', BANEI_VENUES],
  ];
  const allFavs = [...JRA_VENUES, ...NAR_VENUES, ...BANEI_VENUES].filter(v => venueToggles[v] === true);
  const homeBox = document.getElementById('fav-home');
  if (homeBox) {
    if (!allFavs.length) {
      homeBox.innerHTML = '<div class="fav-empty">お気に入りはまだありません（各競馬場のトグルをONにすると登録されます）</div>';
    } else {
      homeBox.innerHTML = allFavs.map(v => {
        const mainEvent = (VENUE_EVENTS[v] || [])[0] || 'メイン競走';
        const genre = JRA_VENUES.includes(v) ? '🏇' : (BANEI_VENUES.includes(v) ? '🛷' : '🐎');
        return '<div class="fav-item">' +
          '<span style="font-size:13px;">' + genre + '</span>' +
          '<span class="fav-name">' + esc(v) + '</span>' +
          '<span class="fav-event">' + esc(mainEvent) + '</span>' +
          '<button class="go" onclick="goPredict(\'' + esc(v).replace(/'/g, "\\'") + '\')">🎯 予想する</button>' +
          '<button class="unfav" onclick="venueAction(\'' + esc(v).replace(/'/g, "\\'") + '\', \'toggle\')">解除</button>' +
          '</div>';
      }).join('');
    }
  }
  groups.forEach(([id, venues]) => {
    const box = document.getElementById(id);
    if (!box) return;
    const favs = venues.filter(v => venueToggles[v] === true);
    if (!favs.length) { box.innerHTML = '<div class="fav-empty">お気に入りはまだありません（各競馬場のトグルをONにすると登録されます）</div>'; return; }
    box.innerHTML = favs.map(v => {
      const mainEvent = (VENUE_EVENTS[v] || [])[0] || 'メイン競走';
      return '<div class="fav-item">' +
        '<span class="fav-name">' + esc(v) + '</span>' +
        '<span class="fav-event">' + esc(mainEvent) + '</span>' +
        '<button class="go" onclick="goPredict(\'' + esc(v).replace(/'/g, "\\'") + '\')">🎯 予想する</button>' +
        '<button class="unfav" onclick="venueAction(\'' + esc(v).replace(/'/g, "\\'") + '\', \'toggle\')">解除</button>' +
        '</div>';
    }).join('');
  });
}
function goPredict(venue) {
  initVenueRaceSelects();
  const vs = document.getElementById('venue-select');
  const rs = document.getElementById('race-select');
  if (vs && rs) {
    vs.value = venue;
    rs.value = '11';
    onVenueRaceChange();
  }
  setTab('predict');
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
    const synced = (data.synced_at || data.fetched_at || '').replace('T', ' ').slice(0, 16);
    // ジャンル別に各タブの最新情報カードへ振り分け
    const CARDS = {
      large_event: ['latest-card', 'latest-body', 'latest-time'],
      jra: ['latest-jra', 'latest-body-jra', 'latest-time-jra'],
      local: ['latest-nar', 'latest-body-nar', 'latest-time-nar'],
      banei: ['latest-banei', 'latest-body-banei', 'latest-time-banei'],
    };
    const allItems = [];
    [['直近レース予定・注目', data.upcoming], ['過去1週間の主な結果', data.results], ['その他ニュース', data.news]]
      .forEach(([label, items]) => (items || []).forEach(it => allItems.push({sec: label, it})));
    Object.keys(CARDS).forEach(genre => {
      const [cid, bid, tid] = CARDS[genre];
      const c = document.getElementById(cid);
      if (!c) return;
      const mine = allItems.filter(x => (x.it.genre || 'jra') === genre);
      const hasAi = (genre === 'large_event' && !!data.ai_text);
      if (!mine.length && !hasAi) { c.style.display = 'none'; return; }
      const te = document.getElementById(tid);
      if (te) te.textContent = '更新: ' + synced;
      const be = document.getElementById(bid);
      let html = '';
      [['直近レース予定・注目', 'upcoming'], ['過去1週間の主な結果', 'result'], ['その他ニュース', 'news']].forEach(([label]) => {
        const items = mine.filter(x => x.sec === label);
        if (!items.length) return;
        html += '<div class="latest-group"><div class="g-title">' + esc(label) + '</div>';
        items.slice(0, 8).forEach(x => {
          const it = x.it;
          html += '<div class="latest-item"><span class="li-title">' + esc(it.title || '') + '</span>' +
            '<a class="li-src" href="' + esc(it.url || '#') + '" target="_blank" rel="noopener">' + esc(it.source || '') + '</a>';
          if (it.detail && it.detail.entries && it.detail.entries.length) {
            html += '<div style="font-size:10px;color:#8e8e93;margin-top:2px;">' +
              it.detail.entries.slice(0, 3).map(e =>
                (e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank + '着') + ' ' + esc(e.name || '') +
                (e.last3f ? ' 上り' + esc(e.last3f) : '')).join(' ／ ') + '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
      be.innerHTML = html;
      c.style.display = 'block';
    });
    // 大型イベントカードにAI学習テキストを添付
    if (data.ai_text) {
      body.innerHTML += '<div class="latest-ai"><div class="g-title" style="color:#0a84ff;">🤖 AI学習用データ（タップで全選択）</div>' +
        '<textarea readonly onclick="this.select()">' + esc(data.ai_text) + '</textarea></div>';
    }
    if (timeEl) timeEl.textContent = '更新: ' + synced;
  }).catch(() => {});
}

/* ---------- レース選択（競馬場 → レース番号 → クイック選択） ---------- */
let extNews = loadJSON('keiba_ext_news', []);

const VENUE_GROUPS = [
  {label:'🏇 中央競馬（JRA）', venues:JRA_VENUES},
  {label:'🐎 地方競馬（NAR）', venues:NAR_VENUES},
  {label:'🛷 特殊競馬',        venues:BANEI_VENUES},
];

function initVenueRaceSelects() {
  const vs = document.getElementById('venue-select');
  const rs = document.getElementById('race-select');
  if (vs && !vs.options.length) {
    vs.innerHTML = '<option value="">（競馬場を選択）</option>' +
      VENUE_GROUPS.map(g =>
        '<optgroup label="' + esc(g.label) + '">' +
        g.venues.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('') +
        '</optgroup>').join('');
  }
  if (rs && !rs.options.length) {
    rs.innerHTML = '<option value="">（レース番号を選択）</option>' +
      Array.from({length:12}, (_,i) => {
        const n = i + 1;
        const label = n === 11 ? '11R（メイン）' : n === 12 ? '12R（最終）' : n + 'R';
        return '<option value="' + n + '">' + label + '</option>';
      }).join('');
  }
}

function onVenueRaceChange() {
  const vs = document.getElementById('venue-select');
  const rs = document.getElementById('race-select');
  if (!vs || !rs) return;
  const venue = vs.value;
  const num = rs.value;
  if (!venue || !num) { selectedRaceName = ''; return; }
  let label = venue + num + 'R';
  if (num === '11') label += ' メイン';
  else if (num === '12') label += ' 最終';
  selectedRaceName = label;
}

function populateRaceSelect() { populateQuickSelect(); }

function populateQuickSelect() {
  const sel = document.getElementById('quick-select');
  if (!sel) return;
  const cur = sel.value;
  const opts = ['（注目・最新レースを選択）'];
  RACE_PRESETS.slice(1).forEach(t => { if (!opts.includes(t)) opts.push(t); });
  if (latestData && latestData.upcoming) {
    latestData.upcoming.slice(0, 10).forEach(it => {
      if (it.title && !opts.includes('【最新】' + it.title)) opts.push('【最新】' + it.title);
    });
  }
  (extNews || []).slice(0, 10).forEach(it => {
    if (it.title && !opts.includes('【外部】' + it.title)) opts.push('【外部】' + it.title);
  });
  sel.innerHTML = opts.map(o => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function onQuickSelect() {
  const sel = document.getElementById('quick-select');
  const v = sel ? sel.value : '';
  if (!v || v.startsWith('（')) return;
  selectedRaceName = v.replace(/^【(?:最新|外部)】/, '');
  // 可能なら競馬場・レース番号セレクトも同期（表示のみ、選択名は保持）
  const m = selectedRaceName.match(/^(東京|中山|京都|阪神|中京|新潟|福島|小倉|函館|札幌|大井|川崎|船橋|浦和|門別|盛岡|水沢|金沢|笠松|名古屋|園田|姫路|高知|佐賀|帯広(?:\(ばんえい\)|（ばんえい）)?)\s*(\d{1,2})R?/);
  if (m) {
    const vs = document.getElementById('venue-select');
    const rs = document.getElementById('race-select');
    if (vs && rs) {
      const venue = m[1].includes('帯広') ? '帯広(ばんえい)' : m[1];
      const num = String(parseInt(m[2], 10));
      if ([...vs.options].some(o => o.value === venue) && [...rs.options].some(o => o.value === num)) {
        vs.value = venue;
        rs.value = num;
      }
    }
  }
}

/* ---------- 外部情報取得（公開RSS＋CORSプロキシ、失敗時は同期データ） ---------- */
function setExtStatus(msg) {
  const a = document.getElementById('ext-status');
  const b = document.getElementById('ext-status-home');
  if (a) a.textContent = msg;
  if (b) b.textContent = msg;
}
function parseRssXmlItems(xml) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const nodes = doc.getElementsByTagName('item');
    const out = [];
    for (let i = 0; i < Math.min(nodes.length, 20); i++) {
      const it = nodes[i];
      out.push({
        title: (it.getElementsByTagName('title')[0] || {}).textContent || '',
        link: (it.getElementsByTagName('link')[0] || {}).textContent || '',
        date: ((it.getElementsByTagName('pubDate')[0] || {}).textContent || '').slice(0, 16),
      });
    }
    return out;
  } catch (e) { return []; }
}
async function fetchExternalNews() {
  setExtStatus('取得中…');
  const feedUrl = 'https://rss.netkeiba.com/?pid=rss_netkeiba&site=netkeiba';
  const DEDICATED_PROXY = 'https://sparkling-firefly-4550.mopfyui99201.workers.dev?url=';
  const sources = [
    {type:'worker', url:DEDICATED_PROXY + encodeURIComponent(feedUrl)},
    {type:'json', url:'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl)},
    {type:'xml',  url:'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(feedUrl)},
  ];
  let items = [];
  for (const s of sources) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(s.url, {signal: ctrl.signal});
      clearTimeout(timer);
      if (!res.ok) continue;
      if (s.type === 'json') {
        const j = await res.json();
        if (j && j.status === 'ok' && Array.isArray(j.items)) {
          items = j.items.slice(0, 20).map(it => ({
            title: it.title || '', link: it.link || '',
            date: (it.pubDate || '').slice(0, 16),
          }));
        }
      } else {
        // worker / codetabs はRSS XMLをそのまま返す
        items = parseRssXmlItems(await res.text());
      }
      if (items.length) break;
    } catch (e) { /* 次のソースへフォールバック */ }
  }
  const NG = ['ビール','キャンペーン','グッズ','プレゼント','求人','採用','コラボ','入場券','トークショー','テレビ','ラジオ'];
  const filtered = items.filter(it => it.title && it.title.length > 5 && !NG.some(w => it.title.includes(w)));
  if (!filtered.length) {
    setExtStatus('⚠️ 外部取得に失敗（同期データを表示中）');
    populateQuickSelect();
    return;
  }
  extNews = filtered.map(it => ({
    title: it.title, url: it.link || '', date: it.date || '',
    source: 'netkeiba(外部)', kind: 'news', genre: 'jra',
  }));
  saveJSON('keiba_ext_news', extNews);
  setExtStatus('✅ ' + extNews.length + '件取得（' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'}) + '）');
  populateQuickSelect();
}

/* 予想の根拠となる外部/同期ニュースを抽出 */
function evidenceFor(raceName) {
  if (!raceName) return [];
  const key = raceName.replace(/（メイン）|\(メイン\)|最終/g, '').trim();
  const pool = [];
  (extNews || []).forEach(it => pool.push(it.title));
  if (latestData) {
    ['upcoming','results','news'].forEach(k => (latestData[k] || []).forEach(it => { if (it.title) pool.push(it.title); }));
  }
  const words = key.split(/\s+/).filter(w => w.length >= 2);
  return pool.filter(t => words.some(w => t.includes(w))).slice(0, 2);
}
function setBudget(v) {
  document.getElementById('budget').value = v;
  document.querySelectorAll('.quick-btn').forEach(b => b.classList.toggle('active', b.textContent.replace(/,/g,'') === String(v)));
}
function setCond(group, btn) {
  const box = document.getElementById(group === 'track' ? 'cond-track' : 'cond-dist');
  if (!box) return;
  const v = btn.dataset.v;
  // 距離はトグル式（同じボタン再タップで解除）
  if (group === 'dist' && condDist === v) {
    btn.classList.remove('active');
    condDist = '';
    return;
  }
  box.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  if (group === 'track') condTrack = v; else condDist = v;
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
  // 鮮度重み付け：直近30日以内の学習データは重み2倍
  const now = Date.now();
  matched.forEach(l => {
    const ageDays = (now - new Date(l.date || 0).getTime()) / 86400000;
    const w = ageDays <= 30 ? 2 : 1;
    const text = (l.race ? l.race + ' ' : '') + (l.text || '');
    const nums = text.match(/(?<!\d)(\d{1,2})(?!\d)/g) || [];
    nums.forEach(n => { const v = parseInt(n, 10); if (v >= 1 && v <= 18) boost[v] = (boost[v] || 0) + w; });
  });
  // 答え合わせ結果（同じ競馬場・関連レースの実際の3着内馬）もブースト
  const venue = venueOfRace(raceName);
  reflections.forEach(r => {
    if (venue && r.venue !== venue) return;
    if (raceName && r.race && !(raceName.includes(r.race) || r.race.includes(raceName))) return;
    (r.top3 || []).forEach(n => { if (n >= 1 && n <= 18) boost[n] = (boost[n] || 0) + 2; });
  });
  return boost;
}
function venueOfRace(raceName) {
  if (!raceName) return '';
  const all = [...JRA_VENUES, ...NAR_VENUES, ...BANEI_VENUES];
  return all.find(v => raceName.includes(v)) || '';
}
function categoryOfVenue(venue) {
  if (JRA_VENUES.includes(venue)) return 'jra';
  if (NAR_VENUES.includes(venue)) return 'nar';
  if (BANEI_VENUES.includes(venue)) return 'banei';
  return 'g1';
}
/* 馬場状態・距離条件に合致する学習データから馬番ブーストを生成 */
const COND_KEYWORDS = {
  track: { '良': ['良馬場', '馬場良'], '稍重': ['稍重'], '重': ['重馬場', '馬場が重', '馬場重'], '不良': ['不良馬場', '馬場不良', '不良'] },
  dist:  { '短距離': ['短距離', '1400m', '1200m', '1000m'], 'マイル': ['マイル', '1600m'], '中距離': ['中距離', '1800m', '2000m', '2200m'], '長距離': ['長距離', '2400m', '2500m', '3000m'] },
};
function conditionBoostMap() {
  const boost = {};
  const kws = [];
  if (condTrack && condTrack !== '良') kws.push(...(COND_KEYWORDS.track[condTrack] || []));
  if (condTrack === '良') kws.push('良馬場', '馬場良');
  if (condDist) kws.push(...(COND_KEYWORDS.dist[condDist] || []));
  if (!kws.length) return boost;
  const now = Date.now();
  learnings.forEach(l => {
    const text = ((l.race || '') + ' ' + (l.text || ''));
    if (!kws.some(k => text.includes(k))) return;
    const ageDays = (now - new Date(l.date || 0).getTime()) / 86400000;
    const w = (ageDays <= 30 ? 2 : 1) + 1; // 条件一致はさらに+1
    const nums = text.match(/(?<!\d)(\d{1,2})(?!\d)/g) || [];
    nums.forEach(n => { const v = parseInt(n, 10); if (v >= 1 && v <= 18) boost[v] = (boost[v] || 0) + w; });
  });
  return boost;
}
function conditionEvidence() {
  const kws = [];
  if (condTrack === '良') kws.push('良馬場', '馬場良');
  else if (condTrack) kws.push(...(COND_KEYWORDS.track[condTrack] || []));
  if (condDist) kws.push(...(COND_KEYWORDS.dist[condDist] || []));
  if (!kws.length) return '';
  const hit = learnings.find(l => kws.some(k => ((l.race || '') + ' ' + (l.text || '')).includes(k)));
  return hit ? ('条件一致: ' + (hit.race || hit.text || '').slice(0, 30)) : '';
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
  const cboost = conditionBoostMap();
  Object.keys(cboost).forEach(k => { boost[k] = (boost[k] || 0) + cboost[k]; });

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
  const conf = pct(fallback
    ? Math.max(45, Math.min(70, Math.round(70 - favOdds)))
    : Math.max(50, Math.min(98, Math.round(98 - favOdds * 9))));

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
  const ev = evidenceFor(raceName);
  const cev = conditionEvidence();
  if (cev && !ev.includes(cev)) ev.push(cev);
  const evEl = document.getElementById('res-evidence');
  if (evEl) evEl.textContent = ev.length ? ev.join(' ／ ') : '-';
  document.getElementById('result-panel').classList.add('show');

  document.getElementById('target-content').textContent = raceName + '：' + t1 + ' / ' + t2 + (fallback ? '（参考）' : '');
  document.getElementById('target-exp').textContent = '期待度 ' + conf + '%';
  document.getElementById('target-stars').textContent = starStr(conf);

  windowLastTickets = 'レース: ' + raceName + (fallback ? '（参考予想）' : '') + '\n馬連 ' + t1 + ' (' + w1 + '円)\n馬単 ' + t2.replace(',', '→') + ' (' + w2 + '円)\n3連複 ' + t3 + ' (' + w3 + '円)\n3連単 ' + tan + ' (' + w4 + '円)';
  windowLastPred = {
    raceName, venue: venueOfRace(raceName), budget, fallback,
    top: [top[0].umaban, top[1].umaban, top[2].umaban],
    next3: next3.map(h => h.umaban),
    umaren: [top[0].umaban, top[1].umaban],
    umatan: [top[0].umaban, top[1].umaban, top[2].umaban],
    sanrenpuku: [top[0].umaban, top[1].umaban, top[2].umaban],
    sanrentan: [top[0].umaban, top[1].umaban, top[2].umaban],
  };
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
function shareResult() {
  if (!windowLastTickets && !reflections.length) { alert('シェアするデータがありません'); return; }
  const stats = learnStats();
  const pnl = pnlSummary();
  const last = reflections[reflections.length - 1];
  const lines = ['🎯 競馬AI予想 的中・成長実績レポート', ''];
  if (last) {
    lines.push('📍 レース: ' + (last.race || '-'));
    lines.push('🥇 実際の着順: ' + last.actualTop3.join(' → ') + '着');
    const hitTxt = [last.hits.umaren && '馬連', last.hits.umatan && '馬単', last.hits.sanrenpuku && '3連複', last.hits.sanrentan && '3連単'].filter(Boolean).join('・') || '不的中';
    lines.push('🎯 的中券種: ' + hitTxt);
    lines.push('💰 収支: ' + (last.profit >= 0 ? '+' : '') + last.profit.toLocaleString() + '円（投資' + (last.invested || 0).toLocaleString() + '円 → 払戻' + (last.payout || 0).toLocaleString() + '円）');
    lines.push('💡 AIの学び: ' + (last.lesson || '-'));
    lines.push('');
  }
  if (windowLastTickets) lines.push(windowLastTickets, '');
  lines.push('🤖 AIレベル: Lv.' + stats.lv + '（学習スコア ' + Math.round(stats.score) + '）');
  if (pnl.count) lines.push('📊 通算: 的中率 ' + pct(pnl.hitRate) + '% / 回収率 ' + pct(pnl.recovery) + '% / 収支 ' + (pnl.profit >= 0 ? '+' : '') + pnl.profit.toLocaleString() + '円（' + pnl.count + 'レース）');
  lines.push('', '― 競馬AI予想 Elizabeth ―');
  const text = lines.join('\n');
  const done = () => alert('📤 シェア用テキストをコピーしました:\n\n' + text.slice(0, 200) + (text.length > 200 ? '…' : ''));
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy());
  } else { fallbackCopy(); }
  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
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
    // 重複登録防止：同じカテゴリ・場・レース名が既にあればスキップ
    const dup = learnings.some(l => l.category === rec.category && l.venue === rec.venue && (l.race || '') === rec.race && rec.race);
    if (dup) { alert('同じレースの学習データが既に登録されています（重複スキップ）'); return; }
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

/* ---------- 答え合わせ（予想 vs 実結果） ---------- */
function answerCheck() {
  if (!windowLastPred) { alert('先にAI予想を実行してください'); return; }
  const area = document.getElementById('result-input-area');
  area.style.display = 'block';
  // 同期データから該当レースの結果を自動取得を試みる
  const key = (windowLastPred.raceName || '').replace(/（メイン）|\(メイン\)|最終/g, '').trim();
  const words = key.split(/\s+/).filter(w => w.length >= 2);
  let found = null;
  if (latestData && latestData.results) {
    found = latestData.results.find(it => {
      const t = it.title || '';
      return words.length && words.some(w => t.includes(w)) && it.detail && it.detail.entries && it.detail.entries.length >= 3;
    });
  }
  if (found) {
    const e = found.detail.entries;
    const byRank = r => (e.find(x => x.rank === r) || {});
    document.getElementById('in-1st').value = byRank(1).umaban || '';
    document.getElementById('in-2nd').value = byRank(2).umaban || '';
    document.getElementById('in-3rd').value = byRank(3).umaban || '';
    alert('📥 同期データから結果を自動入力しました。内容を確認して「💾 結果を保存」を押してください');
  } else {
    alert('自動取得できませんでした。実際の1着〜3着の馬番と払戻金額を入力してください');
  }
}
function saveAnswerCheck() {
  const a1 = parseInt(document.getElementById('in-1st').value, 10);
  const a2 = parseInt(document.getElementById('in-2nd').value, 10);
  const a3 = parseInt(document.getElementById('in-3rd').value, 10);
  const payout = parseInt((document.getElementById('in-payout').value || '0').replace(/[^\d]/g, ''), 10) || 0;
  if (!(a1 > 0 && a2 > 0 && a3 > 0)) { alert('1着〜3着の馬番を入力してください'); return; }
  const pred = windowLastPred;
  if (!pred) { alert('先にAI予想を実行してください'); return; }
  const invested = pred.budget || 3000;
  const p = pred.top;
  const hits = {
    umaren:    (a1 === p[0] && a2 === p[1]) || (a1 === p[1] && a2 === p[0]),
    umatan:    a1 === p[0] && a2 === p[1],
    sanrenpuku: [a1,a2,a3].sort((x,y)=>x-y).join(',') === [...p].sort((x,y)=>x-y).join(','),
    sanrentan:  a1 === p[0] && a2 === p[1] && a3 === p[2],
  };
  const anyHit = Object.values(hits).some(Boolean);
  const profit = payout - invested;
  // 反省レッスン自動生成
  const lessons = [];
  if (a1 !== p[0]) lessons.push('本命馬(' + p[0] + '番)が1着にならず→人気馬過剰評価の補正が必要');
  if (![a1,a2,a3].some(n => p.includes(n))) lessons.push('3着内に予想馬なし→穴馬・差し馬の重み付けを強化');
  else if (a3 === p[2] && a1 !== p[0]) lessons.push('3着は的中圏内→上位評価は概ね正しく着順の入れ替わりに注意');
  if (anyHit) lessons.push('的中あり→この予想パターンを継続学習');
  if (!lessons.length) lessons.push('僅差の結果→微調整レベル');
  const lesson = lessons.join('／');
  const rec = {
    id: Date.now(), date: new Date().toISOString(),
    race: pred.raceName, venue: pred.venue || venueOfRace(pred.raceName),
    predTop3: p, actualTop3: [a1,a2,a3], invested, payout, profit,
    hits, anyHit, lesson,
  };
  reflections.push(rec);
  saveJSON('keiba_reflections', reflections);
  // 学習データとしても登録（同場・同条件の予想に反映）
  const cat = categoryOfVenue(rec.venue) || 'jra';
  learnings.push({
    id: Date.now() + 1, category: cat, categoryLabel: LEARN_CATEGORIES[cat] ? LEARN_CATEGORIES[cat].label : cat,
    venue: rec.venue || '（指定なし）', race: rec.race,
    text: '【答え合わせ ' + new Date().toLocaleDateString('ja-JP') + '】実際 ' + a1 + '→' + a2 + '→' + a3 + '着 / ' + lesson + (payout ? ' / 払戻' + payout + '円' : ''),
    date: new Date().toISOString(),
  });
  saveJSON('keiba_learnings', learnings);
  predictionsHistory.push({date: new Date().toISOString(), '1st': String(a1), '2nd': String(a2), '3rd': String(a3), tickets: windowLastTickets, payout});
  saveJSON('keiba_predictions', predictionsHistory);
  renderLearnList(); renderHistory(); renderLearningGraph();
  const hitTxt = [hits.umaren && '馬連', hits.umatan && '馬単', hits.sanrenpuku && '3連複', hits.sanrentan && '3連単'].filter(Boolean).join('・') || '不的中';
  alert((anyHit ? '🎉 的中！（' + hitTxt + '）' : '😢 不的中') + '\n収支: ' + (profit >= 0 ? '+' : '') + profit + '円\n💡 ' + lesson);
  ['in-1st','in-2nd','in-3rd','in-payout'].forEach(id => document.getElementById(id).value = '');
}
function pnlSummary() {
  const invested = reflections.reduce((s,r) => s + (r.invested || 0), 0);
  const payout = reflections.reduce((s,r) => s + (r.payout || 0), 0);
  const hits = reflections.filter(r => r.anyHit).length;
  const n = reflections.length;
  return {
    invested, payout, profit: payout - invested,
    hitRate: pct(n ? hits / n * 100 : 0),
    recovery: pct(invested ? payout / invested * 100 : 0),
    count: n,
  };
}

/* ---------- 外部データ取得・AI学習ステーション ---------- */
const STATION_VENUES = [...JRA_VENUES, ...NAR_VENUES, ...BANEI_VENUES];
function initStationSelects() {
  const vs = document.getElementById('station-venue');
  if (vs && !vs.options.length) {
    vs.innerHTML = '<option value="">（全場対象）</option>' +
      ['🏇 中央競馬','🐎 地方競馬','🛷 特殊競馬'].map(g => {
        const list = g.includes('中央') ? JRA_VENUES : g.includes('地方') ? NAR_VENUES : BANEI_VENUES;
        return '<optgroup label="' + g + '">' + list.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('') + '</optgroup>';
      }).join('');
  }
}
function onStationTargetChange() {
  // 対象ジャンルに応じて競馬場セレクトの有効/無効を簡易表示
  const t = document.getElementById('station-target').value;
  const vs = document.getElementById('station-venue');
  if (vs) vs.disabled = (t === 'all');
}
function classifyStationKind(title) {
  if (/結果|着順|払戻|確定|人気|タイム/.test(title)) return 'results';
  if (/予定|枠順|出走|開催|競走|レース/.test(title)) return 'upcoming';
  return 'news';
}
function stationQueries(target, range) {
  const suf = range === 'results' ? ' 結果' : range === 'upcoming' ? ' 開催' : '';
  const base = {
    all:   ['競馬 重賞' + suf, '地方競馬' + suf, 'ばんえい競馬' + suf, 'JRA 競馬' + suf],
    g1:    ['競馬 重賞' + suf, 'G1 競馬' + suf],
    jra:   ['JRA 競馬' + suf, '中央競馬' + suf],
    nar:   ['地方競馬' + suf, 'NAR 競馬' + suf],
    banei: ['ばんえい競馬' + suf, '帯広 競馬' + suf],
  };
  return base[target] || base.all;
}
async function fetchGoogleNewsItems(q) {
  const gUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ja&gl=JP&ceid=JP:ja';
  const DEDICATED_PROXY = 'https://sparkling-firefly-4550.mopfyui99201.workers.dev?url=';
  const proxies = [
    {worker: true,  url: DEDICATED_PROXY + encodeURIComponent(gUrl)},
    {worker: false, url: 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(gUrl)},
    {worker: false, url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(gUrl)},
  ];
  for (const px of proxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(px.url, {signal: ctrl.signal});
      clearTimeout(timer);
      if (!res.ok) continue;
      if (px.worker || px.url.includes('codetabs')) {
        const items = parseRssXmlItems(await res.text());
        if (items.length) return items.slice(0, 10);
      } else {
        const j = await res.json();
        if (j && j.status === 'ok' && Array.isArray(j.items)) {
          return j.items.slice(0, 10).map(it => ({title: it.title || '', link: it.link || '', date: (it.pubDate || '').slice(0, 16)}));
        }
      }
    } catch (e) { /* 次のプロキシへ */ }
  }
  return [];
}
/* 内蔵DB（ビッグレース・場別メインレース・コース傾向）からのフォールバック項目 */
function builtinStationItems(target, venue, range) {
  const items = [];
  const kind = range === 'results' ? 'results' : 'upcoming';
  const want = target === 'all' ? ['g1', 'jra', 'nar', 'banei'] : [target];
  if (want.includes('g1')) {
    BIG_RACES.forEach(r => items.push({
      title: '【内蔵DB】' + r.name + '（' + r.meta + '・年間ビッグレース）',
      link: r.url || '', date: '', kind, builtin: true,
    }));
  }
  const venueList = venue ? [venue] : [...JRA_VENUES, ...NAR_VENUES, ...BANEI_VENUES];
  venueList.forEach(v => {
    const cat = categoryOfVenue(v);
    if (!want.includes(cat)) return;
    const ev = (VENUE_EVENTS[v] || [])[0];
    items.push({
      title: '【内蔵DB】' + v + (ev ? ' ' + ev : '') + '（年間メインレース・開催時期と馬場傾向は要確認）',
      link: 'https://www.jra.go.jp/keiba/', date: '', kind, builtin: true,
    });
    if ((VENUE_EVENTS[v] || []).length > 1) {
      items.push({
        title: '【内蔵DB】' + v + ' ' + VENUE_EVENTS[v][1] + '（サブ重賞・過去傾向データ）',
        link: 'https://www.jra.go.jp/keiba/', date: '', kind, builtin: true,
      });
    }
  });
  return items;
}
async function fetchStationData() {
  const st = document.getElementById('station-status');
  const setSt = m => { if (st) st.textContent = m; };
  const target = document.getElementById('station-target').value;
  const venue = document.getElementById('station-venue').value;
  const range = document.getElementById('station-range').value;
  setSt('取得中…');
  const feedUrl = 'https://rss.netkeiba.com/?pid=rss_netkeiba&site=netkeiba';
  const DEDICATED_PROXY = 'https://sparkling-firefly-4550.mopfyui99201.workers.dev?url=';
  const sources = [
    {type:'worker', url:DEDICATED_PROXY + encodeURIComponent(feedUrl)},
    {type:'json', url:'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl)},
    {type:'xml',  url:'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(feedUrl)},
  ];
  let raw = [];
  for (const s of sources) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(s.url, {signal: ctrl.signal});
      clearTimeout(timer);
      if (!res.ok) continue;
      if (s.type === 'json') {
        const j = await res.json();
        if (j && j.status === 'ok' && Array.isArray(j.items)) {
          raw = j.items.slice(0, 40).map(it => ({title: it.title || '', link: it.link || '', date: (it.pubDate || '').slice(0, 16)}));
        }
      } else {
        raw = parseRssXmlItems(await res.text()).slice(0, 40);
      }
      if (raw.length) break;
    } catch (e) { /* 次へ */ }
  }
  // Googleニュース検索RSSでジャンル別に補完取得（地方・ばんえい・結果を確実にカバー）
  for (const q of stationQueries(target, range)) {
    const got = await fetchGoogleNewsItems(q);
    raw.push(...got);
    if (raw.length >= 25) break;
  }
  // 同期データも範囲に応じて候補に追加
  if (latestData) {
    const keys = range === 'results' ? ['results'] : range === 'upcoming' ? ['upcoming'] : ['upcoming','results','news'];
    keys.forEach(k => (latestData[k] || []).forEach(it => {
      if (it.title) raw.push({title: it.title, link: it.url || '', date: (it.date || '').slice(0, 16), synced: true});
    }));
  }
  // フィルタ：対象ジャンル/競馬場/範囲
  const NG = ['ビール','キャンペーン','グッズ','プレゼント','求人','採用','コラボ','入場券','トークショー','テレビ','ラジオ'];
  const wantKinds = range === 'results' ? ['results'] : range === 'upcoming' ? ['upcoming'] : ['upcoming','results'];
  const filterRaw = (list) => {
    const picked = [];
    list.forEach(it => {
      const t = it.title || '';
      if (t.length < 5 || NG.some(w => t.includes(w))) return;
      const kind = it.kind || classifyStationKind(t);
      if (!wantKinds.includes(kind)) return;
      const rv = venueOfRace(t);
      if (venue && rv !== venue && !t.includes(venue)) return;
      if (target !== 'all') {
        if (target === 'g1') { if (!/G1|重賞|ステークス|大賞典|記念|賞|杯/.test(t)) return; }
        else if (target === 'jra' && !(JRA_VENUES.some(v => t.includes(v)) || /JRA|中央/.test(t))) return;
        else if (target === 'nar' && !(NAR_VENUES.some(v => t.includes(v)) || /地方|NAR|南関東|大井|川崎|門別|園田|名古屋|高知|佐賀|金沢|笠松|盛岡|水沢|船橋|浦和|姫路/.test(t))) return;
        else if (target === 'banei' && !/ばんえい|帯広/.test(t)) return;
      }
      picked.push(it);
    });
    // 重複除去（タイトル基準。内蔵DB項目は同一URLを共有するため）
    const seen = new Set();
    return picked.filter(it => {
      const k = it.title;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, 30);
  };
  let uniq = filterRaw(raw);
  // 外部・同期データが0件なら内蔵DB（ビッグレース/場別メイン/コース傾向）で補完
  if (!uniq.length) {
    uniq = filterRaw(builtinStationItems(target, venue, range));
    if (uniq.length) setSt('外部取得0件のため内蔵データから補完します…');
  }
  if (!uniq.length) { setSt('⚠️ 条件に合うデータが見つかりませんでした'); renderLearningGraph(); return; }
  let added = 0, skipped = 0;
  uniq.forEach(it => {
    const kind = it.kind || classifyStationKind(it.title);
    const cat = target !== 'all' ? target : (categoryOfVenue(venueOfRace(it.title)) || 'jra');
    const ven = venueOfRace(it.title) || (venue || '（指定なし）');
    const rec = {
      id: Date.now() + Math.floor(Math.random() * 100000), category: cat,
      categoryLabel: LEARN_CATEGORIES[cat] ? LEARN_CATEGORIES[cat].label : cat,
      venue: ven, race: it.title.slice(0, 60),
      text: '【外部取得 ' + (kind === 'results' ? '結果' : '予定') + '】' + it.title + (it.builtin ? '（内蔵DB）' : it.synced ? '（管理画面同期）' : '（外部RSS）'),
      date: new Date().toISOString(), source: 'station',
    };
    if (!learnings.some(l => l.race === rec.race && l.category === cat)) { learnings.push(rec); added++; }
    else skipped++;
    stationItems.push({id: rec.id, title: it.title, url: it.link, date: it.date, kind, genre: cat, venue: ven});
  });
  saveJSON('keiba_learnings', learnings);
  saveJSON('keiba_station_items', stationItems.slice(-200));
  setSt('✅ ' + added + '件をAIに保存しました（全' + learnings.length + '件）' + (skipped ? '（重複スキップ：' + skipped + '件）' : ''));
  renderLearnList(); populateQuickSelect(); renderLearningGraph();
}

/* ---------- AI学習度グラフ（Canvas描画） ---------- */
function learnStats() {
  const byCat = {g1:0, jra:0, nar:0, banei:0};
  learnings.forEach(l => { if (byCat[l.category] !== undefined) byCat[l.category]++; });
  const resultCount = predictionsHistory.length + reflections.length;
  const score = learnings.length + stationItems.length * 0.5 + predictionsHistory.length * 2 + reflections.length * 3;
  const lv = Math.min(10, 1 + Math.floor(score / 8));
  const prog = pct(((score % 8) / 8) * 100);
  return {byCat, resultCount, score, lv, prog};
}
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300, h = cv.clientHeight || 100;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {ctx, w, h};
}
function drawGauge(cv, lv, prog) {
  const c = setupCanvas(cv); if (!c) return; const {ctx, w, h} = c;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h - 8, r = Math.min(w / 2 - 20, h - 14);
  ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.strokeStyle = '#3e3e42';
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.stroke();
  const frac = (lv - 1 + prog / 100) / 10;
  ctx.strokeStyle = '#0a84ff';
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * frac); ctx.stroke();
  ctx.fillStyle = '#0a84ff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Lv.' + lv, cx, cy - r * 0.45);
  ctx.fillStyle = '#8e8e93'; ctx.font = '11px sans-serif';
  ctx.fillText('学習進捗 ' + prog + '%', cx, cy - r * 0.45 + 18);
}
function drawBars(cv, stats) {
  const c = setupCanvas(cv); if (!c) return; const {ctx, w, h} = c;
  ctx.clearRect(0, 0, w, h);
  const axes = [
    ['大型イベント', stats.byCat.g1], ['中央競馬', stats.byCat.jra],
    ['地方競馬', stats.byCat.nar], ['ばんえい', stats.byCat.banei],
    ['結果データ分析', stats.resultCount],
  ];
  const max = Math.max(1, ...axes.map(a => a[1]));
  const bh = 22, gap = 8, x0 = 92, bw = w - x0 - 30;
  axes.forEach((a, i) => {
    const y = i * (bh + gap) + 4;
    ctx.fillStyle = '#8e8e93'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(a[0], x0 - 6, y + bh - 7);
    ctx.fillStyle = '#2c2c2e'; ctx.fillRect(x0, y, bw, bh);
    const fw = Math.max(4, bw * a[1] / max);
    const grad = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
    grad.addColorStop(0, '#0a84ff'); grad.addColorStop(1, '#64d2ff');
    ctx.fillStyle = grad; ctx.fillRect(x0, y, fw, bh);
    ctx.fillStyle = '#cccccc'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(String(a[1]), x0 + fw + 4, y + bh - 7);
  });
}
function drawTrend(cv) {
  const c = setupCanvas(cv); if (!c) return; const {ctx, w, h} = c;
  ctx.clearRect(0, 0, w, h);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({key, label: (d.getMonth() + 1) + '/' + d.getDate(), count: 0});
  }
  const all = [
    ...learnings.map(l => ({d: l.date, w: 1})),
    ...predictionsHistory.map(p => ({d: p.date, w: 1})),
    ...reflections.map(r => ({d: r.date, w: 2})),
    ...stationItems.map(s => ({d: s.date || new Date().toISOString(), w: 1})),
  ];
  all.forEach(e => {
    const k = (e.d || '').slice(0, 10);
    const day = days.find(x => x.key === k);
    if (day) day.count += e.w;
  });
  let cum = 0;
  const pts = days.map(d => { cum += d.count; return {x: d.label, y: cum}; });
  const maxY = Math.max(1, cum);
  const pad = 8, pw = w - pad * 2, ph = h - pad * 2 - 14;
  ctx.strokeStyle = '#3e3e42'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h - pad - 14); ctx.lineTo(w - pad, h - pad - 14); ctx.stroke();
  if (pts.length < 2 || maxY === 1 && cum === 0) {
    ctx.fillStyle = '#8e8e93'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('まだデータがありません', w / 2, h / 2); return;
  }
  const step = pw / (pts.length - 1);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = pad + i * step, y = h - pad - 14 - (p.y / maxY) * ph;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#0a84ff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(pad + (pts.length - 1) * step, h - pad - 14); ctx.lineTo(pad, h - pad - 14); ctx.closePath();
  ctx.fillStyle = 'rgba(10,132,255,0.15)'; ctx.fill();
  ctx.fillStyle = '#8e8e93'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(pts[0].x, pad, h - 4);
  ctx.fillText(pts[pts.length - 1].x, w - pad, h - 4);
  ctx.fillStyle = '#0a84ff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('累計 ' + cum + '件', w - pad - 30, pad + 4);
}
function renderLearningGraph() {
  const stats = learnStats();
  const lvEl = document.getElementById('learn-level');
  if (lvEl) lvEl.textContent = '🤖 総合AI学習レベル：Lv.' + stats.lv + '（学習スコア ' + Math.round(stats.score) + '）';
  const pnl = pnlSummary();
  const pnlEl = document.getElementById('pnl-summary');
  if (pnlEl) pnlEl.innerHTML = pnl.count
    ? '💰 収支サマリー：投資 ' + pnl.invested.toLocaleString() + '円 ／ 払戻 ' + pnl.payout.toLocaleString() + '円 ／ ' +
      '<b style="color:' + (pnl.profit >= 0 ? '#30d158' : '#ff453a') + '">' + (pnl.profit >= 0 ? '+' : '') + pnl.profit.toLocaleString() + '円</b>' +
      ' ／ 的中率 ' + pnl.hitRate + '% ／ 回収率 ' + pnl.recovery + '%（答え合わせ ' + pnl.count + '件）'
    : '💰 収支サマリー：まだ答え合わせデータがありません';
  const g = document.getElementById('cv-gauge');
  if (g) drawGauge(g, stats.lv, stats.prog);
  const b = document.getElementById('cv-bars');
  if (b) drawBars(b, stats);
  const t = document.getElementById('cv-trend');
  if (t) drawTrend(t);
}

/* ---------- バックアップ（書き出し／復元） ---------- */
const BACKUP_KEYS = ['keiba_learnings','keiba_predictions','keiba_reflections','keiba_ext_news','keiba_station_items','keiba_venue_data','keiba_venue_toggles'];
function exportBackup() {
  const data = {};
  BACKUP_KEYS.forEach(k => { data[k] = loadJSON(k, k.includes('venue_toggles') ? {} : []); });
  data._exported_at = new Date().toISOString();
  const json = JSON.stringify(data);
  const area = document.getElementById('backup-area');
  if (area) { area.value = json; area.scrollIntoView({behavior:'smooth'}); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => alert('📤 ' + BACKUP_KEYS.length + '項目を書き出し、クリップボードにコピーしました')).catch(() => alert('書き出しました（テキスト欄をコピーしてください）'));
  } else { alert('書き出しました（テキスト欄をコピーしてください）'); }
}
function applyBackup(data) {
  if (!data || typeof data !== 'object') { alert('JSON形式が正しくありません'); return; }
  BACKUP_KEYS.forEach(k => { if (data[k] !== undefined) saveJSON(k, data[k]); });
  venueData = loadJSON('keiba_venue_data', {});
  venueToggles = loadJSON('keiba_venue_toggles', {});
  predictionsHistory = loadJSON('keiba_predictions', []);
  learnings = loadJSON('keiba_learnings', []);
  reflections = loadJSON('keiba_reflections', []);
  stationItems = loadJSON('keiba_station_items', []);
  extNews = loadJSON('keiba_ext_news', []);
  buildVenues(); renderFavorites(); renderHistory(); renderLearnList();
  populateQuickSelect(); renderLearningGraph(); onLearnCategoryChange();
  alert('✅ 復元しました（' + (data._exported_at || '日時不明') + ' のデータ）');
}
function importBackup() {
  const area = document.getElementById('backup-area');
  try { applyBackup(JSON.parse(area ? area.value : '')); }
  catch (e) { alert('JSONの解析に失敗しました: ' + e.message); }
}
function importBackupFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { applyBackup(JSON.parse(reader.result)); } catch (e) { alert('JSONの解析に失敗しました'); } };
  reader.readAsText(f);
  input.value = '';
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
reflections = loadJSON('keiba_reflections', []);
stationItems = loadJSON('keiba_station_items', []);

renderG1();
buildVenues();
renderFavorites();
renderHistory();
renderLearnList();
onLearnCategoryChange();
initStationSelects();
onStationTargetChange();
populateRaceSelect();
initVenueRaceSelects();
initCounter();
loadLatest();
renderLearningGraph();
