# -*- coding: utf-8 -*-
"""
keiba_fetch.py - 競馬ニュース・レース情報の外部収集モジュール
admin_server.py から利用。失敗時も例外を上げず、取得できた分だけ返す。
"""
import re
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from html import unescape

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
TIMEOUT = 12

JRA_NEWS_URL = "https://www.jra.go.jp/news/index.html"
JRA_BASE = "https://www.jra.go.jp"
NK_RSS_URL = "https://rss.netkeiba.com/?pid=rss_netkeiba&site=netkeiba"
NAR_TOP_URL = "https://www.keiba.go.jp/"
NAR_BASE = "https://www.keiba.go.jp"
BANEI_URL = "https://www.keiba.go.jp/topics/"
GN_RSS = "https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja"
# 全ジャンル・過去1週間結果をカバーするGoogleニュース検索フィード
GOOGLE_QUERIES = [
    "競馬 重賞 結果",
    "地方競馬 結果",
    "ばんえい競馬 結果",
    "JRA 競馬 開催",
    "競馬 レース 結果",
]

RESULT_KEYWORDS = ["結果", "払戻", "着順", "1着", "2着", "3着", "的中", "レース結果", "確定"]
UPCOMING_KEYWORDS = ["今週", "開催", "重賞", "G1", "G2", "G3", "記念", "競馬開催", "開催情報", "開催日程", "予想", "出走"]

# --- ノイズフィルタ（競馬予想に無関係な広報・イベント系記事を除外） ---
DEFAULT_NG_WORDS = [
    "ビール", "発売のお知らせ", "キャンペーン", "ファン投票", "トークショー", "ゲスト",
    "入場券", "指定席", "レーシングプログラム", "グッズ", "プレゼント", "ＣＭ", "CM",
    "テレビ放送", "ラジオ", "求人", "採用", "システムメンテナンス", "営業時間",
    "ツアー", "記念品", "コラボ",
]
DEFAULT_OK_WORDS = [
    "重賞", "G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "特別", "ステークス", "杯",
    "賞", "出走馬", "枠順", "調教", "馬体", "騎手", "乗り替わり", "結果", "着順",
    "払戻", "オッズ", "馬場", "取消", "除外", "ばんえい", "大賞典", "競走", "レース",
]
FILTER_CONFIG_PATH = None  # admin_server から設定される


def _filter_config():
    """data/filter_config.json を読み、NG/採用ワードを返す。"""
    ng, ok = list(DEFAULT_NG_WORDS), list(DEFAULT_OK_WORDS)
    try:
        if FILTER_CONFIG_PATH:
            with open(FILTER_CONFIG_PATH, encoding="utf-8") as f:
                cfg = json.load(f)
            if isinstance(cfg.get("ng"), list):
                ng = [str(w) for w in cfg["ng"] if str(w).strip()]
            if isinstance(cfg.get("ok"), list):
                ok = [str(w) for w in cfg["ok"] if str(w).strip()]
    except Exception:
        pass
    return ng, ok


def noise_score(title):
    """(is_noise, ok_score) を返す。NGワード一致かつ強い採用シグナルなし→ノイズ。"""
    ng, ok_words = _filter_config()
    t = title or ""
    ng_hit = [w for w in ng if w in t]
    ok_score = sum(1 for w in ok_words if w in t)
    # 「イベント」「キャンペーン」等の汎用NGは、重賞/G1等の強シグナルがあれば採用
    strong = any(w in t for w in ("重賞", "G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "ステークス", "大賞典", "競走"))
    is_noise = bool(ng_hit) and not strong
    return is_noise, ok_score


def fetch_text(url):
    """URLを取得してテキストを返す。文字コードはヘッダ/メタから推定。"""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        raw = res.read()
        ctype = res.headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ctype, re.I)
    enc = m.group(1) if m else None
    if not enc:
        head = raw[:4000].decode("ascii", errors="ignore")
        m2 = re.search(r'charset=["\']?([\w-]+)', head, re.I)
        enc = m2.group(1) if m2 else "utf-8"
    enc = enc.lower().replace("shift_jis", "cp932")
    try:
        return raw.decode(enc, errors="replace")
    except (LookupError, UnicodeDecodeError):
        return raw.decode("utf-8", errors="replace")


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        return res.read()


def classify(title):
    t = title or ""
    if any(k in t for k in RESULT_KEYWORDS):
        return "result"
    if any(k in t for k in UPCOMING_KEYWORDS):
        return "upcoming"
    return "news"


def collect_google_news():
    """Googleニュース公開RSSで全ジャンル（中央/地方/ばんえい/結果）を補完収集。"""
    items = []
    for q in GOOGLE_QUERIES:
        try:
            raw = fetch_bytes(GN_RSS.format(q=urllib.parse.quote(q)))
            root = ET.fromstring(raw)
            n = 0
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                pub = (item.findtext("pubDate") or "").strip()
                if not title or not link:
                    continue
                items.append({
                    "title": unescape(title), "url": link,
                    "source": "Googleニュース", "date": pub,
                    "kind": classify(title),
                })
                n += 1
                if n >= 12:
                    break
        except Exception:
            continue
    return items


# --- ジャンル判定（閲覧サイトの4タブと対応） ---
GENRE_LARGE = [
    "有馬記念", "エリザベス女王杯", "日本ダービー", "宝塚記念", "ジャパンカップ",
    "東京大賞典", "きさらぎ賞", "フェブラリーステークス", "高松宮記念",
    "大阪杯", "天皇賞", "安田記念", "スプリンターズステークス",
    "マイルチャンピオンシップ", "秋華賞", "菊花賞", "桜花賞", "皐月賞",
    "NHKマイルカップ", "毎日王冠", "日経賞", "日経新春杯", "京都記念",
    "金鯱賞", "七夕賞", "函館記念", "新潟記念", "関屋記念",
    "小倉記念", "中京記念", "マーチステークス", "大阪ハーフマラソン",
    "根岸ステークス", "東京ジャンプステークス", "中山大障害", "阪神ジャンプS",
    "京阪杯", "阪神牝馬S", "エリザベス", "びわ湖ターフマイル",
    "札幌記念", "新潟大賞典", "京都大賞典", "阪神大賞典", "中山大賞典",
    "フェブラリーS", "ドバイ", "凱旋門", "ブリーダーズ",
]
GENRE_JRA = [
    "東京", "中山", "阪神", "京都", "中京", "新潟", "福島", "小倉", "札幌", "函館",
    "JRA", "中央競馬",
]
GENRE_LOCAL = [
    "大井", "川崎", "船橋", "浦和", "門別", "盛岡", "水沢", "帯広競馬",
    "園田", "姫路", "高知", "佐賀", "名古屋", "金沢", "笠松", "愛知",
    "瀬戸内", "高松", "福山", "三条", "足利", "宇都宮", "荒尾", "上山",
    "地方競馬", "NAR", "南関東",
]
GENRE_BANEI = ["ばんえい", "帯広", "輓馬", "ばんえい競馬"]

JRA_VENUES = {"東京", "中山", "阪神", "京都", "中京", "新潟", "福島", "小倉", "札幌", "函館"}
LOCAL_VENUES = {"大井", "川崎", "船橋", "浦和", "門別", "盛岡", "水沢",
                "園田", "姫路", "高知", "佐賀", "名古屋", "金沢", "笠松",
                "愛知", "瀬戸内", "高松", "福山", "三条", "足利", "宇都宮", "荒尾", "上山"}


def classify_genre(title, source="", url=""):
    """記事を4ジャンルに分類: large_event / jra / local / banei"""
    t = title or ""
    s = source or ""
    u = url or ""
    # ばんえい最優先（帯広は地方競馬場名と重複するため）
    if any(k in t for k in GENRE_BANEI) or "banei" in u:
        return "banei"
    # 大型イベント（G1・ビッグレース名）
    if any(k in t for k in GENRE_LARGE):
        return "large_event"
    # JRA公式ソース or JRA場名
    if s == "JRA" or "jra.go.jp" in u or "race.netkeiba.com" in u:
        # netkeiba中央はJRA扱い。地方netkeibaはnar.netkeiba.com
        if "nar.netkeiba" in u:
            return "local"
        return "jra"
    if s in ("地方競馬(NAR)", "ばんえい") or "keiba.go.jp" in u:
        if any(k in t for k in GENRE_LOCAL) or s == "地方競馬(NAR)":
            return "local" if s != "ばんえい" else "banei"
        return "local"
    # タイトルの場名キーワード
    if any(v in t for v in JRA_VENUES):
        return "jra"
    if any(v in t for v in LOCAL_VENUES):
        return "local"
    return "jra"  # netkeiba等は中央が多いため既定


GENRE_LABELS = {
    "large_event": "🏆 大型イベント",
    "jra": "🏇 中央競馬（JRA）",
    "local": "🐎 地方競馬",
    "banei": "🛷 特殊競馬（帯広・ばんえい）",
}


def collect_jra():
    """JRAニュース一覧（Shift_JIS HTML）から記事を抽出。"""
    items = []
    try:
        html = fetch_text(JRA_NEWS_URL)
        # 日付見出しと記事を順に拾う
        pos = 0
        for m in re.finditer(
            r'<h2[^>]*>([^<]*(\d+)月(\d+)日[^<]*)</h2>(.*?)</ul>',
            html, re.S
        ):
            date_label = unescape(m.group(1)).strip()
            block = m.group(4)
            for am in re.finditer(
                r'href="(/news/\d+/\d+\.html)"[^>]*>.*?<div class="txt">(.*?)</div>',
                block, re.S
            ):
                title = unescape(re.sub(r"<[^>]+>", "", am.group(2))).strip()
                if not title:
                    continue
                items.append({
                    "title": title,
                    "url": JRA_BASE + am.group(1),
                    "source": "JRA",
                    "date": date_label,
                    "kind": classify(title),
                })
        return items[:40]
    except Exception:
        return []


def collect_netkeiba():
    """netkeiba RSS から記事を抽出。"""
    items = []
    try:
        raw = fetch_bytes(NK_RSS_URL)
        root = ET.fromstring(raw)
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            if not title or not link:
                continue
            items.append({
                "title": unescape(title),
                "url": link,
                "source": "netkeiba",
                "date": pub,
                "kind": classify(title),
            })
        return items[:40]
    except Exception:
        return []


def collect_nar():
    """地方競馬全国協会(keiba.go.jp)のトピックスを抽出。"""
    items = []
    try:
        html = fetch_text(NAR_TOP_URL)
        seen = set()
        for m in re.finditer(
            r'href="(/topics/\d{4}/\d{2}/[^"]+\.html)"[^>]*>(.*?)</a>',
            html, re.S
        ):
            title = unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip()
            url = NAR_BASE + m.group(1)
            if not title or url in seen:
                continue
            seen.add(url)
            items.append({
                "title": title,
                "url": url,
                "source": "地方競馬(NAR)",
                "date": "",
                "kind": classify(title),
            })
        return items[:30]
    except Exception:
        return []


def collect_banei():
    """ばんえい関連（keiba.go.jp内のばんえいページ）をベストエフォートで取得。"""
    items = []
    for url in [BANEI_URL, "https://www.keiba.go.jp/banei/"]:
        try:
            html = fetch_text(url)
            for m in re.finditer(
                r'href="([^"]*(?:banei|topics)[^"]*\.html)"[^>]*>(.*?)</a>',
                html, re.S
            ):
                title = unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip()
                if len(title) < 6:
                    continue
                href = m.group(1)
                full = href if href.startswith("http") else NAR_BASE + "/" + href.lstrip("/")
                items.append({
                    "title": title,
                    "url": full,
                    "source": "ばんえい",
                    "date": "",
                    "kind": classify(title),
                })
            if items:
                break
        except Exception:
            continue
    return items[:20]


# ---------- レース結果 詳細パーサー ----------
COND_RE = re.compile(r"(ダート|芝|障害)\s*(\d{3,4})\s*m?\s*[・\s]?(良|稍重|重|不良)?")


def _summary_from_entries(entries):
    """着順データから簡易な傾向メモを自動生成。"""
    if not entries:
        return ""
    top = [e for e in entries if e.get("rank", 99) <= 3]
    parts = []
    # 上り3F最速
    with3f = [(e.get("last3f"), e) for e in top if e.get("last3f")]
    if with3f:
        best = min(with3f, key=lambda x: float(str(x[0]).replace(":", ".")))
        parts.append(f"上り最速は{best[1].get('rank')}着{best[1].get('name')}（{best[0]}）")
    # 通過順位から脚質推定
    fronts = []
    for e in top[:2]:
        c = str(e.get("corner") or "")
        nums = re.findall(r"\d+", c)
        if nums and int(nums[0]) <= 3:
            fronts.append(e.get("name"))
    if fronts:
        parts.insert(0, "先行・逃げ勢（" + "・".join(fronts) + "）が好位を確保")
    if not parts:
        parts.append(f"1着は{top[0].get('name')}。上位争いは混戦気味")
    return "／".join(parts)


def parse_result_text(text, url="", source="手動貼付"):
    """貼り付けテキスト（JRA/netkeiba等の着順表）を構造化detailに変換。"""
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    if not lines:
        return None
    joined = "\n".join(lines[:15])
    race_name, date_str, venue, race_no, cond = "", "", "", "", ""
    # 条件行（ダート1600m・良 等）
    cm = COND_RE.search(joined)
    if cm:
        cond = cm.group(1) + (cm.group(2) or "") + "m" + ("・" + cm.group(3) if cm.group(3) else "")
    # ヘッダ行を探す: 「〜R レース名」
    for l in lines[:15]:
        rm = re.search(r"(\d{1,2})\s*[Rr]\s*[・\s]*([^\d\n]{2,40})", l)
        dm = re.search(r"(\d{1,2})月(\d{1,2})日", l)
        if dm:
            date_str = f"{dm.group(1)}月{dm.group(2)}日"
        vm = re.search(r"(東京|中山|阪神|京都|中京|新潟|福島|小倉|札幌|函館|大井|川崎|船橋|浦和|門別|盛岡|水沢|園田|姫路|高知|佐賀|名古屋|金沢|笠松|帯広)", l)
        if vm:
            venue = vm.group(1)
        if rm and not race_name:
            race_no = rm.group(1) + "R"
            race_name = rm.group(2).strip(" 　：:、。")
    entries = []
    for l in lines:
        # ヘッダ行（日付・競馬場・レース番号・条件）は着順行ではないので除外
        if re.search(r"\d{1,2}月\d{1,2}日|競馬場|[Rr]\s*[^\d]|ダート|芝\s*\d|障害", l) and not re.match(r"^\s*\d{1,2}\s*着", l):
            continue
        # 「1着」「1 」「01」始まりの着順行を拾う
        em = re.match(
            r"^\s*(?:着順\s*)?([1-9]|1[0-8])\s*(?:着|位)?[\s　\-–—|｜]*"
            r"(?:\[?(\d{1,2})枠[\s　]*)?(\d{1,2})\s*番?[\s　]*"
            r"(.+?)\s*$", l)
        if not em:
            continue
        rank = int(em.group(1))
        if rank > 18 or rank in [e["rank"] for e in entries]:
            continue
        waku = int(em.group(2)) if em.group(2) else None
        umaban = int(em.group(3)) if em.group(3) else None
        rest = em.group(4)
        # 残りから 馬名(騎手) タイム 着差 通過 上り を緩く抽出
        name = rest
        jockey = ""
        jm = re.search(r"[（(]([^）)]{2,12})[）)]", rest)
        if jm:
            jockey = jm.group(1)
            name = rest[:jm.start()].strip()
        else:
            parts = rest.split()
            if len(parts) >= 2:
                name = parts[0]
                jockey = parts[1]
        tm = re.search(r"(\d+:\d{2}\.\d)", rest)
        # 上り3Fっぽい数字（30.x〜45.x 単独）
        last3f = ""
        nums = re.findall(r"(?<![:\d])(3[0-9]\.[0-9]|4[0-5]\.[0-9])(?!\d)", rest)
        if nums:
            last3f = nums[-1]
        corner = ""
        cm2 = re.search(r"通過[^\d]*(\d+(?:-\d+)?)", rest)
        if cm2:
            corner = cm2.group(1)
        entries.append({
            "rank": rank, "waku": waku, "umaban": umaban,
            "name": name[:20], "jockey": jockey[:12],
            "time": tm.group(1) if tm else "",
            "corner": corner, "last3f": last3f,
        })
        if len(entries) >= 18:
            break
    if not entries:
        return None
    entries.sort(key=lambda e: e["rank"])
    title_parts = []
    if date_str:
        title_parts.append(date_str)
    if venue:
        title_parts.append(venue)
    if race_no:
        title_parts.append(race_no)
    if race_name:
        title_parts.append(race_name)
    if cond:
        title_parts.append("/ " + cond)
    title = " ".join(title_parts) or (lines[0][:60])
    detail = {
        "race_name": race_name, "date": date_str, "venue": venue,
        "race_no": race_no, "condition": cond,
        "entries": entries[:18],
        "summary": _summary_from_entries(entries),
    }
    return {"title": title, "url": url or ("manual://" + datetime.now().strftime("%Y%m%d%H%M%S")),
            "source": source, "date": date_str, "kind": "result",
            "genre": classify_genre(title + " " + race_name, source, url),
            "detail": detail}


def fetch_result_detail(url):
    """netkeiba/JRAのレース結果ページURLから詳細を取得（ベストエフォート）。"""
    if not url:
        return None
    try:
        html = fetch_text(url)
    except Exception:
        return None
    # netkeiba result.html / JRA accessS.html のテーブル行をテキスト化してパース
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
    lines = []
    for row in rows:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        if not cells:
            continue
        txt = " ".join(unescape(re.sub(r"<[^>]+>", " ", c)).split())
        if txt:
            lines.append(txt)
    if not lines:
        return None
    return parse_result_text("\n".join(lines), url=url,
                             source="netkeiba" if "netkeiba" in url else "JRA")


def enrich_result_details(data, max_items=8):
    """収集アイテムのうち結果ページURLを持つものに詳細データを付与。"""
    count = 0
    for it in data.get("items", []):
        if count >= max_items:
            break
        url = it.get("url", "")
        if it.get("kind") != "result" or it.get("detail"):
            continue
        if not re.search(r"(result\.html|accessS\.html|shutuba\.html)", url):
            continue
        detail = fetch_result_detail(url)
        if detail and detail.get("detail"):
            it["detail"] = detail["detail"]
            it["title"] = detail.get("title") or it.get("title")
            it["genre"] = classify_genre(it.get("title"), it.get("source"), url)
            count += 1
    return data


def collect_all():
    """全ソースを収集し、日付でソートして返す。"""
    items = []
    errors = []
    for name, fn in [
        ("JRA", collect_jra),
        ("netkeiba", collect_netkeiba),
        ("NAR", collect_nar),
        ("ばんえい", collect_banei),
        ("Googleニュース", collect_google_news),
    ]:
        try:
            got = fn()
            items.extend(got)
            if not got:
                errors.append(name + ": 取得0件")
        except Exception as e:
            errors.append(name + ": " + str(e)[:60])
    # URLで重複排除
    seen = set()
    uniq = []
    for it in items:
        if it["url"] in seen:
            continue
        seen.add(it["url"])
        uniq.append(it)
    return {
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "items": uniq,
        "errors": errors,
    }


def summarize(data):
    """収集結果を 直近レース予定 / 過去1週間の結果 / その他ニュース に分類。
    ノイズ記事（NGワード一致）は除外し、採用ワードスコア順に並べる。"""
    upcoming, results, news = [], [], []
    filtered = 0
    scored = []
    for it in data.get("items", []):
        text = (it.get("title") or "") + " " + (it.get("note") or "")
        is_noise, ok_score = noise_score(text)
        if is_noise:
            filtered += 1
            continue
        kind = it.get("kind", "news")
        it["_score"] = ok_score
        scored.append(it)
    # 採用キーワードが多い記事を優先（スコア降順・同点は元順）
    scored.sort(key=lambda x: -x.get("_score", 0))
    for it in scored:
        it.pop("_score", None)
        it["genre"] = classify_genre(it.get("title"), it.get("source"), it.get("url"))
        kind = it.get("kind", "news")
        if kind == "result":
            results.append(it)
        elif kind == "upcoming":
            upcoming.append(it)
        else:
            news.append(it)
    # 3分類 × 4ジャンルの入れ子構造も返す（管理画面・閲覧サイト連携用）
    def group_by_genre(items):
        g = {k: [] for k in GENRE_LABELS}
        for it in items:
            g.setdefault(it.get("genre", "jra"), []).append(it)
        return {k: v for k, v in g.items() if v}
    sections = {
        "upcoming": group_by_genre(upcoming),
        "result": group_by_genre(results),
        "news": group_by_genre(news),
    }
    return {"upcoming": upcoming, "results": results, "news": news,
            "sections": sections, "filtered": filtered}


def filter_config():
    """管理画面用：現在のNG/採用ワード設定を返す。"""
    ng, ok = _filter_config()
    return {"ng": ng, "ok": ok,
            "ng_default": DEFAULT_NG_WORDS, "ok_default": DEFAULT_OK_WORDS}


def to_ai_text(data):
    """閲覧用サイトの貼り付け欄にそのまま使えるAI学習用テキストを生成。"""
    s = summarize(data)
    lines = ["【競馬AI学習データ " + data.get("fetched_at", "")[:10] + "】"]
    lines.append("■ 直近レース予定・注目ニュース")
    def fmt(it):
        note = it.get("note")
        return "・" + it["title"] + ("［" + note + "］" if note else "") + "（" + it["source"] + "）"
    for it in (s["upcoming"] + s["news"])[:15]:
        lines.append(fmt(it))
    lines.append("■ 過去1週間の主な結果・ニュース")
    for it in s["results"][:15]:
        lines.append(fmt(it))
    return "\n".join(lines)
