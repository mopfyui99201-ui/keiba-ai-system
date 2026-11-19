# -*- coding: utf-8 -*-
"""
keiba_fetch.py - 競馬ニュース・レース情報の外部収集モジュール
admin_server.py から利用。失敗時も例外を上げず、取得できた分だけ返す。
"""
import re
import json
import urllib.request
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


def collect_all():
    """全ソースを収集し、日付でソートして返す。"""
    items = []
    errors = []
    for name, fn in [
        ("JRA", collect_jra),
        ("netkeiba", collect_netkeiba),
        ("NAR", collect_nar),
        ("ばんえい", collect_banei),
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
        kind = it.get("kind", "news")
        if kind == "result":
            results.append(it)
        elif kind == "upcoming":
            upcoming.append(it)
        else:
            news.append(it)
    return {"upcoming": upcoming, "results": results, "news": news, "filtered": filtered}


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
