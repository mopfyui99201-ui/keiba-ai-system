# HANDOVER.md - keiba-elizabeth-app 引き継ぎメモ

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
