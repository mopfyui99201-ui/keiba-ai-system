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
let selectedRaceName = '';
let editingLearnIndex = -1;

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
  window.scrollTo({top: 0});
}
function goHome() { setTab('home'); }
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
  const sources = [
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
  const ev = evidenceFor(raceName);
  const evEl = document.getElementById('res-evidence');
  if (evEl) evEl.textContent = ev.length ? ev.join(' ／ ') : '-';
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

renderG1();
buildVenues();
renderFavorites();
renderHistory();
renderLearnList();
onLearnCategoryChange();
populateRaceSelect();
initVenueRaceSelects();
initCounter();
loadLatest();
