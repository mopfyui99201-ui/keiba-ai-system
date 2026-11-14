# Cline 学習ログ
# 場所: /Users/m.kairi.c/cline-workspace/LEARNING_LOG.md

## 学習機能・エラー知見・効率的なコマンド履歴

### 2026/11/13 - 競馬AIシステム構築

#### エラー事象: GitHub Actions 45秒タイムアウト
- 原因: スポーツナビ（race.sportsnavi.com）へのDNS解決エラーが25会場×12レースで累積
- 対策: REQUEST_TIMEOUTを15秒→5秒に短縮、cloud_task.pyをtry-exceptで囲みsys.exit(0)で正常終了
- ファイル: scraper.py, cloud_task.py

#### エラー事象: PyInstallerビルド時のフォルダ形式
- 対策: `pyinstaller --windowed --clean app.py` でMacアプリバンドル（.app）を生成
- ファイル: app.py, scraper.py, predictor.py

#### エラー事象: GUIボタンの文字白飛び
- 対策: tk.Buttonにbg/fgを明示指定、relief=RAISED, bd=3, highlightthickness=2を追加
- 色: 深い緑(#006400)、はっきりした緑(#28a745)、ダークブルー(#00008B)、鮮やかな青(#007acc)、オレンジ(#ff8c00)

#### エラー事象: 予想履歴が見つからない
- 原因: JSONファイルが相対パスで、Macアプリバンドル実行時にカレントディレクトリが異なる
- 対策: sys.frozen判定でAPP_DIRを動的決定、絶対パスを使用
- ファイル: predictor.py

#### エラー事象: Macアプリでネットワーク未接続時のエラー
- 対策: スクレイピング失敗時はモックデータにフォールバック、未来レースは「レースはまだです」と表示
- ファイル: scraper.py, app.py

## 効率的なコマンド
- アプリ構文チェック: `python -m py_compile app.py predictor.py scraper.py`
- GUI起動テスト: `python -c "import tkinter as tk; import app; root=tk.Tk(); app.KeibaApp(root); root.after(3000,root.quit); root.mainloop()"`
- Macアプリビルド: `pyinstaller --windowed --clean app.py`
- GitHubへプッシュ: `git add -A && git commit -m "メッセージ" && git push origin main`

## タスク進捗
- [x] 第1ステップ: UI大改造（3タブ化、スクロールバー、ボタン色）
- [x] 第2ステップ: 全国25競馬場実装、ボタン視認性改善、一括結果・学習機能
- [x] 第3ステップ: UI視認性完全改善、本番用リアルタイムスクレイピング、推奨馬券拡張
- [x] 第4ステップ: 最終修正・統合、ボタン白飛び修正、スクレイピング本番化
- [x] クラウドWebシステム: cloud_task.py, GitHub Actions, index.html, auth.js, style.css
- [ ] ワークスペース統一: 土台ファイル作成、不要ファイル整理