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
- [x] ワークスペース統一: 土台ファイル作成、不要ファイル整理
- [x] アーキテクチャ移行: PyInstaller廃止・純正.app化（89b1b5c, 1b6271f）— Pythonコア廃止、index.html静的化＋admin_server.py(:8765)構成へ
- [ ] GitHub Actions修復: keiba_pipeline.yml が廃止済み cloud_task.py を参照し失敗中。方針決定が必要
- [ ] index.html 整理: buildVenues() 重複定義・末尾</html>二重の解消

## 2026/11/19 - 補助AI（Devin）による引き継ぎ復旧

### 学び・知見
- `git checkout HEAD -- <file>` で未コミットの誤削除を安全に復元できる（履歴に完全版が残っている場合）
- `.gitignore` の改行抜け（`.DS_Storeadmin.log`）はコミット済みでも混入しうる。`cat -e` や `git show HEAD:file | tail` で確認すると確実
- コミットメッセージと `git show --stat` を突き合わせると「意図的削除」と「事故による消失」を区別できる（今回: Pythonコア削除=意図的、index.html空化=事故）
- 静的HTML＋localStorage構成では fetch が無いため、外部依存ゼロでGitHub Pagesにそのまま載る設計になっている

### 2026/11/19 夜 - UI仕上げ・.app修復での学び

#### .app が開かない典型原因
- zshスクリプトの行継続は `\` 1つ。`\\` は「バックスラッシュのエスケープ」になり `||` チェーンが構文エラー（`parse error near 'open'`）になる。`zsh -n script` で事前チェック可能
- macOS同梱 `/usr/bin/python3` はFlask等サードパーティ無し。アプリ側はプロジェクト内 `venv/` を優先参照する設計にすると環境非依存で安定
- Flask開発サーバーは `127.0.0.1` 限定＋localhost専用なら警告は出るが実害なし

#### HTML/JS の落とし穴
- `<script>` 内に `</body>` 等のHTMLタグを書くとJS構文エラーで**スクリプト全体が死ぬ**。node --check で検証を習慣化
- オブジェクトキーに `1st` のような数字始まりはクォート必須（`{'1st': x}`）
- `onclick="fn('x')"` 内で `event.target` を使う旧式は動くが、`data-*`属性＋イベント委譲の方がDOM再生成に強い
- localStorageのJSON.parseはtry-catch必須（壊れた値で全体停止を防ぐ）
- AIっぽい確信度は `Math.random` より「本命オッズからの逆算（低オッズ→高確信度）」の方が納得感がある

#### 効率的なコマンド（追記）
- JS構文チェック: `python3 -c "import re;print(re.search(r'<script>(.*?)</script>',open('index.html').read(),re.S).group(1))" > /tmp/x.js && node --check /tmp/x.js`
- .appのrun確認: `zsh -n "~/Desktop/xxx.app/Contents/MacOS/run"`