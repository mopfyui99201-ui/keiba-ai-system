# -*- coding: utf-8 -*-
"""
viewer_app.py - 競馬AI予想（閲覧用）デスクトップアプリ エントリポイント
ブラウザの専用ウィンドウモード（--app）で閲覧者専用サイトを開く（1回のみ）。
"""
import webbrowser
import threading
import time
import subprocess
import sys
import os

VIEWER_URL = "https://mopfyui99201-ui.github.io/keiba-ai-system/"
LOCK_FILE = os.path.expanduser("~/Desktop/.keiba_viewer.lock")

def _already_running():
    """ロックファイル存在で多重起動を防ぐ"""
    return os.path.exists(LOCK_FILE)

def open_browser():
    if _already_running():
        print("ビューアーは既に実行中です。")
        return
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
        time.sleep(1.5)
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
        for path in chrome_paths:
            if os.path.exists(path):
                subprocess.Popen([path, f"--app={VIEWER_URL}"])
                return
        webbrowser.open(VIEWER_URL, new=2)
    except Exception as e:
        print(f"ブラウザ起動エラー: {e}")
    finally:
        try:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
        except Exception:
            pass

if __name__ == "__main__":
    t = threading.Thread(target=open_browser, daemon=True)
    t.start()
    t.join()
