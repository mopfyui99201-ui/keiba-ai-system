# -*- coding: utf-8 -*-
"""
admin_app.py - 競馬AI管理コンソール（管理者専用）デスクトップアプリ エントリポイント
admin_server.py をバックグラウンド起動し、ブラウザで管理画面を開く（多重起動防止）。
"""
import webbrowser
import threading
import time
import subprocess
import sys
import os
import socket

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
ADMIN_URL = "http://127.0.0.1:8765/"
ADMIN_PORT = 8765
LOCK_FILE = os.path.expanduser("~/Desktop/.keiba_admin.lock")

def _is_port_in_use(port):
    """ポートが使用中かチェック"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0

def _already_running():
    """ロックファイル存在で多重起動を防ぐ"""
    return os.path.exists(LOCK_FILE)

def _open_browser_once(url):
    """ブラウザを専用ウィンドウモードで1回だけ開く"""
    chrome_paths = [
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for path in chrome_paths:
        if os.path.exists(path):
            subprocess.Popen([path, f"--app={url}"])
            return
    webbrowser.open(url, new=2)
def start_server():
    if _is_port_in_use(ADMIN_PORT):
        print(f"ポート {ADMIN_PORT} は既に使用中です。サーバー起動をスキップします。")
        return
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
    if _already_running():
        print("管理画面は既に実行中です。")
        return
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
        time.sleep(0.5)
        _open_browser_once(ADMIN_URL)
    except Exception as e:
        print(f"ブラウザ起動エラー: {e}")
    finally:
        try:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
        except Exception:
            pass

if __name__ == "__main__":
    t1 = threading.Thread(target=start_server, daemon=True)
    t2 = threading.Thread(target=open_browser, daemon=True)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
