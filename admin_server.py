# -*- coding: utf-8 -*-
"""
admin_server.py - 競馬AI管理者専用ローカルサーバー（ポート8765）
127.0.0.1 専用。GitHub Pagesには公開しない。
"""
import os
import sys
import json
import subprocess
import shutil
import zipfile
import urllib.request
from datetime import datetime
from flask import Flask, request, jsonify, send_file

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_ROOT)
sys.path.insert(0, PROJECT_ROOT)

app = Flask(__name__)

DESKTOP = os.path.expanduser("~/Desktop")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
LOG_FILE = os.path.join(PROJECT_ROOT, "admin.log")
INDEX_FILE = os.path.join(PROJECT_ROOT, "index.html")
INDEX_BAK = os.path.join(PROJECT_ROOT, "index.html.bak")
LATEST_JSON = os.path.join(DATA_DIR, "latest_keiba.json")
RAW_JSON = os.path.join(DATA_DIR, "keiba_latest.json")
FILTER_JSON = os.path.join(DATA_DIR, "filter_config.json")
PAGES_URL = "https://mopfyui99201-ui.github.io/keiba-ai-system/"
COUNTER_BASE = "https://countapi.mileshilliard.com/api/v1"
COUNTER_KEY_TOTAL = "keiba_elizabeth_viewer_total"

MAINTENANCE_HTML = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>競馬AI予想 - メンテナンス中</title>
<meta http-equiv="refresh" content="60">
<style>
body { font-family: -apple-system, "Hiragino Kaku Gothic ProN", sans-serif; background: #1e1e1e; color: #ccc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
.box { text-align: center; padding: 40px 24px; background: #2d2d30; border: 1px solid #3e3e42; border-radius: 12px; max-width: 420px; }
h1 { font-size: 18px; color: #fff; margin-bottom: 12px; }
p { font-size: 13px; color: #8e8e93; line-height: 1.8; }
</style>
</head>
<body>
<div class="box">
<h1>🏇 競馬AI予想</h1>
<p>ただいまメンテナンス中です。<br>最新の競馬情報を反映するため一時的に公開を停止しています。<br><br>しばらくしてから再度アクセスしてください。</p>
</div>
</body>
</html>
"""

def log(msg):
    ts = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def run_cmd(cmd):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=PROJECT_ROOT)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "タイムアウト"
@app.route("/")
def index():
    html_path = os.path.join(PROJECT_ROOT, "admin.html")
    if os.path.exists(html_path):
        with open(html_path, encoding="utf-8") as f:
            return f.read()
    return "<h1>管理サーバー</h1><p>admin.html が見つかりません。</p>"

@app.route("/api/status")
def status():
    files = []
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            fp = os.path.join(DATA_DIR, f)
            if os.path.isfile(fp):
                files.append({"name": f, "size": os.path.getsize(fp)})
    ret, out, _ = run_cmd("git log --oneline -3")
    return jsonify({"data_files": files, "recent_commits": out.strip().splitlines()})

@app.route("/api/git-push", methods=["POST"])
def git_push():
    log("git push 実行要求")
    ret, out, err = run_cmd("git add -A && git commit -m '🤖 [admin] 管理者コンソールから更新' && git push origin main")
    log(f"git push 結果: ret={ret}, out={out[:200]}, err={err[:200]}")
    return jsonify({"success": ret == 0, "output": out, "error": err})

@app.route("/api/cleanup", methods=["POST"])
def cleanup():
    log("公開データ全削除要求")
    deleted = []
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            fp = os.path.join(DATA_DIR, f)
            if os.path.isfile(fp):
                os.remove(fp); deleted.append(f)
    log(f"削除ファイル: {deleted}")
    return jsonify({"success": True, "deleted": deleted})

@app.route("/api/reset", methods=["POST"])
def reset():
    log("システム根本リセット要求")
    backup_file = os.path.join(DESKTOP, f"keiba_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip")
    try:
        with zipfile.ZipFile(backup_file, "w") as zf:
            for root, dirs, files in os.walk(PROJECT_ROOT):
                for f in files:
                    fp = os.path.join(root, f)
                    rel = os.path.relpath(fp, PROJECT_ROOT)
                    if rel.startswith(".git/") or rel == "admin.log":
                        continue
                    zf.write(fp, rel)
        log(f"自動バックアップ: {backup_file}")
    except Exception as e:
        log(f"バックアップ失敗: {e}")
    for f in ["predictions_history.json", "venue_weights.json", "ai_settings.json"]:
        fp = os.path.join(PROJECT_ROOT, f)
        if os.path.exists(fp):
            os.remove(fp)
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            os.remove(os.path.join(DATA_DIR, f))
    return jsonify({"success": True, "backup": backup_file})

@app.route("/api/backup", methods=["POST"])
def backup():
    log("学習データバックアップ要求")
    backup_file = os.path.join(DESKTOP, f"keiba_learn_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    data = {}
    for f in ["venue_weights.json", "ai_settings.json", "predictions_history.json"]:
        fp = os.path.join(PROJECT_ROOT, f)
        if os.path.exists(fp):
            with open(fp, encoding="utf-8") as fh:
                data[f] = json.load(fh)
    with open(backup_file, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    log(f"バックアップ保存: {backup_file}")
    return send_file(backup_file, as_attachment=True)

@app.route("/api/restore", methods=["POST"])
def restore():
    log("学習データ復元要求")
    if "file" not in request.files:
        return jsonify({"success": False, "error": "ファイルが指定されていません"})
    f = request.files["file"]
    try:
        data = json.load(f)
        for key, val in data.items():
            fp = os.path.join(PROJECT_ROOT, key)
            with open(fp, "w", encoding="utf-8") as fh:
                json.dump(val, fh, ensure_ascii=False, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def git_publish(msg):
    """変更をコミットしてGitHubへプッシュ（公開URLへ反映）。"""
    ret, out, err = run_cmd(
        'git add -A && git commit -m "' + msg + '" && git push origin main'
    )
    log(f"公開push: ret={ret} {err[:120]}")
    return ret == 0, out + err

def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def counter_get(key):
    """無料カウンターAPIから値を取得（失敗時0）。"""
    try:
        url = f"{COUNTER_BASE}/get/{key}"
        req = urllib.request.Request(url, headers={"User-Agent": "keiba-admin/1.0"})
        with urllib.request.urlopen(req, timeout=8) as res:
            return int(json.loads(res.read().decode("utf-8")).get("value", 0))
    except Exception:
        return 0

def is_maintenance():
    try:
        with open(INDEX_FILE, encoding="utf-8") as f:
            return "メンテナンス中です" in f.read(3000)
    except Exception:
        return False

# ---------- Web公開/停止 ----------
@app.route("/api/web-status")
def web_status():
    return jsonify({
        "published": not is_maintenance(),
        "url": PAGES_URL,
        "has_backup": os.path.exists(INDEX_BAK),
    })

@app.route("/api/web-unpublish", methods=["POST"])
def web_unpublish():
    log("Web公開停止（メンテナンス化）要求")
    if not is_maintenance():
        try:
            shutil.copy2(INDEX_FILE, INDEX_BAK)
        except Exception as e:
            return jsonify({"success": False, "error": "バックアップ失敗: " + str(e)})
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        f.write(MAINTENANCE_HTML)
    ok, out = git_publish("⛔ [admin] 閲覧サイトをメンテナンスモードへ切替")
    return jsonify({"success": ok, "output": out, "url": PAGES_URL})

@app.route("/api/web-publish", methods=["POST"])
def web_publish():
    log("Web公開（復元）要求")
    if is_maintenance():
        if not os.path.exists(INDEX_BAK):
            return jsonify({"success": False, "error": "復元用バックアップ(index.html.bak)がありません"})
        shutil.copy2(INDEX_BAK, INDEX_FILE)
    ok, out = git_publish("🌐 [admin] 閲覧サイトを公開モードへ復帰")
    return jsonify({"success": ok, "output": out, "url": PAGES_URL})

# ---------- アクセスカウンター ----------
@app.route("/api/stats")
def stats():
    today_key = "keiba_elizabeth_viewer_" + datetime.now().strftime("%Y%m%d")
    return jsonify({
        "total": counter_get(COUNTER_KEY_TOTAL),
        "today": counter_get(today_key),
    })

# ---------- 競馬情報収集・同期 ----------
@app.route("/api/keiba-update", methods=["POST"])
def keiba_update():
    log("競馬情報 更新要求")
    try:
        import keiba_fetch
        data = keiba_fetch.collect_all()
        write_json(RAW_JSON, data)
        s = keiba_fetch.summarize(data)
        return jsonify({
            "success": True,
            "fetched_at": data["fetched_at"],
            "total": len(data["items"]),
            "upcoming": s["upcoming"],
            "results": s["results"],
            "news": s["news"],
            "filtered": s.get("filtered", 0),
            "errors": data["errors"],
        })
    except Exception as e:
        log("keiba-update 失敗: " + str(e))
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/keiba-news")
def keiba_news():
    data = read_json(RAW_JSON, None)
    if not data:
        return jsonify({"success": False, "error": "未取得", "items": []})
    try:
        import keiba_fetch
        s = keiba_fetch.summarize(data)
        return jsonify({
            "success": True,
            "fetched_at": data.get("fetched_at"),
            "upcoming": s["upcoming"],
            "results": s["results"],
            "news": s["news"],
            "filtered": s.get("filtered", 0),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "items": data.get("items", [])})

@app.route("/api/keiba-edit", methods=["POST"])
def keiba_edit():
    """収集アイテムのタイトル・メモを編集して保存。"""
    body = request.get_json(silent=True) or {}
    url = body.get("url")
    title = body.get("title")
    note = body.get("note")
    if not url:
        return jsonify({"success": False, "error": "url が必要です"})
    data = read_json(RAW_JSON, None)
    if not data or "items" not in data:
        return jsonify({"success": False, "error": "収集データがありません"})
    found = False
    for it in data["items"]:
        if it.get("url") == url:
            if title is not None:
                it["title"] = title
                try:
                    import keiba_fetch
                    it["kind"] = keiba_fetch.classify(title)
                except Exception:
                    pass
            if note is not None:
                it["note"] = note.strip()
            found = True
            break
    if not found:
        return jsonify({"success": False, "error": "対象アイテムが見つかりません"})
    write_json(RAW_JSON, data)
    log("keiba-edit: " + url[:80])
    return jsonify({"success": True})

@app.route("/api/keiba-delete", methods=["POST"])
def keiba_delete():
    """収集アイテムを削除。"""
    body = request.get_json(silent=True) or {}
    url = body.get("url")
    if not url:
        return jsonify({"success": False, "error": "url が必要です"})
    data = read_json(RAW_JSON, None)
    if not data or "items" not in data:
        return jsonify({"success": False, "error": "収集データがありません"})
    before = len(data["items"])
    data["items"] = [it for it in data["items"] if it.get("url") != url]
    if len(data["items"]) == before:
        return jsonify({"success": False, "error": "対象アイテムが見つかりません"})
    write_json(RAW_JSON, data)
    log("keiba-delete: " + url[:80])
    return jsonify({"success": True, "remaining": len(data["items"])})

@app.route("/api/keiba-delete-bulk", methods=["POST"])
def keiba_delete_bulk():
    """複数URLをまとめて削除。"""
    body = request.get_json(silent=True) or {}
    urls = set(body.get("urls") or [])
    if not urls:
        return jsonify({"success": False, "error": "urls が必要です"})
    data = read_json(RAW_JSON, None)
    if not data or "items" not in data:
        return jsonify({"success": False, "error": "収集データがありません"})
    before = len(data["items"])
    data["items"] = [it for it in data["items"] if it.get("url") not in urls]
    removed = before - len(data["items"])
    write_json(RAW_JSON, data)
    log(f"keiba-delete-bulk: {removed}件削除")
    return jsonify({"success": True, "removed": removed, "remaining": len(data["items"])})

@app.route("/api/keiba-clear", methods=["POST"])
def keiba_clear():
    """カテゴリ別(kind)または全体の一括消去。kind: upcoming/result/news/None=全削除"""
    body = request.get_json(silent=True) or {}
    kind = body.get("kind")
    data = read_json(RAW_JSON, None)
    if not data or "items" not in data:
        return jsonify({"success": False, "error": "収集データがありません"})
    before = len(data["items"])
    if kind in ("upcoming", "result", "news"):
        data["items"] = [it for it in data["items"] if it.get("kind") != kind]
    else:
        data["items"] = []
    removed = before - len(data["items"])
    write_json(RAW_JSON, data)
    log(f"keiba-clear: kind={kind} {removed}件削除")
    return jsonify({"success": True, "removed": removed, "remaining": len(data["items"])})

def _init_filter():
    try:
        import keiba_fetch
        keiba_fetch.FILTER_CONFIG_PATH = FILTER_JSON
    except Exception:
        pass

_init_filter()

@app.route("/api/filter-config", methods=["GET", "POST"])
def filter_config():
    """ノイズフィルタ設定の取得・保存。ng/ok はワードのリスト。"""
    try:
        import keiba_fetch
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
    if request.method == "GET":
        cfg = keiba_fetch.filter_config()
        cfg["success"] = True
        return jsonify(cfg)
    body = request.get_json(silent=True) or {}
    cfg = {}
    if "ng" in body:
        cfg["ng"] = [str(w).strip() for w in (body.get("ng") or []) if str(w).strip()]
    if "ok" in body:
        cfg["ok"] = [str(w).strip() for w in (body.get("ok") or []) if str(w).strip()]
    if not cfg:
        return jsonify({"success": False, "error": "ng/ok が必要です"})
    # 既存設定とマージ
    cur = read_json(FILTER_JSON, {})
    cur.update(cfg)
    write_json(FILTER_JSON, cur)
    log(f"filter-config 更新: ng={len(cur.get('ng', []))} ok={len(cur.get('ok', []))}")
    return jsonify({"success": True, "config": keiba_fetch.filter_config()})

@app.route("/api/keiba-ai-text")
def keiba_ai_text():
    data = read_json(RAW_JSON, None)
    if not data:
        return jsonify({"success": False, "error": "未取得"})
    try:
        import keiba_fetch
        return jsonify({"success": True, "text": keiba_fetch.to_ai_text(data)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/sync-viewer", methods=["POST"])
def sync_viewer():
    """収集データを閲覧サイト用JSONへ反映し、そのまま公開push。"""
    log("閲覧サイトへの最新情報反映要求")
    data = read_json(RAW_JSON, None)
    if not data:
        return jsonify({"success": False, "error": "先に「競馬情報を最新に更新」を実行してください"})
    payload = {
        "fetched_at": data.get("fetched_at"),
        "synced_at": datetime.now().isoformat(timespec="seconds"),
        "upcoming": data.get("items", [])[:0],
    }
    try:
        import keiba_fetch
        s = keiba_fetch.summarize(data)
        payload["upcoming"] = s["upcoming"][:15]
        payload["results"] = s["results"][:15]
        payload["news"] = s["news"][:10]
        payload["ai_text"] = keiba_fetch.to_ai_text(data)
    except Exception:
        payload["upcoming"] = data.get("items", [])[:15]
        payload["results"] = []
        payload["news"] = []
        payload["ai_text"] = ""
    write_json(LATEST_JSON, payload)
    ok, out = git_publish("📤 [admin] 閲覧サイトへ最新競馬情報を反映")
    return jsonify({"success": ok, "output": out, "count": len(payload.get("upcoming", [])) + len(payload.get("results", []))})

@app.route("/api/logs")
def logs():
    if not os.path.exists(LOG_FILE):
        return jsonify({"logs": []})
    with open(LOG_FILE, encoding="utf-8") as fh:
        lines = fh.readlines()
    return jsonify({"logs": lines[-50:]})

if __name__ == "__main__":
    log("管理者サーバー起動: http://127.0.0.1:8765")
    app.run(host="127.0.0.1", port=8765, debug=False)
