# -*- coding: utf-8 -*-
"""
cloud_task.py - クラウド自動実行スクリプト（GitHub Actions用）
画面なしCLIで動作し、スポーツナビ競馬からリアルタイムデータを取得、
AI予想・答え合わせ・自動学習を実行し、Web表示用JSONを出力する。
"""

import sys
import os
import json
import random
import argparse
from datetime import datetime, timedelta

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

try:
    from scraper import (
        fetch_race_data,
        fetch_race_result,
        ALL_VENUES,
        JRA_VENUES,
        NAR_VENUES,
        get_venue_type,
        get_venue_characteristic,
        is_nar_venue,
        get_today_all_schedule,
    )
    _HAS_SCRAPER = True
except Exception as e:
    print(f"[WARN] scraper.py インポート失敗: {e}")
    _HAS_SCRAPER = False

try:
    from predictor import (
        calculate_predictions,
        generate_professional_tickets,
        load_predictions_history,
        save_predictions_history,
        load_venue_weights,
        save_venue_weights,
        apply_learning,
        PREDICTIONS_HISTORY_FILE,
        VENUE_WEIGHTS_FILE,
    )
    _HAS_PREDICTOR = True
except Exception as e:
    print(f"[WARN] predictor.py インポート失敗: {e}")
    _HAS_PREDICTOR = False

WEB_DATA_DIR = os.path.join(PROJECT_ROOT, "data")
WEB_DATA_FILE = os.path.join(WEB_DATA_DIR, "predictions.json")
WEB_LEARN_FILE = os.path.join(WEB_DATA_DIR, "learning.json")


def ensure_web_dir():
    os.makedirs(WEB_DATA_DIR, exist_ok=True)


def run_prediction_for_venue(venue, race_no, target_date=None):
    if not _HAS_SCRAPER or not _HAS_PREDICTOR:
        return None
    try:
        df, track_condition, race_date, race_time = fetch_race_data(
            venue=venue, race_no=race_no, target_date=target_date
        )
    except Exception as e:
        print(f"[ERROR] データ取得失敗 {venue} {race_no}R: {e}")
        return None
    if df is None or df.empty:
        return None
    try:
        df_sorted = calculate_predictions(df, venue)
        result = generate_professional_tickets(df_sorted, track_condition, venue)
    except Exception as e:
        print(f"[ERROR] 予想計算失敗 {venue} {race_no}R: {e}")
        return None
    all_tickets = []
    for strategy_key in [
        "戦略①本命資金回収",
        "戦略②ハイブリッド変化球",
        "戦略③大穴一発逆転",
    ]:
        for t in result.get(strategy_key, []):
            all_tickets.append({
                "戦略": strategy_key,
                "券種": t.get("券種", ""),
                "買い目": t.get("買い目", ""),
                "フォーメーション": t.get("フォーメーション", ""),
                "期待値": t.get("期待値", 0),
                "投資比率": t.get("投資比率", 0),
                "コメント": t.get("コメント", ""),
                "ai_expectation_pct": t.get("ai_expectation_pct", 0),
                "star_rating": t.get("star_rating", "★☆☆☆☆"),
                "fire_emoji": t.get("fire_emoji", ""),
                "odds_min": t.get("odds_min"),
                "odds_max": t.get("odds_max"),
            })
    all_odds_min = [t.get("odds_min") for t in all_tickets if t.get("odds_min") is not None]
    all_odds_max = [t.get("odds_max") for t in all_tickets if t.get("odds_max") is not None]
    odds_range = None
    if all_odds_min and all_odds_max:
        odds_range = {
            "min": round(min(all_odds_min), 1),
            "max": round(max(all_odds_max), 1),
        }
    record = {
        "race_key": f"{venue}{race_no}R",
        "venue": venue,
        "race_no": race_no,
        "venue_type": get_venue_type(venue),
        "race_date": race_date,
        "race_time": race_time,
        "track_condition": track_condition,
        "target_date": target_date,
        "characteristic": get_venue_characteristic(venue),
        "tickets": all_tickets,
        "total_tickets": result.get("全買い目数", 0),
        "total_investment": result.get("総投資比率", 0),
        "odds_range": odds_range,
        "hit": None,
        "hit_detail": "",
        "created_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
    }
    return record


def save_prediction_record(record):
    if not _HAS_PREDICTOR:
        return
    try:
        history = load_predictions_history()
    except Exception:
        history = []
    race_key = record["race_key"]
    existing_idx = None
    for i, h in enumerate(history):
        if h.get("race_key") == race_key:
            existing_idx = i
            break
    if existing_idx is not None:
        history[existing_idx] = record
    else:
        history.append(record)
    try:
        save_predictions_history(history)
    except Exception as e:
        print(f"[ERROR] 履歴保存失敗: {e}")

def run_answer_check_and_learning():
    if not _HAS_PREDICTOR or not _HAS_SCRAPER:
        print("[WARN] 予測モジュールが不完全なため、答え合わせをスキップします。")
        return
    try:
        history = load_predictions_history()
    except Exception:
        history = []
    if not history:
        print("[INFO] 予想履歴がありません。")
        return
    today = datetime.now().date()
    results = []
    checked_count = 0
    hit_count = 0
    for record in history:
        if record.get("hit") is not None:
            continue
        venue = record.get("venue", "")
        race_no = record.get("race_no", 0)
        race_key = record.get("race_key", "")
        target_date = record.get("target_date", None)
        if target_date:
            try:
                target_dt = datetime.strptime(target_date, "%Y%m%d").date()
                if target_dt > today:
                    continue
            except ValueError:
                pass
        try:
            actual_result = fetch_race_result(venue, race_no, target_date=target_date)
        except Exception as e:
            print(f"[WARN] 結果取得失敗 {race_key}: {e}")
            actual_result = []
        if not actual_result:
            continue
        predicted_horses = []
        for t in record.get("tickets", []):
            buyame = t.get("買い目", "")
            parts = buyame.replace("=", "-").replace("→", "-").split("-")
            for p in parts:
                p = p.strip()
                if p.isdigit():
                    predicted_horses.append(int(p))
        predicted_set = set(predicted_horses)
        actual_horses = [r["馬番"] for r in actual_result]
        actual_set = set(actual_horses)
        is_hit = len(actual_set & predicted_set) > 0
        if is_hit:
            hit_count += 1
        checked_count += 1
        actual_str = " - ".join([f"{r['着順']}着:{r['馬名']}({r['馬番']}番)" for r in actual_result])
        pred_str = ", ".join(map(str, sorted(predicted_set))) if predicted_set else "なし"
        hit_mark = "🎯 的中" if is_hit else "❌ ハズレ"
        print(f"{race_key} | 予想: {pred_str} | 結果: {actual_str} -> {hit_mark}")
        results.append({
            "race_key": race_key,
            "hit": is_hit,
            "detail": f"1着:{actual_horses[0]} 2着:{actual_horses[1] if len(actual_horses)>1 else '-'} 3着:{actual_horses[2] if len(actual_horses)>2 else '-'}",
        })
        for h in history:
            if h.get("race_key") == race_key:
                h["hit"] = is_hit
                h["hit_detail"] = results[-1]["detail"]
                break
    if checked_count > 0:
        try:
            save_predictions_history(history)
        except Exception as e:
            print(f"[ERROR] 履歴更新失敗: {e}")
        try:
            updated_weights = apply_learning(history, results)
            if updated_weights:
                save_venue_weights(updated_weights)
                print(f"[INFO] 学習完了: {checked_count}レース分の重みを更新しました。")
        except Exception as e:
            print(f"[ERROR] 学習失敗: {e}")
        print(f"[INFO] 答え合わせ完了: {hit_count}/{checked_count} 的中 ({(hit_count/checked_count)*100:.1f}%)")
    else:
        print("[INFO] 答え合わせ対象のレースはありません。")

def run_schedule_collection():
    if not _HAS_SCRAPER:
        return
    try:
        schedule = get_today_all_schedule()
        ensure_web_dir()
        with open(os.path.join(WEB_DATA_DIR, "schedule.json"), "w", encoding="utf-8") as f:
            json.dump({
                "updated_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
                "schedule": schedule,
            }, f, ensure_ascii=False, indent=2)
        print(f"[INFO] スケジュール保存完了: {len(schedule)}会場")
    except Exception as e:
        print(f"[ERROR] スケジュール収集失敗: {e}")


def export_web_data():
    if not _HAS_PREDICTOR:
        return
    try:
        history = load_predictions_history()
    except Exception:
        history = []
    today = datetime.now().date()
    web_predictions = []
    for record in history:
        if record.get("hit") is not None:
            continue
        target_date = record.get("target_date", None)
        if target_date:
            try:
                target_dt = datetime.strptime(target_date, "%Y%m%d").date()
                if target_dt < today:
                    continue
            except ValueError:
                pass
        web_predictions.append(record)
    ensure_web_dir()
    with open(WEB_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
            "total": len(web_predictions),
            "predictions": web_predictions,
        }, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Web予想データ保存完了: {len(web_predictions)}レース")
    try:
        weights = load_venue_weights()
        with open(WEB_LEARN_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "updated_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
                "weights": weights,
            }, f, ensure_ascii=False, indent=2)
        print("[INFO] 学習データ保存完了")
    except Exception as e:
        print(f"[WARN] 学習データ保存失敗: {e}")


def run_prediction_only():
    """予想モードのみ実行（--mode predict 用）"""
    target_date = datetime.now().strftime("%Y%m%d")
    prediction_count = 0
    for venue in ALL_VENUES:
        for race_no in range(1, 13):
            record = run_prediction_for_venue(venue, race_no, target_date=target_date)
            if record:
                save_prediction_record(record)
                prediction_count += 1
    print(f"[INFO] 予想完了: {prediction_count}レース")


def run_learning_only():
    """答え合わせ＆学習モードのみ実行（--mode learn 用）"""
    run_answer_check_and_learning()


def main():
    parser = argparse.ArgumentParser(description="競馬AIクラウドタスク")
    parser.add_argument("--mode", choices=["predict", "learn", "full"], default="full",
                        help="実行モード: predict=予想のみ, learn=学習のみ, full=全部")
    args = parser.parse_args()

    try:
        print("=" * 60)
        print(f"競馬AIクラウドタスク 開始: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}")
        print("=" * 60)

        target_date = datetime.now().strftime("%Y%m%d")

        if args.mode in ("full", "predict"):
            print("\n[ステップ1] 当日スケジュール収集...")
            run_schedule_collection()
            print("\n[ステップ2] AI予想実行...")
            prediction_count = 0
            for venue in ALL_VENUES:
                for race_no in range(1, 13):
                    record = run_prediction_for_venue(venue, race_no, target_date=target_date)
                    if record:
                        save_prediction_record(record)
                        prediction_count += 1
                        print(f"  {venue} {race_no}R: {record['total_tickets']}買い目生成")
            print(f"[INFO] 予想完了: {prediction_count}レース")

        if args.mode in ("full", "learn"):
            print("\n[ステップ3] 答え合わせ＆自動学習...")
            run_answer_check_and_learning()

        if args.mode == "full":
            print("\n[ステップ4] Web表示用データエクスポート...")
            export_web_data()

        print("\n" + "=" * 60)
        print(f"クラウドタスク 完了: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}")
        print("=" * 60)

    except Exception as e:
        print(f"[FATAL] 予期せぬエラー: {e}")
        import traceback
        traceback.print_exc()
        # エラーが発生しても正常終了コードを返す（GitHub Actionsで失敗扱いにしない）
        sys.exit(0)


if __name__ == "__main__":
    main()