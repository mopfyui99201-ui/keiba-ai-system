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

### 2026/11/19 夜(2) - 公開切替・カウンター・情報収集での学び

#### 競馬サイトのスクレイピング実情
- JRAはRSS無し・`Shift_JIS(cp932)`エンコード。`<h2>日付</h2>` + `<a href="/news/YYYYMM/ID.html">` + `<div class="txt">タイトル</div>` の構造で抽出可能
- netkeibaは `https://rss.netkeiba.com/?pid=rss_netkeiba&site=netkeiba` にRSSあり（ページHTMLには記事リンクがJS描画で出ない）
- keiba.go.jp（NAR/ばんえい共通）は `/topics/YYYY/MM/xxx.html` 形式。`/banei/` は404で専用ページ無し
- 文字コードはレスポンスヘッダと`<meta charset>`の両方を見る（JRAはcp932指定）

#### 無料アクセスカウンター
- countapi.xyzは死滅。代替: `countapi.mileshilliard.com/api/v1/{hit|get}/{key}`（CORS可・登録不要）
- 「本日」カウントはキー名に日付を含める方式（`..._YYYYMMDD`）で実現。閲覧側JSと管理側Pythonで同じキー生成ロジックを持つ
- GitHub Pagesは静的なのでサーバー側カウント不可→外部API一択

#### 公開/メンテナンス切替の安全設計
- index.htmlを直接上書きせず `.bak` へ退避→復元方式。メンテナンス判定はHTML内の特徴文字列で検出
- git commit/pushはsubprocess経由。サーバー側からのpushがそのまま「公開」になる設計と相性が良い

#### その他
- fetchの`mode:'cors'`は外部API呼出で必要（付けなくても動くことが多いが明示が安全）
- JSONデータをPagesで配信する場合 `?t=Date.now()` のキャッシュバスター必須（PagesはCDNキャッシュが強い）

### 2026/11/19 夜(3) - 6タブUIリニューアルでの学び

#### 設計判断
- index.htmlが肥大化（500行超）したため `<script src="app.js">` でJSを完全分離。Pagesでは相対パスでそのまま配信され、file://でも動く
- eval/strict modeのJSをnodeでテストする際、`let/const`はevalスコープに閉じる→テストコードをeval文字列内に連結して検証する手法が有効
- 「データなしでも予想したい」要件は、レース名をシードにした決定論的疑似ランダム＋学習データの馬番出現回数ブーストで「参考予想」として実装（嘘の精度を出さないよう確信度上限を70%に制限）
- 学習データの予想への反映は「レース名の双方向includes一致」で関連付け、馬番の出現回数をスコア倍率（1回+15%、上限5回）に変換するシンプル方式
- 資金配分は4券種（馬連40/馬単20/3連複20/3連単20%）を100円単位に丸め、端数は3連単へ集約して合計を予算に一致させる

### 2026/11/19 夜(4) - UI改善での学び

#### トグルの意味変更とデータ移行
- 「ON/OFFトグル」を「お気に入り登録」に転用する際は判定を `!==false`（デフォルトON）から `===true`（デフォルトOFF）へ反転。既存localStorageのtrue値はそのままお気に入りとして機能するため移行コード不要
- カテゴリ別の表示は「グループ定義→filter→innerHTML生成」の共通パターンで3箇所（JRA/NAR/ばんえい）を一括処理すると保守しやすい

#### 管理画面の編集・削除API設計
- 収集データは「生データ(keiba_latest.json)」を正とし、表示時に summarize() で再分類する設計にしたため、編集でkindを再計算するだけで一覧が自動更新される
- アイテムの一意キーはURL（配列インデックスだと並び替えで壊れる）
- prompt()ベースの簡易編集UIは管理者専用画面なら十分実用的（フロントにモーダルを増やさず済む）
## 管理画面の一括削除機能
- 削除は必ず `keiba_latest.json` に即 `write_json` で保存する設計に統一（一覧表示と永続データのズレ防止）
- 全件消去は confirm を2段階にして誤操作を防止。kind未指定=nullで全削除とした
- kind 値は summarize 側の `result`（単数）を使い、UIラベル側で「過去1週間のレース結果」と表示する

## ノイズフィルタ設計
- NGワードは「タイトル+メモ」に対して部分一致。汎用語（イベント/キャンペーン等）は重賞・G1等の強シグナルがあれば採用する例外ルールを入れ、正当なレース記事の誤除外を防止
- フィルタは収集時ではなく summarize（表示・同期時）に適用。これにより保存済みデータは保持したまま、ワード追加だけで即座に一覧と閲覧サイト反映内容が変わる
- カスタム設定は data/filter_config.json。ファイルが存在する場合はデフォルトを完全に置き換える仕様（管理画面に現在の全ワードを表示して編集させる）

## 3分類×4ジャンル ＋ レース結果詳細
- ジャンル判定は「タイトルのキーワード→ソース/URL」の順。帯広は地方場名と重複するため banei を最優先にした
- collect_all() は毎回 items を全置換するため、手動追加(manual://)と note を update 時にマージ保全する処理が必須と判明
- JRA結果ページは CNAME+チェックデジット形式でURL推測不可、netkeiba一覧はJS描画のため、詳細自動取得は「収集済みアイテムの結果ページURLを個別fetch」方式に限定（ベストエフォート）。確実な取り込みは貼り付け解析でカバー
- 貼り付けパーサーは日付/場/R/条件のヘッダ行を着順行と誤認しないよう、月日・競馬場・ダート/芝を含む行を明示除外する必要があった

## ホーム画面型UIへの移行
- タブバー廃止→ホームメニュー＋戻るボタン方式は、panel-home を1つ増やして setTab('home') を既定にするだけで既存6画面を無改修で流用できた
- target-card（本日の注目レース）はID一意制約があるため predict パネルから home パネルへ丸ごと移動させた
- お気に入りは競馬場別3枠に加え、ホーム用に全ジャンルを集約する fav-home を renderFavorites 内で生成

## 閲覧者側ブラウザからの外部情報取得
- JRA/netkeibaのHTMLはブラウザから直接fetchするとCORSで弾かれるため、公開RSSをCORS対応プロキシ経由で取得する方式にした
- プロキシは rss2json API（JSONで返る・実測ok）を第一、codetabs proxy（XML返却・DOMParserで解析）を第二のフォールバックにした。alloriginsは応答が不安定で採用見送り
- 取得失敗時は例外を握りつぶしてステータス表示のみ行い、既存の管理者同期JSON（latest_keiba.json）とlocalStorageの学習データがそのまま使える設計。外部データは localStorage `keiba_ext_news` に保存しリロード後も残る
- 3段階選択は「場×R→selectedRaceName生成」「クイック選択→レース名セット＋可能なら場/R同期」の双方向。クイック選択でフルレース名（例:中山11R 有馬記念）を保持するため、onVenueRaceChangeの上書きを避けてセレクト値のみ直接代入する実装にした
