# -*- coding: utf-8 -*-
"""
viewer_app.py - 競馬AI予想（閲覧用）デスクトップアプリ エントリポイント
ブラウザの専用ウィンドウモード（--app）で閲覧者専用サイトを開く。
"""
import webbrowser
import threading
import time
import subprocess
import sys

VIEWER_URL = "https://mopfyui99201-ui.github.io/keiba-ai-system/"

def open_browser():
    time.sleep(1.5)
    try:
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
        for path in chrome_paths:
            if __import__("os").path.exists(path):
                subprocess.Popen([path, f"--app={VIEWER_URL}"])
                return
        webbrowser.open(VIEWER_URL, new=2)
    except Exception as e:
        print(f"ブラウザ起動エラー: {e}")

if __name__ == "__main__":
    t = threading.Thread(target=open_browser, daemon=True)
    t.start()
    t.join()
