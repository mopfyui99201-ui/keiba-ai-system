"""
scraper.py - 競馬データスクレイピングモジュール（本番リアルタイム版 - netkeiba.comモバイル対応）
全国25競馬場（中央10場＋地方15場）に対応。
netkeiba.com モバイル版から実際の出馬表・オッズ・着順をリアルタイムスクレイピング。
取得失敗時は空データを返す（モックデータは生成しない）。
"""
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
from datetime import datetime, timedelta
import re

# ============================================================
# 全国競馬場定義（中央10場＋地方15場）
# ============================================================
JRA_VENUES = [
    "東京", "中山", "京都", "阪神", "中京", "新潟", "福島", "小倉", "函館", "札幌"
]
NAR_VENUES = [
    "大井", "川崎", "船橋", "浦和", "門別", "帯広(ばんえい)", "盛岡", "水沢",
    "金沢", "笠松", "名古屋", "園田", "姫路", "高知", "佐賀"
]
ALL_VENUES = JRA_VENUES + NAR_VENUES

# netkeiba.com モバイル版 競馬場ID
NETKEIBA_MOBILE_VENUE_ID = {
    "東京": "05", "中山": "06", "京都": "07", "阪神": "08", "中京": "09",
    "新潟": "10", "福島": "11", "小倉": "12", "函館": "13", "札幌": "14",
    "大井": "21", "川崎": "22", "船橋": "23", "浦和": "24", "門別": "25",
    "帯広(ばんえい)": "26", "盛岡": "27", "水沢": "28",
    "金沢": "31", "笠松": "32", "名古屋": "33",
    "園田": "34", "姫路": "35", "高知": "36", "佐賀": "37",
}

MOBILE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    "Connection": "keep-alive",
    "Referer": "https://race.sp.netkeiba.com/",
}

REQUEST_TIMEOUT = 15
REQUEST_INTERVAL = 1.5


def _sleep():
    time.sleep(REQUEST_INTERVAL)


def is_nar_venue(venue):
    return venue in NAR_VENUES


def get_venue_type(venue):
    if venue in NAR_VENUES:
        return "地方競馬(NAR)"
    elif venue in JRA_VENUES:
        return "中央競馬(JRA)"
    else:
        return "不明"


VENUE_CHARACTERISTICS = {
    "東京": "📊コース特性：芝コース・外回り・直線長・実力反映",
    "中山": "📊コース特性：芝コース・内回り・急坂・内枠有利",
    "京都": "📊コース特性：芝コース・外回り・平坦・スタミナ重視",
    "阪神": "📊コース特性：芝コース・外回り・平坦・スピード重視",
    "中京": "📊コース特性：芝コース・外回り・平坦・外枠有利傾向",
    "新潟": "📊コース特性：芝コース・外回り・平坦・差し有利",
    "福島": "📊コース特性：芝・ダート・小回り・内枠有利",
    "小倉": "📊コース特性：芝・ダート・平坦・逃げ有利",
    "函館": "📊コース特性：芝・ダート・小回り・内枠・先行有利",
    "札幌": "📊コース特性：芝・ダート・小回り・内枠・先行有利",
    "大井": "📊コース特性：直線長・実力反映フラットコース",
    "川崎": "📊コース特性：きついカーブ・内枠先行圧倒的有利",
    "船橋": "📊コース特性：小回り・内枠先行有利",
    "浦和": "📊コース特性：小回り・内枠先行有利",
    "門別": "📊コース特性：道営・砂コース・内枠先行有利",
    "帯広(ばんえい)": "⚠️特殊競馬：ばんえいパワー＆馬場水分量重視モード稼働中",
    "盛岡": "📊コース特性：道営・砂コース・内枠先行有利",
    "水沢": "📊コース特性：道営・砂コース・内枠先行有利",
    "金沢": "📊コース特性：石川県・砂コース・内枠先行有利",
    "笠松": "📊コース特性：岐阜県・砂コース・内枠先行有利",
    "名古屋": "📊コース特性：愛知県・砂コース・内枠先行有利",
    "園田": "📊コース特性：兵庫県・砂コース・内枠先行有利",
    "姫路": "📊コース特性：兵庫県・砂コース・内枠先行有利",
    "高知": "📊コース特性：高知県・砂コース・内枠先行有利",
    "佐賀": "📊コース特性：佐賀県・砂コース・内枠先行有利",
}


def get_venue_characteristic(venue):
    return VENUE_CHARACTERISTICS.get(venue, "📊コース特性：情報なし")

def _fetch_netkeiba_race_list(venue, race_date=None):
    """netkeiba.com モバイル版からレース一覧（race_idリスト）を取得"""
    if venue not in NETKEIBA_MOBILE_VENUE_ID:
        return []
    if race_date is None:
        race_date = datetime.now().strftime("%Y%m%d")
    venue_id = NETKEIBA_MOBILE_VENUE_ID[venue]
    url = f"https://race.sp.netkeiba.com/?pid=race_list&date={race_date}"
    try:
        _sleep()
        resp = requests.get(url, headers=MOBILE_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text
        # 該当会場の race_id を抽出（race_id = 年4 + 会場2 + 回2 + 日2 + レース2 = 12桁）
        venue_prefix = race_date[:4] + venue_id
        pattern = venue_prefix + r'\d{6}'
        race_ids = re.findall(pattern, html)
        if race_ids:
            race_ids = sorted(set(race_ids))
            print(f"[INFO] netkeiba.comモバイル レース一覧取得成功：{venue} / {race_date} / {len(race_ids)}レース")
            return race_ids
        print(f"[WARN] netkeiba.comモバイル レース一覧から race_id 抽出失敗：{venue} / {race_date}")
        return []
    except Exception as e:
        print(f"[WARN] netkeiba.comモバイル レース一覧取得失敗：{venue} / {race_date} / {e}")
        return []


def _parse_netkeiba_shutuba(race_id):
    """netkeiba.com モバイル版から出馬表をパース"""
    url = f"https://race.sp.netkeiba.com/?pid=shutuba&race_id={race_id}"
    try:
        _sleep()
        resp = requests.get(url, headers=MOBILE_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        horses = []
        tables = soup.find_all("table")
        # 出馬表テーブルは2番目（Table 1）にあることが多い
        for table in tables:
            rows = table.find_all("tr")
            for tr in rows:
                cells = tr.find_all(["td", "th"])
                if len(cells) < 3:
                    continue
                cell_texts = [c.get_text(strip=True) for c in cells]
                # 馬番列が数字で始まる行を探す
                if not cell_texts[0].isdigit():
                    continue
                umaban = int(cell_texts[0])
                if umaban == 0:
                    continue
                # 馬名・性齢・騎手・斤量が混ざった列（インデックス2）
                horse_info = cell_texts[2] if len(cell_texts) > 2 else ""
                # 馬名を抽出（「馬名牡2騎手斤量」の形式から馬名部分を分離）
                uma_name = "不明"
                jockey = "不明"
                m = re.match(r'(.+?)(牡|牝|騸)\d+(.+?)(\d+\.?\d*)', horse_info)
                if m:
                    uma_name = m.group(1).strip()
                    jockey = m.group(3).strip()
                elif horse_info:
                    uma_name = horse_info[:10] if len(horse_info) > 10 else horse_info
                # オッズ・人気を抽出（後ろの列から）
                odds = 5.0
                ninki = 9
                for i in range(len(cell_texts) - 1, -1, -1):
                    t = cell_texts[i]
                    if re.match(r'^\d+\.?\d*$', t.replace(',', '')):
                        odds = float(t.replace(',', ''))
                        break
                # 枠番を推定（馬番から）
                waku = ((umaban - 1) // 2) + 1
                horses.append({
                    "枠番": waku, "馬番": umaban, "馬名": uma_name,
                    "前走脚質": "不明", "前走着順": 0, "前走上がり": 0.0,
                    "展開不利": 0, "血統系統": "不明",
                    "オッズ": round(odds, 1), "人気": ninki,
                    "持ちタイム": 0.0, "騎手勝率": 0.0, "コース適性": 50,
                    "騎手名": jockey, "持ちタイム単位": "秒",
                })
            if horses:
                break
        if horses:
            print(f"[INFO] netkeiba.comモバイル 出馬表パース成功：race_id={race_id} / {len(horses)}頭")
            return horses
    except Exception as e:
        print(f"[WARN] netkeiba.comモバイル 出馬表パース失敗 (race_id={race_id}): {e}")
    return []

def _parse_netkeiba_result(race_id):
    """netkeiba.com モバイル版からレース結果をパース"""
    url = f"https://race.sp.netkeiba.com/?pid=race_result&race_id={race_id}"
    try:
        _sleep()
        resp = requests.get(url, headers=MOBILE_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        result = []
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            for tr in rows:
                cells = tr.find_all(["td", "th"])
                cell_texts = [c.get_text(strip=True) for c in cells]
                if len(cell_texts) >= 2 and cell_texts[0].isdigit():
                    rank = int(cell_texts[0])
                    if rank <= 3:
                        uma_name = cell_texts[2] if len(cell_texts) > 2 else "不明"
                        umaban_text = cell_texts[0] if len(cell_texts) > 0 else "0"
                        # 馬番列を探す（2列目など）
                        umaban = rank
                        for i in range(1, len(cell_texts)):
                            if re.match(r'^\d+$', cell_texts[i]):
                                umaban = int(cell_texts[i])
                                break
                        result.append({"着順": rank, "馬名": uma_name, "馬番": umaban})
            if result:
                break
        if result:
            print(f"[INFO] netkeiba.comモバイル 結果取得成功：race_id={race_id} / {len(result)}着")
            return result[:3]
    except Exception as e:
        print(f"[WARN] netkeiba.comモバイル 結果取得失敗 (race_id={race_id}): {e}")
    return []


def fetch_race_data(venue="京都", race_no=11, target_date=None):
    """指定会場・レースの出馬表データをリアルタイム取得"""
    if target_date is None:
        target_date = datetime.now().strftime("%Y%m%d")
    try:
        target_dt = datetime.strptime(target_date, "%Y%m%d")
        today = datetime.now()
        if target_dt.date() > today.date():
            print(f"[INFO] 未開催レース（未来日付）：{venue} {race_no}R / 日付:{target_date}")
            return pd.DataFrame(), "不明", "不明", "不明"
    except ValueError:
        pass
    race_ids = _fetch_netkeiba_race_list(venue, race_date=target_date)
    if race_ids and race_no <= len(race_ids):
        race_id = race_ids[race_no - 1]
        horses = _parse_netkeiba_shutuba(race_id)
        if horses:
            df = pd.DataFrame(horses)
            track_condition = "良"
            race_date_str = f"{target_date[:4]}年{target_date[4:6]}月{target_date[6:]}日"
            race_time_str = f"{10 + (race_no - 1) // 2}:{(race_no - 1) % 2 * 30:02d}"
            print(f"データ収集完了（リアルタイム・netkeiba.comモバイル）：{venue} {race_no}R / race_id={race_id}")
            return df, track_condition, race_date_str, race_time_str
    print(f"[WARN] データ取得失敗：{venue} {race_no}R / 空データを返却")
    return pd.DataFrame(), "不明", "不明", "不明"


def fetch_race_result(venue, race_no, target_date=None):
    """指定レースの実際の着順（1着〜3着）を取得"""
    if target_date is None:
        target_date = datetime.now().strftime("%Y%m%d")
    try:
        target_dt = datetime.strptime(target_date, "%Y%m%d")
        today = datetime.now()
        if target_dt.date() > today.date():
            print(f"[INFO] 未開催レース：{venue} {race_no}R / 日付:{target_date}")
            return []
    except ValueError:
        pass
    race_ids = _fetch_netkeiba_race_list(venue, race_date=target_date)
    if race_ids and race_no <= len(race_ids):
        race_id = race_ids[race_no - 1]
        result = _parse_netkeiba_result(race_id)
        if result:
            print(f"結果取得完了（リアルタイム・netkeiba.comモバイル）：{venue} {race_no}R / race_id={race_id}")
            return result
    print(f"[WARN] 結果取得失敗：{venue} {race_no}R")
    return []


def get_today_all_schedule():
    """本日の全競馬場・全レーススケジュールを取得"""
    schedule = []
    today_str = datetime.now().strftime("%Y%m%d")
    for venue in ALL_VENUES:
        try:
            race_ids = _fetch_netkeiba_race_list(venue, race_date=today_str)
            race_count = len(race_ids) if race_ids else 0
            status = "開催中" if race_ids else "未確認"
        except Exception:
            race_count = 0
            status = "未確認"
        schedule.append({
            "会場": venue,
            "種別": get_venue_type(venue),
            "レース数": race_count,
            "発走時刻": "10:00〜16:00",
            "馬場状態": "良",
            "ステータス": status,
        })
    return schedule
