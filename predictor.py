import pandas as pd
import json
import os
from datetime import datetime

import sys

# 実行ファイル（Macアプリバンドル）でもスクリプトでも動作するよう絶対パスを使用
if getattr(sys, 'frozen', False):
    # PyInstaller でバンドル実行されている場合
    APP_DIR = os.path.dirname(sys.executable)
else:
    # 通常の Python スクリプト実行の場合
    APP_DIR = os.path.dirname(os.path.abspath(__file__))

AI_SETTINGS_FILE = os.path.join(APP_DIR, "ai_settings.json")
PREDICTIONS_HISTORY_FILE = os.path.join(APP_DIR, "predictions_history.json")
VENUE_WEIGHTS_FILE = os.path.join(APP_DIR, "venue_weights.json")

DEFAULT_WEIGHTS = {
    "枠順内枠": 5.0,
    "枠順外枠": -3.0,
    "トラックバイアス": 15.0,
    "血統ディープ": 8.0,
    "血統キングマンボ": 8.0,
    "血統ロベルト": 8.0,
    "血統サンデー": 4.0,
    "重不良スタミナ": 10.0,
    "血統キングマンボ重不良": 5.0,
    "人気1": 5.0,
    "人気2": 3.0,
    "人気3": 1.0,
    "人気10以下": -2.0,
    "持ちタイム": 6.0,
    "騎手勝率": 7.0,
    "コース適性": 8.0,
}

DEFAULT_VENUE_WEIGHTS = {
    "東京": {"枠順内枠": 5.0, "血統ディープ": 8.0, "重不良スタミナ": 10.0},
    "中山": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 8.0},
    "京都": {"枠順内枠": 6.0, "血統ディープ": 9.0, "重不良スタミナ": 11.0},
    "阪神": {"枠順内枠": 5.0, "血統ディープ": 7.0, "重不良スタミナ": 9.0},
    "中京": {"枠順内枠": 4.0, "血統ディープ": 7.0, "重不良スタミナ": 8.0},
    "新潟": {"枠順内枠": 3.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "福島": {"枠順内枠": 8.0, "血統ディープ": 5.0, "重不良スタミナ": 6.0},
    "小倉": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "函館": {"枠順内枠": 8.0, "血統ディープ": 5.0, "重不良スタミナ": 6.0},
    "札幌": {"枠順内枠": 8.0, "血統ディープ": 5.0, "重不良スタミナ": 6.0},
    "大井": {"枠順内枠": 6.0, "血統ディープ": 7.0, "重不良スタミナ": 9.0},
    "川崎": {"枠順内枠": 9.0, "血統ディープ": 5.0, "重不良スタミナ": 8.0},
    "船橋": {"枠順内枠": 8.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "浦和": {"枠順内枠": 8.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "門別": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "帯広(ばんえい)": {"枠順内枠": 5.0, "血統ディープ": 4.0, "重不良スタミナ": 5.0},
    "盛岡": {"枠順内枠": 8.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "水沢": {"枠順内枠": 8.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "金沢": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "笠松": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "名古屋": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "園田": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "姫路": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "高知": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
    "佐賀": {"枠順内枠": 7.0, "血統ディープ": 6.0, "重不良スタミナ": 7.0},
}

def load_ai_settings():
    if os.path.exists(AI_SETTINGS_FILE):
        try:
            with open(AI_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return dict(DEFAULT_WEIGHTS)

def save_ai_settings(weights):
    try:
        with open(AI_SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(weights, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"ai_settings.json 保存エラー: {e}")

def load_venue_weights():
    if os.path.exists(VENUE_WEIGHTS_FILE):
        try:
            with open(VENUE_WEIGHTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return dict(DEFAULT_VENUE_WEIGHTS)

def save_venue_weights(weights):
    try:
        with open(VENUE_WEIGHTS_FILE, "w", encoding="utf-8") as f:
            json.dump(weights, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"venue_weights.json 保存エラー: {e}")

def load_predictions_history():
    if os.path.exists(PREDICTIONS_HISTORY_FILE):
        try:
            with open(PREDICTIONS_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_predictions_history(history):
    try:
        with open(PREDICTIONS_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"predictions_history.json 保存エラー: {e}")

def calculate_predictions(df, venue="京都"):
    weights = load_ai_settings()
    venue_weights = load_venue_weights()
    vw = venue_weights.get(venue, DEFAULT_VENUE_WEIGHTS.get(venue, {}))
    scores = []
    for idx, row in df.iterrows():
        score = 50.0
        if row["枠番"] in [1, 2, 3]:
            score += vw.get("枠順内枠", weights["枠順内枠"])
        elif row["枠番"] in [7, 8]:
            score += vw.get("枠順外枠", weights["枠順外枠"])
        if row["展開不利"] == 1 and row["前走上がり"] <= 34.0:
            score += vw.get("トラックバイアス", weights["トラックバイアス"])
        bloodline = row["血統系統"]
        if bloodline in ["ディープ系", "キングマンボ系", "ロベルト系"]:
            if bloodline == "ディープ系":
                score += vw.get("血統ディープ", weights["血統ディープ"])
            elif bloodline == "キングマンボ系":
                score += vw.get("血統キングマンボ", weights["血統キングマンボ"])
            elif bloodline == "ロベルト系":
                score += vw.get("血統ロベルト", weights["血統ロベルト"])
        elif bloodline in ["サンデー系"]:
            score += vw.get("血統サンデー", weights["血統サンデー"])
        track_condition = row.get("馬場状態", "良")
        if track_condition in ["重", "不良"]:
            if bloodline in ["ロベルト系", "ディープ系"]:
                score += vw.get("重不良スタミナ", weights["重不良スタミナ"])
            elif bloodline == "キングマンボ系":
                score += weights["血統キングマンボ重不良"]
        popularity = row.get("人気", 99)
        if popularity == 1:
            score += weights["人気1"]
        elif popularity == 2:
            score += weights["人気2"]
        elif popularity == 3:
            score += weights["人気3"]
        elif popularity >= 10:
            score += weights["人気10以下"]
        hold_time = row.get("持ちタイム", 999.9)
        if hold_time != 999.9:
            time_bonus = max(0, (120.0 - hold_time)) * 0.5
            score += min(weights["持ちタイム"], time_bonus)
        jockey_win_rate = row.get("騎手勝率", 0.0)
        if jockey_win_rate > 0:
            score += min(weights["騎手勝率"], jockey_win_rate * 10)
        course_suitability = row.get("コース適性", 0)
        if course_suitability > 0:
            score += min(weights["コース適性"], course_suitability * 0.1)
        scores.append(round(score, 1))
    df["予想スコア"] = scores
    df_sorted = df.sort_values(by="予想スコア", ascending=False).reset_index(drop=True)
    marks = ["○ (本命)", "○ (対抗)", "▲ (単穴)", "△ (連下)"] + ["ー"] * (len(df_sorted) - 4)
    df_sorted["予想印"] = marks[:len(df_sorted)]
    return df_sorted

def generate_professional_tickets(df_sorted, track_condition="良", venue="京都"):
    tickets = []
    top_horses = df_sorted.head(8)

    if len(top_horses) > 0:
        fav_horse = top_horses.iloc[0]
        fav_name = fav_horse["馬名"]
        fav_odds = fav_horse.get("オッズ", 5.0)
        fav_score = fav_horse["予想スコア"]
    else:
        fav_name = "不明"
        fav_odds = 5.0
        fav_score = 50.0

    if len(top_horses) > 1:
        anti_horse = top_horses.iloc[1]
        anti_name = anti_horse["馬名"]
        anti_odds = anti_horse.get("オッズ", 10.0)
        anti_score = anti_horse["予想スコア"]
    else:
        anti_name = "不明"
        anti_odds = 10.0
        anti_score = 45.0

    if len(top_horses) > 2:
        hole_horse = top_horses.iloc[2]
        hole_name = hole_horse["馬名"]
        hole_odds = hole_horse.get("オッズ", 20.0)
    else:
        hole_name = "不明"
        hole_odds = 20.0

    if len(top_horses) > 3:
        conn_horse = top_horses.iloc[3]
        conn_name = conn_horse["馬名"]
        conn_odds = conn_horse.get("オッズ", 30.0)
    else:
        conn_name = "不明"
        conn_odds = 30.0

    bomb_horse = None
    for _, row in df_sorted.iterrows():
        if row["展開不利"] == 1 and row["前走上がり"] <= 34.0:
            bomb_horse = row
            break
    if bomb_horse is None:
        for _, row in df_sorted.iterrows():
            if track_condition in ["重", "不良"] and row["血統系統"] in ["ロベルト系", "ディープ系"]:
                bomb_horse = row
                break
    if bomb_horse is not None:
        bomb_name = bomb_horse["馬名"]
        bomb_odds = bomb_horse.get("オッズ", 50.0)
    else:
        bomb_name = "不明★"
        bomb_odds = 50.0

    strategy1_tickets = []
    strategy1_tickets.append({
        "戦略": "本命・資金回収",
        "券種": "馬連",
        "買い目": f"{fav_name}-{anti_name}",
        "フォーメーション": "1-2",
        "期待値": round(fav_score * fav_odds * 0.8, 1),
        "投資比率": 35,
        "コメント": "◎軸の堅実な馬連。資金回収を最優先。"
    })
    strategy1_tickets.append({
        "戦略": "本命・資金回収",
        "券種": "ワイド",
        "買い目": f"{fav_name}-{anti_name}",
        "フォーメーション": "1-2",
        "期待値": round(fav_score * fav_odds * 0.6, 1),
        "投資比率": 25,
        "コメント": "◎○のワイド。的中率重視の堅実構成。"
    })
    strategy1_tickets.append({
        "戦略": "本命・資金回収",
        "券種": "馬連",
        "買い目": f"{fav_name}-{hole_name}",
        "フォーメーション": "1-3",
        "期待値": round(fav_score * hole_odds * 0.5, 1),
        "投資比率": 15,
        "コメント": "◎から単穴への馬連。配当上乗せを狙う。"
    })
    strategy1_tickets.append({
        "戦略": "本命・資金回収",
        "券種": "ワイド",
        "買い目": f"{fav_name}-{conn_name}",
        "フォーメーション": "1-4",
        "期待値": round(fav_score * conn_odds * 0.4, 1),
        "投資比率": 10,
        "コメント": "◎から連下へのワイド。抑えの一枚。"
    })

    strategy2_tickets = []
    other_horses = [h for _, h in top_horses.iloc[4:7].iterrows()] if len(top_horses) > 4 else []

    fav_umaban = fav_horse.get("馬番", 1)
    anti_umaban = anti_horse.get("馬番", 2)

    for other in other_horses[:3]:
        other_umaban = other.get("馬番", 0)
        other_name = other.get("馬名", "不明")
        strategy2_tickets.append({
            "戦略": "ハイブリッド変化球",
            "券種": "三連単2軸マルチ",
            "買い目": f"{fav_name}={anti_name}→{other_name}",
            "フォーメーション": f"{fav_umaban},{anti_umaban}-{other_umaban}",
            "期待値": round((fav_score + anti_score) * hole_odds * 0.3, 1),
            "投資比率": 8,
            "コメント": "◎○軸から穴馬へ。三連単の回収率を重視。"
        })

    hole_umaban = hole_horse.get("馬番", 3)
    conn_umaban = conn_horse.get("馬番", 4)
    for target_umaban, target_name in [(hole_umaban, hole_name), (conn_umaban, conn_name)]:
        strategy2_tickets.append({
            "戦略": "ハイブリッド変化球",
            "券種": "馬連フォーメーション",
            "買い目": f"{fav_name},{anti_name}-{target_name}",
            "フォーメーション": f"{fav_umaban},{anti_umaban}-{target_umaban}",
            "期待値": round((fav_score + anti_score) * hole_odds * 0.4, 1),
            "投資比率": 6,
            "コメント": "◎○から穴馬への馬連フォーメーション。"
        })
    strategy2_tickets.append({
        "戦略": "ハイブリッド変化球",
        "券種": "三連単",
        "買い目": f"{fav_name}-{anti_name}-{hole_name}",
        "フォーメーション": "1-2-3",
        "期待値": round((fav_score + anti_score + hole_odds) * 0.4, 1),
        "投資比率": 5,
        "コメント": "◎○▲の三連単。順番通りの決着を狙う。"
    })
    strategy2_tickets.append({
        "戦略": "ハイブリッド変化球",
        "券種": "三連単",
        "買い目": f"{fav_name}-{anti_name}-{conn_name}",
        "フォーメーション": "1-2-4",
        "期待値": round((fav_score + anti_score + conn_odds) * 0.35, 1),
        "投資比率": 5,
        "コメント": "◎○△の三連単。中穴を含めた回収を狙う。"
    })
    strategy2_tickets.append({
        "戦略": "ハイブリッド変化球",
        "券種": "三連複",
        "買い目": f"{fav_name}-{anti_name}-{hole_name}",
        "フォーメーション": "1-2-3",
        "期待値": round((fav_score + anti_score + hole_odds) * 0.25, 1),
        "投資比率": 4,
        "コメント": "◎○▲の三連複。順不同の的中を狙う。"
    })

    strategy3_tickets = []
    strategy3_tickets.append({
        "戦略": "大穴一発逆転",
        "券種": "ワイド",
        "買い目": f"{bomb_name}-{fav_name}",
        "フォーメーション": "★-1",
        "期待値": round(bomb_odds * fav_score * 0.5, 1),
        "投資比率": 10,
        "コメント": "爆弾馬★から◎へのワイド。大穴一発を狙う。"
    })
    strategy3_tickets.append({
        "戦略": "大穴一発逆転",
        "券種": "三連単",
        "買い目": f"{bomb_name}-{fav_name}-{anti_name}",
        "フォーメーション": "★-1-2",
        "期待値": round(bomb_odds * fav_score * anti_score * 0.2, 1),
        "投資比率": 5,
        "コメント": "★から◎○への三連単。超高配当を狙う。"
    })
    strategy3_tickets.append({
        "戦略": "大穴一発逆転",
        "券種": "三連単",
        "買い目": f"{bomb_name}-{anti_name}-{fav_name}",
        "フォーメーション": "★-2-1",
        "期待値": round(bomb_odds * anti_score * fav_score * 0.15, 1),
        "投資比率": 3,
        "コメント": "★から逆順の三連単。イレギュラー決着を想定。"
    })
    strategy3_tickets.append({
        "戦略": "大穴一発逆転",
        "券種": "ワイド",
        "買い目": f"{bomb_name}-{hole_name}",
        "フォーメーション": "★-3",
        "期待値": round(bomb_odds * hole_odds * 0.3, 1),
        "投資比率": 4,
        "コメント": "★から単穴へのワイド。両方穴馬の組み合わせ。"
    })

    all_tickets = strategy1_tickets + strategy2_tickets + strategy3_tickets

    if len(all_tickets) > 0:
        max_expectation = max(t["期待値"] for t in all_tickets)
    else:
        max_expectation = 1.0

    for ticket in all_tickets:
        if max_expectation > 0:
            ai_expectation_pct = round(ticket["期待値"] / max_expectation * 100, 1)
        else:
            ai_expectation_pct = 0.0
        ticket["ai_expectation_pct"] = ai_expectation_pct

        if ai_expectation_pct >= 90:
            star_rating = "★★★★★"
            fire_emoji = "🔥"
        elif ai_expectation_pct >= 70:
            star_rating = "★★★★☆"
            fire_emoji = "🔥"
        elif ai_expectation_pct >= 50:
            star_rating = "★★★☆☆"
            fire_emoji = ""
        elif ai_expectation_pct >= 30:
            star_rating = "★★☆☆☆"
            fire_emoji = ""
        else:
            star_rating = "★☆☆☆☆"
            fire_emoji = ""
        ticket["star_rating"] = star_rating
        ticket["fire_emoji"] = fire_emoji

        ticket["odds_min"] = None
        ticket["odds_max"] = None
        odds_list = []
        for _, h in top_horses.iterrows():
            odds_list.append(h.get("オッズ", 5.0))
        if odds_list:
            ticket["odds_min"] = round(min(odds_list), 1)
            ticket["odds_max"] = round(max(odds_list), 1)

    filtered_tickets = [t for t in all_tickets if t["期待値"] > 5.0]

    total_ratio = sum(t["投資比率"] for t in filtered_tickets)
    if total_ratio > 0:
        for t in filtered_tickets:
            t["投資比率"] = round(t["投資比率"] / total_ratio * 100, 1)

    filtered_tickets.sort(key=lambda x: x["投資比率"], reverse=True)

    return {
        "戦略①本命資金回収": [t for t in filtered_tickets if t["戦略"] == "本命・資金回収"],
        "戦略②ハイブリッド変化球": [t for t in filtered_tickets if t["戦略"] == "ハイブリッド変化球"],
        "戦略③大穴一発逆転": [t for t in filtered_tickets if t["戦略"] == "大穴一発逆転"],
        "全買い目数": len(filtered_tickets),
        "総投資比率": sum(t["投資比率"] for t in filtered_tickets)
    }


def apply_learning(history, results):
    """
    答え合わせ結果に基づき、会場別重みを逐次学習で調整する。
    的中したレース → その会場の重みを微増（成功パターン強化）
    外れたレース → その会場の重みを微減（失敗パターン弱体化）
    帯広(ばんえい)は馬体重・馬場水分量重視の専用調整。
    """
    if not results:
        return None

    # 現在の重みをロード
    venue_weights = load_venue_weights()

    # 結果ごとに重みを調整
    for r in results:
        race_key = r["race_key"]
        is_hit = r["hit"]

        # 対応するレコードから会場を特定
        venue = None
        for h in history:
            if h.get("race_key") == race_key:
                venue = h.get("venue")
                break

        if venue is None:
            continue

        if venue not in venue_weights:
            venue_weights[venue] = dict(DEFAULT_VENUE_WEIGHTS.get(venue, {}))

        vw = venue_weights[venue]

        # 学習率（小さめに設定して急激な変化を防ぐ）
        lr = 0.1

        if is_hit:
            # 的中：重みを微増
            for key in vw:
                vw[key] = round(vw[key] * (1 + lr), 2)
        else:
            # 外れ：重みを微減（下限0.5）
            for key in vw:
                vw[key] = max(0.5, round(vw[key] * (1 - lr), 2))

        # 帯広(ばんえい)専用調整
        if venue == "帯広(ばんえい)":
            if is_hit:
                vw["重不良スタミナ"] = round(vw.get("重不良スタミナ", 5.0) * 1.1, 2)
            else:
                vw["重不良スタミナ"] = max(0.5, round(vw.get("重不良スタミナ", 5.0) * 0.9, 2))

    # 保存
    save_venue_weights(venue_weights)
    return venue_weights
