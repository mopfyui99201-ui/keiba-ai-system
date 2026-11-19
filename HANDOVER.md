# HANDOVER.md - keiba-elizabeth-app 引き継ぎメモ

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

### 残課題
- **GitHub Actions（keiba_pipeline.yml）依然として壊れたまま**（廃止済み cloud_task.py を参照）。閲覧用.appはGitHub Pagesを見るため、index.htmlの更新はpush後に反映される
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
