# HANDOVER.md - keiba-elizabeth-app 引き継ぎメモ

## 2026-11-19（夜）第5作業：4点の改善・修正

### 1. 特殊競馬タブの整理（ばんえい移動）
- `NAR_VENUES` から「帯広(ばんえい)」を削除（15場→14場）
- 新設 `BANEI_VENUES=["帯広(ばんえい)"]` を 🛷特殊競馬タブのアコーディオン（競馬場カード形式：★お気に入り/トグル/攻略メモ）に追加
- 特殊競馬タブは「競馬場アコーディオン → お気に入り一覧 → ばんえい解説 → 攻略ポイント → 公式リンク」の構成に統一
- 旧「ばんえい攻略メモ」単独カードは廃止（競馬場メモ機能に統合）

### 2. ⭐お気に入り登録一覧
- トグルスイッチの意味を「ON=お気に入り登録」に変更（デフォルトOFF。`venueToggles[v]===true` がON）
- 中央競馬/地方競馬/特殊競馬の各タブに「⭐ お気に入り登録一覧」カードを追加
- 各お気に入りに「🎯 予想する」ボタン（レース選択に「◯◯11R メイン」を自動追加→AI予想タブへ遷移）と「解除」ボタン

### 3. 管理画面の収集情報 編集・削除
- `admin_server.py` に `/api/keiba-edit`（タイトル・メモ編集、kind再分類）と `/api/keiba-delete`（URL指定削除）を追加。`data/keiba_latest.json` に即保存
- `admin.html` の各ニュースカードに「✏️ 編集」「🗑️ 削除」「📋 AI学習用コピー」ボタンを追加
- 編集はprompt式（タイトル→メモ。「-」でメモ削除）。削除はconfirm後に実行
- `keiba_fetch.to_ai_text` がメモ（note）もAI学習テキストに含めるよう拡張
- 編集・削除後は「📤 閲覧者サイトへ反映」で整理済みデータのみ公開される

### 4. 検証
- `node --check app.js` / admin.html JS / `py_compile` 全てOK
- DOMスタブテスト：お気に入りON→一覧表示→解除の動作、goPredictのレース選択連動を確認
- APIテスト：`/api/keiba-edit`（メモ保存確認）・`/api/keiba-delete`（70件に減少）・`/api/keiba-update`（71件に復元）全て200

---

## 2026-11-19（夜）第4作業：閲覧サイトを新6タブ構成へ全面リニューアル

### 変更概要
- `index.html` を6タブ構成に全面改訂（HTML+CSSのみ、約370行）
- JSを新規 `app.js`（約500行）に分離（ルール21の肥大化防止）
- Mac風ダークモード（#1e1e1e/#2d2d30/#3e3e42）は維持

### 新6タブ
1. **🏆 大型イベント**：年間G1・ビッグレース11件のカード（時期・格・公式リンク）＋大会公式リンク＋管理画面同期の「最新の競馬情報」カード
2. **🏇 中央競馬**：JRA公式リンク＋JRA全10場アコーディオン（★お気に入り/ON-OFFトグル/攻略メモ保存）
3. **🐎 地方競馬**：NAR公式リンク＋南関東・門別・園田など全場アコーディオン
4. **🛷 特殊競馬**：ばんえい競馬の解説・攻略ポイント・公式リンク・端末保存メモ（localStorage `keiba_banei_memo`）
5. **🎯 AI予想・買い目**：
   - レース選択プルダウン（主要レース＋同期された最新レースを自動追加、自由入力は折りたたみ）
   - 予算入力＋クイックボタン（1,000/3,000/5,000/10,000円）
   - 過剰人気切り・穴馬指定オプション
   - 「AI予想を実行」→ 馬連/馬単/3連複/3連単の4買い目＋確信度・★評価・100円単位資金配分（40/20/20/20%）
   - 出馬表データなしでもレース名シード＋学習データで「参考予想」を自動生成
   - 買い目コピーボタン・着順学習記録（従来通りlocalStorage）
6. **📚 学習の記録**：
   - カテゴリ（G1/中央/地方/特殊）→競馬場→レース名→テキスト貼付で保存
   - localStorage `keiba_learnings` に保存、一覧表示・編集・削除可能
   - 予想実行時にレース名が一致する学習データの馬番出現回数をスコアにブースト（最大+75%）

### 検証
- `node --check app.js` OK
- DOMスタブで runPredict（通常/フォールバック）・saveLearning・saveResult・編集削除の動作確認済み
- index.html は `<script src="app.js">` 参照のためGitHub Pagesでそのまま動作

### 使い方の流れ
1. 「📚 学習の記録」でレース結果や出馬表をどんどん覚えさせる
2. 「🎯 AI予想・買い目」でレースをプルダウン選択→予算セット→実行
3. 「🏆 大型イベント」で管理画面から同期された最新情報を確認

---

## 2026-11-19（夜）第3作業：5+1機能追加（公開切替・カウンター・情報収集・同期）

### 追加機能
1. **Web公開/停止スイッチ**（admin.html + admin_server.py）
   - `/api/web-status` `GET`、`/api/web-unpublish` `POST`（index.html→index.html.bak退避後メンテナンスHTMLへ差替＋git push）、`/api/web-publish` `POST`（bakから復元＋push）
   - メンテナンスHTMLは60秒自動リロード付きのシンプル待機画面
   - admin.htmlにステータス表示・公開/停止ボタン・公開URLリンク＋コピーボタン
2. **アクセスカウンター**：無料API `countapi.mileshilliard.com`（キー: `keiba_elizabeth_viewer_total` と日別 `..._YYYYMMDD`）。index.htmlがページ表示時にhit、admin.htmlは `/api/stats` で累計/本日を表示。閲覧画面下部にも小さく表示
3. **競馬情報更新ボタン** `/api/keiba-update`：新規 `keiba_fetch.py` が JRAニュース(Shift_JIS HTML)・netkeiba RSS・地方競馬(keiba.go.jp)・ばんえいを収集→`data/keiba_latest.json`保存。RSS不通のためHTMLスクレイピング方式。失敗ソースはerrorsに記録し継続
4. **直近レース＆過去1週間結果カード**：admin.htmlに3グループ（直近予定/過去結果/その他ニュース）でカード表示、各項目に情報元リンク・日付・「📋 AI学習用コピー」ボタン
5. **AI学習用テキスト**：`/api/keiba-ai-text` で全体まとめテキスト生成、admin.htmlの「全体コピー」ボタン＋閲覧サイト側にも表示
6. **📤 閲覧サイトへ一括反映** `/api/sync-viewer`：収集データを `data/latest_keiba.json` に整形保存→自動git push→GitHub Pagesに反映。index.htmlは起動時に同JSONをfetchして「📢 最新の競馬情報」カード（更新日時・3グループ一覧・AI学習テキスト）を表示

### テスト結果（全て実測OK）
- `/api/web-status` 200、unpublish→publish往復でメンテナンス⇔復元を確認（pushも成功: cb48f72/26793cc）
- `/api/keiba-update`：71件取得（upcoming 15 / results 4 / news 52、ばんえいのみ0件）
- `/api/stats` `/api/keiba-news` `/api/keiba-ai-text` `/api/sync-viewer` 全て200・正常
- JS: node --check 両HTML OK、Python: py_compile OK

### 変更ファイル
- 新規: `keiba_fetch.py`（情報収集モジュール）
- 変更: `admin_server.py`（+158行のAPI群）、`admin.html`（公開切替/収集/同期UI）、`index.html`（カウンター＋最新情報カード）
- `.gitignore`: `index.html.bak`, `data/keiba_latest.json`, `venv/` 追加。`admin.log` をgit管理から除外

### 使い方
1. `python admin_server.py`（venv）で http://127.0.0.1:8765 を開く
2. 「🔄 競馬情報を最新に更新」→ 結果カード確認
3. 「📤 閲覧者サイトへ最新情報を反映」→ 数分後に公開URLへ反映
4. 公開停止時は「⛔ 停止する」でメンテナンス画面に（「🌐 公開する」で即復元）

### 残課題・注意
- ばんえい情報源は0件（keiba.go.jp/baneiが404）。必要なら専用ソース追加
- カウンターは外部無料API依存（障害時は0表示だが本体機能に影響なし）
- 「競馬情報を更新」は未pushの生データ、閲覧サイトに出るのはsync後の `latest_keiba.json`

---

## 2026-11-19（夜）GitHub Pages 公開URL確定

- **公開URL**: https://mopfyui99201-ui.github.io/keiba-ai-system/
- リモート: https://github.com/mopfyui99201-ui/keiba-ai-system.git （ユーザー名/リポジトリ名から自動生成されるPages URL）
- **動作確認済み**: curlでHTTP 200、配信中HTMLが最新のindex.html（タイトル「競馬AI予想 - 閲覧用」、title-bar/nav-tab構造を含む）であることを確認。Pagesは有効・公開状態のため追加設定不要
- **閲覧用.app**: `/Users/m.kairi.c/Desktop/競馬AI予想（閲覧用）.app/Contents/MacOS/run` は既にこの正確なURLをBrave `--app` モードで開く設定済み（ローカルファイル参照なし）。修正不要を確認
- gh CLIは未インストールだが、Pages自体が正常稼働しているため有効化作業は不要

---

## 2026-11-19（夜）補助AI（Devin）第2作業：UI仕上げ・.app修復・検証

### 実施内容
1. **index.html 全面改訂**（約500行）
   - Macネイティブ風ダークモード（#1e1e1e/#2d2d30/#3e3e42、文字 #fff/#ccc）
   - Macウィンドウ風タイトルバー（信号ボタン＋「競馬AI予想 - 閲覧用」）
   - 5タブ（JRA/netkeiba/ばんえい/地方競馬/データ入力）でリンク集パネル切替、データ入力タブは予想欄へスクロール
   - 「中央競馬場」「地方競馬場」アコーディオン：各行＝左:場名 / 中:★+メインレース / 右:★お気に入り＋ON/OFFトグル。行クリックで攻略メモ（閲覧・保存・削除）展開
   - 予想機能：クリップボード読取ボタン、馬番/馬名/オッズ解析、過剰人気切り・穴馬指定、期待度%・★評価・馬連/馬単/3連複の買い目、予算の100円単位資金配分、レース名自動検出、買い目コピーボタン、着順学習記録（localStorage）
   - レース名は貼付テキストから「◯◯11R」等を自動検出
2. **admin.html 全面改訂**
   - 同テーマのダークモード、タイトル「競馬AI管理コンソール - 管理者専用」
   - 緑枠ステータスバー「✅ 127.0.0.1:8765 稼働中 🟢」＋data/ファイル数と直近コミット表示
   - 縦並びワイドボタン5個（Push/バックアップ/設定編集/学習データ管理/ログ表示）＋区切り線＋赤ボタン2個（公開データ削除 #b91c1c / 根本リセット #991b1b）
   - バグ修正：apiCallの結果表示先ID不一致、restoreがファイル未対応→restoreUI()でファイル選択式に、backupをダウンロード式に修正
3. **デスクトップ .app 修復**（特別許可範囲）
   - 原因1: `競馬AI管理コンソール（管理者専用）.app/Contents/MacOS/run` の行継続が `\\`（二重）でzsh構文エラー → `\` に修正
   - 原因2: `/usr/bin/python3`（3.9.6）にFlask無し → プロジェクト内に `venv/`（Python3.13）を新規作成し `flask==3.0.3` 導入。run scriptが `venv/bin/python` を優先参照する既存ロジックに合致
   - `競馬AI予想（閲覧用）.app` はGitHub PagesのURLを開くだけで正常（run修正不要）
4. **検証**
   - `node --check` で index.html / admin.html のJS構文OK
   - node+DOMスタブで runPredict/saveResult の動作確認（買い目・資金配分・学習記録すべて正常）
   - `python3 -m py_compile admin_server.py make_icons.py` OK
   - 管理サーバー起動→ `curl http://127.0.0.1:8765/` = 200、`/api/status`・`/api/logs` 正常
   - `.gitignore` に `venv/` 追加

### 残課題 → 解決済み（同日追記）
- ~~GitHub Actions（keiba_pipeline.yml）が壊れたまま~~ → **無効化完了**: `.github/workflows/keiba_pipeline.yml` をリポジトリ直下の `keiba_pipeline.yml.disabled` に移動（GitHubはworkflows外のファイルを実行しないため失敗通知は停止）。先頭に無効化理由と再有効化手順のコメントを追記。ファイル自体は参考用に保持。
- admin_server.py はFlask開発サーバー（本番非推奨だがlocalhost専用なので許容範囲）

### 次の作業候補
- keiba_pipeline.yml の方針決定（無効化 or 再設計）
- push後に閲覧用.appで表示確認

---

## 2026-11-19 補助AI（Devin）による現状復旧

### 背景
Clineが制限停止。直前の作業は「PyInstaller廃止・純正.appバンドル化」（コミット 1b6271f）と「UI・起動処理の一括再構築」（89b1b5c）の移行作業中だった。

### 判明した現行アーキテクチャ
- `index.html` … 閲覧用。静的HTML＋クライアントJSのみ（fetch不使用、localStorageでデータ保持）。GitHub Pages公開想定。
- `admin_server.py` + `admin.html` … 管理者用。Flask製ローカルサーバー（127.0.0.1:8765）。git push / データ削除 / リセット / バックアップ / ログ確認API。
- `icons/` + `make_icons.py` … 閲覧用・管理者用のカスタム.icns。
- `data/` … 出力先（現在空）。
- 廃止済み: app.py, predictor.py, scraper.py, cloud_task.py, auth.js, style.css, viewer_app.py, admin_app.py（コミット 89b1b5c, 1b6271f で削除。復元不要と判断）。

### 実施した修復
1. `index.html` をHEAD版から復元（未コミットで342行→0バイトに消えていた。`git checkout HEAD -- index.html`）
2. `.gitignore` 修正: 末尾 `.DS_Storeadmin.log` の改行抜けを修正し、`.DS_Store` と `admin.log` を別行に分離
3. `.clinerules` 更新: 廃止ファイルへの参照を削除し、現行構成・実行コマンド・未解決事項を記載
4. `.windsurfrules` / `.cursorrules` 新規作成（親ルール25項目＋補助役ルール26〜30）

### 未解決・要判断事項
- **GitHub Actions（keiba_pipeline.yml）が壊れたまま**: 廃止済み `cloud_task.py` を実行するため毎時失敗する見込み。対処案: (a) ワークフロー無効化/削除、(b) 静的構成に合わせた新パイプライン設計、(c) 予測バックエンドの再実装。→ ユーザー判断待ち
- `admin.html` の「学習データ管理」ボタンが `apiCall('restore')` を呼ぶが、restoreはファイルアップロード必須のため現状では機能不全気味（要改善）
- `index.html` のHEAD版に `buildVenues()` の重複定義と末尾 `</html>` 二重あり（動作はするが要整理）
- git status に `.DS_Store` / `admin.log` の未コミット変更あり（admin.logは今回.gitignore対象化したので今後は無視される）

### 次の作業候補
- GitHub Actions の方針決定と修正
- index.html の重複コード整理
- admin.html の restore UI 修正
- 変更のコミット＆push（admin_server.py の /api/git-push または手動）

## 2025-xx-xx 管理画面：一括削除機能追加
- `admin_server.py`
  - `POST /api/keiba-delete-bulk` … `{urls:[...]}` をまとめて削除し即保存
  - `POST /api/keiba-clear` … `{kind:"upcoming"|"result"|"news"|null}` でカテゴリ別/全件一括消去
- `admin.html`
  - 各カード左上にチェックボックス、「すべて選択/選択解除」「選択した項目をまとめて削除（N件）」ボタン
  - 各セクション見出し右に「🗑️ この項目を一括消去」、全体上部に「🗑️ 収集データをすべて一括消去」（confirm×2で誤操作防止）
  - 表示は各セクション最大50件（超過分は件数表示のみ）
- 検証: update 71件→bulk削除3件→kind= news 一括消去49件→再updateで71件復元、全て即保存

## ノイズフィルタ機能（競馬情報収集）
- `keiba_fetch.py`
  - `DEFAULT_NG_WORDS`（ビール/キャンペーン/グッズ/求人等20語）で広報・イベント系記事を自動除外
  - `DEFAULT_OK_WORDS`（重賞/G1/枠順/馬体/払戻/ばんえい等）で採用スコアを算出し重要度順にソート
  - 「重賞/G1/ステークス/大賞典/競走」等の強シグナルがある記事はNGワード一致でも採用
  - `summarize()` が `filtered` 件数を返す。フィルタは保存済み `keiba_latest.json` に対して毎回適用されるため、ワード調整は再取得不要で即反映
- `admin_server.py`
  - `data/filter_config.json` にカスタムNG/採用ワードを保存（未設定時はデフォルト使用）
  - `GET/POST /api/filter-config` で設定取得・保存
- `admin.html`
  - 収集エリア下部「⚙️ ノイズフィルタ設定」にNG/採用ワードを1行1語で編集・保存するUI
  - 一覧上部に「🚫 ノイズ自動除外: N件」を表示
- 検証: update 71件中6件をノイズ除外→表示65件。filter-config POST保存→ファイル反映確認

## 3分類×4ジャンル自動仕分け ＋ レース結果詳細機能
- `keiba_fetch.py`
  - `classify_genre()`: large_event(18種のG1/ビッグレース名) / jra(JRA場名・jra.go.jp・race.netkeiba) / local(NAR場名・keiba.go.jp・nar.netkeiba) / banei(ばんえい/帯広/輓馬)。帯広はbanei優先でlocalと重複しない
  - `summarize()` が `sections`（upcoming/result/news × 4ジャンル入れ子）を返す。従来のフラット配列も互換維持
  - `parse_result_text()`: 貼り付けテキストから開催日/場/R/レース名/馬場状態/1〜18着（枠・馬番・馬名・騎手・タイム・上り3F）を構造化。`_summary_from_entries()` が上り最速・先行力から傾向メモ自動生成
  - `fetch_result_detail()` / `enrich_result_details()`: netkeiba result.html・JRA accessS.html のURLを持つ収集アイテムに詳細を自動付与（最大8件・失敗時スキップ）
- `admin_server.py`
  - `/api/keiba-add-result`: 貼り付けテキスト→解析→keiba_latest.jsonへkind=resultで追加（manual://URL）
  - `keiba-update` は手動貼付アイテム(manual://)と編集メモ(note)を再収集後も保全するよう修正（従来は上書きで消えていた）
- `admin.html`
  - 収集エリアに「📋 レース結果テキスト貼り付け→自動まとめ」UI追加
  - 一覧を3セクション×4ジャンルのサブグループ表示に変更（チェック/編集/削除/コピー/リンクは全て維持）
  - `detail`付きカードは🥇🥈🥉着順＋💡AI傾向メモをカード内に表示。AI学習コピーにも着順・傾向を含める
- `index.html` / `app.js`
  - 各タブ（🏆大型/🏇中央/🐎地方/🛷特殊）にジャンル別「最新情報」カードを追加。同期JSONのgenreで自動振り分け、結果アイテムは上位3着サマリーも表示
- 検証: add-result(東京→large_event/大井→local)→update再実行でもmanual項目保全→sections集計確認→sync-viewerで公開push済み

## 閲覧サイト UI全面ブラッシュアップ（ホーム＋専用画面遷移）
- `index.html`
  - 信号ボタン（赤黄緑）と上部6タブバーを廃止。スティッキーなアプリバー（戻るボタン＋タイトル＋現在画面名）に変更
  - `panel-home` 新設：2列×3行のメニューカード6枚＋「🔥 本日の注目レース」＋「⭐ お気に入り登録一覧（全ジャンル集約 fav-home）」
  - 各専用画面の先頭に `screen-title`（大きなタイトル＋バッジ）を追加
  - カード角丸14〜16px・余白拡大・ダークネイビー基調（#16181d/#25282f）に統一
- `app.js`
  - `setTab()` をSPA画面遷移に改修：'home'でメニュー、各キーで専用画面。戻るボタン・サブタイトル表示を連動
  - `goHome()` 追加。`renderFavorites()` にホーム用全件集約（ジャンル絵文字付き）を追加
  - 既存機能（お気に入りトグル/攻略メモ/AI予想/学習/同期表示）はID維持でそのまま動作
- 検証: node --check OK、全必須ID存在確認、画面遷移ロジックのスタブテスト

## AI予想の3段階レース選択＋閲覧者側外部情報取得
- `index.html`
  - 予想フォームの「①対象レース」を競馬場セレクト（optgroupでJRA/NAR/特殊の3分類）＋レース番号セレクト（1R〜12R、11Rは「11R（メイン）」12Rは「12R（最終）」）の2段構成に変更
  - 「②注目・最新レースからクイック選択」セレクト追加（プリセット＋同期upcoming＋外部取得ニュースから自動生成）
  - ホーム画面と予想画面の両方に「🔄 外部から最新情報を取得」ボタン（`fetchExternalNews()`）とステータス表示（`ext-status`/`ext-status-home`）
  - 結果パネルに「📡 根拠情報」行（`res-evidence`）を追加
- `app.js`
  - `initVenueRaceSelects()`：競馬場optgroup＋1R〜12Rを初期構築。`onVenueRaceChange()`：場×Rから `selectedRaceName` を生成（11R→「◯◯11R メイン」、12R→「◯◯12R 最終」）
  - `populateQuickSelect()`（旧populateRaceSelectを改修）：プリセット＋`latestData.upcoming`（【最新】）＋`extNews`（【外部】）を選択肢化。`onQuickSelect()`：選択時にレース名をセットし、場・Rが読み取れればセレクトも同期
  - `fetchExternalNews()`：netkeiba RSSを rss2json API → codetabs プロキシの順でフェッチ（12秒タイムアウト、全失敗時は警告表示のみで同期データにフォールバック）。NGワード軽量フィルタ後 `keiba_ext_news` にlocalStorage保存
  - `evidenceFor(raceName)`：外部ニュース＋同期データからレース名に関連するタイトルを最大2件抽出し、予想結果の「根拠情報」に表示
  - `goPredict(venue)`：お気に入り等からのジャンプ時に場・11Rを自動セット
- 検証: node --check OK。DOMスタブで 1R〜12R全選択肢・11R/12R表記・場×R連動・クイック選択同期・goPredict・外部取得成功/失敗フォールバックを確認

## 答え合わせAI・学習ステーション・学習度グラフ・バックアップ
- `index.html`
  - 予想結果パネルのボタンを「🏁 答え合わせ」に変更。結果入力エリアに「払戻」欄と「💾 結果を保存してAIに反省学習させる」ボタンを追加
  - 学習画面に3カード追加：📡外部データ取得・AI学習ステーション（対象/競馬場/範囲の3プルダウン＋保存ボタン）、📈AI学習度・成長グラフ（Canvas3枚：ゲージ/5軸横棒/14日推移＋収支サマリー）、🔄マイAIデータ引き継ぎ（書き出しコピー/ファイル復元/貼り付け復元）
- `app.js`
  - `answerCheck()`：同期結果データのdetail.entriesから1〜3着を自動入力を試行、失敗時は手動フォームを開く
  - `saveAnswerCheck()`：予想top3と実着順を照合し馬連/馬単/3連複/3連単の的中判定・収支を計算。ズレ要因（本命過剰評価/穴馬強化等）を自動生成し `keiba_reflections`＋`keiba_learnings`（答え合わせ記録）へ保存
  - `learningBoostMap()`：同競馬場・関連レースの答え合わせ実3着内馬番を+2ブーストし次回予想に反映
  - `fetchStationData()`：rss2json/codetabsプロキシ＋`latestData`を対象ジャンル/場/範囲でフィルタし、重複除去後 localStorage の learnings/station_items に保存
  - `renderLearningGraph()`：Canvas自前描画（外部ライブラリ不使用）。Lv/進捗ゲージ・5軸得意度バー・14日累計推移を `setTab('learn')` 時と各保存後に再描画
  - `pnlSummary()`：投資/払戻/収支/的中率/回収率を算出しグラフ上部に表示
  - `exportBackup()/importBackup()/importBackupFile()`：7つのlocalStorageキーをJSONで書き出し・復元
- 検証: node --check OK。DOMスタブで 予想→答え合わせ（的中判定/収支/反省レッスン生成）→ステーション取得（NG除外・2件保存）→グラフ描画 を確認

## 外部取得の全ジャンル対応強化（地方・ばんえい・結果の空振り防止）
- `keiba_fetch.py`
  - `collect_google_news()` 新設：Googleニュース公開RSS（`news.google.com/rss/search`）を5クエリ（競馬重賞結果/地方競馬結果/ばんえい競馬結果/JRA競馬開催/競馬レース結果）で収集。1クエリ最大12件・失敗時スキップ
  - `collect_all()` のソースに追加。実測94件取得（result 33件＝banei 9/local 7/jra 16/large 1、upcoming 14）
- `app.js`（閲覧サイト・学習ステーション）
  - `stationQueries()`：対象×範囲に応じたGoogleニュース検索クエリを生成（例: nar+both → 「地方競馬」「NAR 競馬」）
  - `fetchGoogleNewsItems()`：rss2json→codetabsプロキシでGoogleニュースRSSを取得
  - `builtinStationItems()`：外部・同期データが0件のとき、内蔵DB（BIG_RACES・VENUE_EVENTSの場別メイン/サブ重賞・開催傾向メモ）から対象カテゴリの項目を生成してフォールバック保存
  - フィルタを `filterRaw()` に集約し外部→内蔵の2段適用。nar判定の場名リストを拡充。重複除去をURL→タイトル基準に修正（内蔵項目が同一URLで潰れるバグを解消）
- 検証: node --check OK。スタブで NAR選択→Googleニュース2件保存、外部0件→内蔵DB16件保存を確認。admin `/api/keiba-update` 実測94件

## PWA対応・条件指定・シェア・重複防止・キャッシュバスター（ルール26〜30）
- PWA：`manifest.json`（standalone・#1e1e1e）＋`icon-192.png`/`icon-512.png`（PIL生成）を追加。index.html headに manifest/apple-mobile-web-app-capable/theme-color/apple-touch-icon を設定 → ホーム画面追加で全画面アプリ起動
- 馬場・距離ワンタップ：予想画面にピル型トグル（馬場:良/稍重/重/不良、距離:短距離/マイル/中距離/長距離・再タップ解除）。`conditionBoostMap()` が条件キーワードを含む学習データの馬番を鮮度込みでブースト、`conditionEvidence()` で根拠情報に「条件一致」表示
- シェアカード：`shareResult()` が直近の答え合わせ結果（着順/的中券種/収支/学び）＋買い目＋AIレベル/通算成績を整形しクリップボードコピー
- 重複防止・鮮度：saveLearning は同カテゴリ・場・レース名の既存データをスキップ。fetchStationData は「（重複スキップ：N件）」を表示。learningBoostMap/conditionBoostMap は30日以内を重み2倍
- 数値キャップ：`pct()`（Math.min(100,Math.max(0,round))）を新設し、確信度・的中率・回収率・学習進捗に適用（101%超過を完全防止）
- キャッシュバスター：`admin_server.py` の `bust_viewer_cache()` が sync-viewer 実行時に index.html の `app.js?v=` を `YYYYMMDDHHMM` へ自動書換→git push。全端末へ即反映
- 検証: node --check/py_compile OK。pct(150)=100・条件ブースト・重複スキップ・シェア文面・bust_viewer_cache実測OK

## 使い方マニュアル追加
- `index.html`：ホーム画面右上に「📖 使い方マニュアル」ボタン。タップで全画面オーバーレイ（`manual-overlay`）が開き、①6メニューの見方（ツリー図）②AI予想の使い方（6ステップ）③学習記録・答え合わせ・AIレベルの仕組み ④PWAホーム画面追加方法（iPhone/Android別）を図解風テキストで表示。背景タップor✕で閉じる
- `app.js`：`toggleManual()` 追加
- 検証: node --check OK
