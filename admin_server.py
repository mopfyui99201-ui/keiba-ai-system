# -*- coding: utf-8 -*-
"""
admin_server.py - 競馬AI管理者専用ローカルサーバー
127.0.0.1 (localhost) 専用。外部からはアクセス不可。
GitHub Pages連携、データ管理、システムリセット、ログ確認機能を提供。
"""
import os
import sys
import json
import subprocess
import shutil
import zipfile
import glob
from datetime import datetime
from flask import Flask, render_template_string, request, jsonify, send_file

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_ROOT)

app = Flask(__name__)

DESKTOP = os.path.expanduser("~/Desktop")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
LOG_FILE = os.path.join(PROJECT_ROOT, "admin.log")

def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y/%m/%d %H:%M:%S')}] {msg}\n")
    print(msg)

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=PROJECT_ROOT)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "コマンドタイムアウト"
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
                os.remove(fp)
                deleted.append(f)
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
    # 予想履歴・学習データをクリア
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

@app.route("/api/logs")
def logs():
    if not os.path.exists(LOG_FILE):
        return jsonify({"logs": []})
    with open(LOG_FILE, encoding="utf-8") as fh:
        lines = fh.readlines()
    return jsonify({"logs": lines[-50:]})

@app.route("/api/save-setting", methods=["POST"])
def save_setting():
    data = request.get_json()
    fname = data.get("filename")
    content = data.get("content")
    if not fname or content is None:
        return jsonify({"success": False, "error": "filename と content が必要です"})
    fp = os.path.join(PROJECT_ROOT, fname)
    try:
        with open(fp, "w", encoding="utf-8") as fh:
            fh.write(content)
        log(f"設定保存: {fname}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == "__main__":
    log("管理者サーバー起動: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
