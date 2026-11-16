# -*- coding: utf-8 -*-
"""
admin_app.py - 競馬AI管理コンソール（管理者専用）デスクトップアプリ エントリポイント
admin_server.py をバックグラウンド起動し、ブラウザで管理画面を開く。
"""
import webbrowser
import threading
import time
import subprocess
import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
ADMIN_URL = "http://127.0.0.1:5000/"

def start_server():
    try:
        subprocess.Popen(
            [sys.executable, os.path.join(PROJECT_ROOT, "admin_server.py")],
            cwd=PROJECT_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        print(f"サーバー起動エラー: {e}")

def open_browser():
    time.sleep(2.5)
    try:
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
        for path in chrome_paths:
            if os.path.exists(path):
                subprocess.Popen([path, f"--app={ADMIN_URL}"])
                return
        webbrowser.open(ADMIN_URL, new=2)
    except Exception as e:
        print(f"ブラウザ起動エラー: {e}")

if __name__ == "__main__":
    t1 = threading.Thread(target=start_server, daemon=True)
    t1.start()
    t2 = threading.Thread(target=open_browser, daemon=True)
    t2.start()
    t1.join()
    t2.join()
