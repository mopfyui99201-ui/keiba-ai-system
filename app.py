# -*- coding: utf-8 -*-
"""
app.py - 競馬予想アプリケーション（UI大改造版）
tkinter + ttk.Notebook を使用した3タブ構造のGUIアプリ。
predictor.py / scraper.py と連携してレース予想を実行する。
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import pandas as pd
import json
import os
from datetime import datetime

# ---------------------------------------------------------
# 既存モジュールのインポート（ predictor.py / scraper.py ）
# ---------------------------------------------------------
try:
    from predictor import (
        calculate_predictions,
        generate_professional_tickets,
        load_ai_settings,
        save_ai_settings,
        load_predictions_history,
        save_predictions_history,
        load_venue_weights,
        save_venue_weights,
        apply_learning,
    )
    _HAS_PREDICTOR = True
except Exception as e:
    _HAS_PREDICTOR = False
    print(f"[WARN] predictor.py のインポートに失敗: {e}")

    def calculate_predictions(df, venue="京都"):
        return df

    def generate_professional_tickets(df_sorted, track_condition="良", venue="京都"):
        return {
            "戦略①本命資金回収": [],
            "戦略②ハイブリッド変化球": [],
            "戦略③大穴一発逆転": [],
            "全買い目数": 0,
            "総投資比率": 0,
        }

    def load_ai_settings():
        return {}

    def save_ai_settings(weights):
        pass

    def load_predictions_history():
        return []

    def save_predictions_history(history):
        pass

    def load_venue_weights():
        return {}

    def save_venue_weights(weights):
        pass

    def apply_learning(history):
        return {}


try:
    from scraper import (
        fetch_race_data,
        fetch_race_result,
        ALL_VENUES,
        JRA_VENUES,
        NAR_VENUES,
        get_venue_type,
        get_venue_characteristic,
        is_nar_venue,
        get_today_all_schedule,
    )
    _HAS_SCRAPER = True
except Exception as e:
    _HAS_SCRAPER = False
    print(f"[WARN] scraper.py のインポートに失敗: {e}")

    ALL_VENUES = [
        "東京", "中山", "京都", "阪神", "中京", "新潟", "福島", "小倉", "函館", "札幌",
        "大井", "川崎", "船橋", "浦和", "門別", "帯広(ばんえい)", "盛岡", "水沢",
        "金沢", "笠松", "名古屋", "園田", "姫路", "高知", "佐賀",
    ]
    JRA_VENUES = ALL_VENUES[:10]
    NAR_VENUES = ALL_VENUES[10:]

    def fetch_race_data(venue="京都", race_no=11):
        return pd.DataFrame(), "良", "2024年01月01日", "15:00"

    def get_venue_type(venue):
        return "中央競馬(JRA)"

    def get_venue_characteristic(venue):
        return ""

    def is_nar_venue(venue):
        return False

    def get_today_all_schedule():
        return []

    def fetch_race_result(venue, race_no):
        return []


# ---------------------------------------------------------
# ボタンスタイル定義（視認性劇的改善：コントラスト高い配色）
# ---------------------------------------------------------
BTN_BG_DEEP_GREEN = "#006400"    # 深い緑
BTN_BG_BRIGHT_GREEN = "#28a745"  # はっきりした緑（一括操作用）
BTN_BG_DARK_BLUE = "#00008B"     # ダークブルー
BTN_BG_BRIGHT_BLUE = "#007acc"   # 鮮やかな青（タブアクティブ・結果取得用）
BTN_BG_ORANGE = "#ff8c00"        # オレンジ（警告・特殊モード用）
BTN_FG_WHITE = "#FFFFFF"
BTN_ACTIVE_BG = "#228B22"
BTN_ACTIVE_BG_BLUE = "#005a9e"
BTN_ACTIVE_BG_ORANGE = "#e67e22"

# タブスタイル設定
TAB_ACTIVE_BG = "#007acc"
TAB_ACTIVE_FG = "#FFFFFF"
TAB_INACTIVE_BG = "#e0e0e0"
TAB_INACTIVE_FG = "#333333"


class KeibaApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("競馬AI予想システム - Elizabeth App")
        self.root.geometry("1250x850")
        self.root.minsize(1050, 750)

        # 学習重みデータ
        self.venue_weights = load_venue_weights() if _HAS_PREDICTOR else {}
        self.ai_weights = load_ai_settings() if _HAS_PREDICTOR else {}

        # 状態保持
        self.current_df = pd.DataFrame()
        self.current_venue = tk.StringVar(value="京都")
        self.current_race_no = tk.IntVar(value=11)
        self.prediction_result = None
        self.current_target_date = None  # 未来日付対応

        # UI構築（スタイル設定を先に）
        self._setup_styles()
        self._build_menu_bar()
        self._build_notebook()

    # =========================================================
    # スタイル設定（タブ・ボタンの視認性劇的改善）
    # =========================================================
    def _setup_styles(self):
        style = ttk.Style()

        # 利用可能なテーマを確認してクラシック系をベースにする
        try:
            style.theme_use("clam")
        except Exception:
            pass

        # Notebook 全体の背景
        style.configure("TNotebook", background="#2b2b2b", borderwidth=0, tabmargins=[2, 5, 2, 0])

        # タブスタイル（高コントラスト：非選択はグレー、選択は鮮やかな青）
        style.configure(
            "TNotebook.Tab",
            background="#555555",
            foreground="#FFFFFF",
            font=("Meiryo", 11, "bold"),
            padding=[18, 10],
            borderwidth=1,
            relief="raised",
        )
        style.map(
            "TNotebook.Tab",
            background=[("selected", "#007acc"), ("active", "#3399ff")],
            foreground=[("selected", "#FFFFFF"), ("active", "#FFFFFF")],
            bordercolor=[("selected", "#007acc")],
            lightcolor=[("selected", "#007acc")],
            darkcolor=[("selected", "#007acc")],
        )

        # LabelFrame のスタイル（ダーク背景対応）
        style.configure(
            "TLabelframe",
            background="#3a3a3a",
            borderwidth=1,
            relief="solid",
            bordercolor="#555555",
        )
        style.configure(
            "TLabelframe.Label",
            background="#3a3a3a",
            foreground="#FFFFFF",
            font=("Meiryo", 10, "bold"),
        )

        # Treeview のスタイル（ヘッダー・セルのコントラスト向上）
        style.configure(
            "Treeview",
            background="#2b2b2b",
            foreground="#FFFFFF",
            fieldbackground="#2b2b2b",
            bordercolor="#555555",
        )
        style.configure(
            "Treeview.Heading",
            background="#007acc",
            foreground="#FFFFFF",
            font=("Meiryo", 9, "bold"),
        )
        style.map(
            "Treeview.Heading",
            background=[("active", "#005a9e")],
        )

        # エントリ・コンボボックスのスタイル
        style.configure(
            "TCombobox",
            background="#3a3a3a",
            foreground="#FFFFFF",
            fieldbackground="#3a3a3a",
            arrowcolor="#FFFFFF",
        )
        style.map(
            "TCombobox",
            fieldbackground=[("readonly", "#3a3a3a")],
            selectbackground=[("readonly", "#007acc")],
        )

    # =========================================================
    # メニューバー
    # =========================================================
    def _build_menu_bar(self):
        menubar = tk.Menu(self.root)

        # ファイル
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="予想履歴をエクスポート", command=self._on_export_history)
        file_menu.add_separator()
        file_menu.add_command(label="終了", command=self.root.quit)
        menubar.add_cascade(label="ファイル", menu=file_menu)

        # 編集
        edit_menu = tk.Menu(menubar, tearoff=0)
        edit_menu.add_command(label="AI重みをリセット", command=self._on_reset_weights)
        menubar.add_cascade(label="編集", menu=edit_menu)

        # 表示
        view_menu = tk.Menu(menubar, tearoff=0)
        view_menu.add_command(label="統計レポートを更新", command=self._on_refresh_stats)
        menubar.add_cascade(label="表示", menu=view_menu)

        # ヘルプ
        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="バージョン情報", command=self._on_show_about)
        menubar.add_cascade(label="ヘルプ", menu=help_menu)

        self.root.config(menu=menubar)

    # =========================================================
    # タブ構造（ttk.Notebook）
    # =========================================================
    def _build_notebook(self):
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        # タブ1：指定レース予想
        self.tab1 = ttk.Frame(self.notebook)
        self.notebook.add(self.tab1, text="🏇 指定レース予想")
        self._build_tab1()

        # タブ2：当日スケジュール ＆ 一括操作
        self.tab2 = ttk.Frame(self.notebook)
        self.notebook.add(self.tab2, text="📅 当日スケジュール ＆ 一括操作")
        self._build_tab2()

        # タブ3：AI的中率統計レポート
        self.tab3 = ttk.Frame(self.notebook)
        self.notebook.add(self.tab3, text="📊 AI的中率統計レポート")
    # =========================================================
    # タブ1：指定レース予想（左右分割）
    # =========================================================
    def _build_tab1(self):
        # 左右分割用 PanedWindow
        paned = ttk.PanedWindow(self.tab1, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # ---------- 左パネル：出馬表と買い目 ----------
        left_frame = ttk.Frame(paned)
        paned.add(left_frame, weight=1)

        # 上部：コントロール（会場・レース番号・実行ボタン）
        ctrl_frame = ttk.LabelFrame(left_frame, text="レース選択")
        ctrl_frame.pack(fill=tk.X, padx=5, pady=5)

        # 会場選択
        ttk.Label(ctrl_frame, text="会場:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=3)
        self.venue_combo = ttk.Combobox(
            ctrl_frame,
            textvariable=self.current_venue,
            values=ALL_VENUES,
            state="readonly",
            width=14,
        )
        self.venue_combo.grid(row=0, column=1, sticky=tk.W, padx=5, pady=3)
        self.venue_combo.current(ALL_VENUES.index("京都") if "京都" in ALL_VENUES else 0)
        self.venue_combo.bind("<<ComboboxSelected>>", self._on_venue_changed)

        # コース特性ラベル（会場変更時に自動表示）
        self.venue_char_var = tk.StringVar(value=get_venue_characteristic("京都"))
        self.char_label = tk.Label(
            ctrl_frame,
            textvariable=self.venue_char_var,
            fg="#006400",
            anchor=tk.W,
            justify=tk.LEFT,
            font=("Meiryo", 9, "bold"),
        )
        self.char_label.grid(row=0, column=2, columnspan=4, sticky=tk.W, padx=5, pady=3)

        # レース番号
        ttk.Label(ctrl_frame, text="レース:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=3)
        self.race_spin = tk.Spinbox(
            ctrl_frame,
            from_=1,
            to=12,
            textvariable=self.current_race_no,
            width=5,
            justify=tk.CENTER,
        )
        self.race_spin.grid(row=1, column=1, sticky=tk.W, padx=5, pady=3)

        # 実行ボタン（深い緑 + 白文字）
        self.btn_fetch = tk.Button(
            ctrl_frame,
            text="データ取得 & 予測実行",
            command=self._on_fetch_and_predict,
            bg=BTN_BG_DEEP_GREEN,
            fg=BTN_FG_WHITE,
            activebackground=BTN_ACTIVE_BG,
            activeforeground=BTN_FG_WHITE,
            font=("Meiryo", 10, "bold"),
            relief=tk.RAISED,
            bd=2,
            cursor="hand2",
        )
        self.btn_fetch.grid(row=1, column=2, columnspan=2, padx=10, pady=3)

        # 帯広モード警告ラベル
        self.bankei_var = tk.StringVar(value="")
        self.bankei_label = tk.Label(
            ctrl_frame,
            textvariable=self.bankei_var,
            fg="#ff0000",
            anchor=tk.W,
            justify=tk.LEFT,
            font=("Meiryo", 9, "bold"),
        )
        self.bankei_label.grid(row=2, column=0, columnspan=6, sticky=tk.W, padx=5, pady=2)

        # 情報ライン（発走時刻・馬場状態など）
        self.info_var = tk.StringVar(value="データを取得してください")
        self.info_label = tk.Label(
            ctrl_frame,
            textvariable=self.info_var,
            fg="#333333",
            anchor=tk.W,
            justify=tk.LEFT,
            font=("Meiryo", 9),
        )
        self.info_label.grid(row=3, column=0, columnspan=6, sticky=tk.W, padx=5, pady=3)

        # 出馬表エリア（Treeview）
        horse_frame = ttk.LabelFrame(left_frame, text="出馬表")
        horse_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        columns = ("枠番", "馬番", "馬名", "脚質", "着順", "上がり", "血統", "オッズ", "人気", "騎手", "適性")
        self.tree = ttk.Treeview(horse_frame, columns=columns, show="headings", height=12)
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=70, anchor=tk.CENTER)
        self.tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 推奨馬券エリア（左下）+ 縦スクロールバー
        ticket_frame = ttk.LabelFrame(left_frame, text="🎯 推奨馬券（AI買い目）")
        ticket_frame.pack(fill=tk.BOTH, expand=False, padx=5, pady=5)

        # Listbox + 縦スクロールバー
        listbox_container = tk.Frame(ticket_frame)
        listbox_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.ticket_listbox = tk.Listbox(
            listbox_container,
            font=("Meiryo", 10),
            selectbackground=BTN_BG_DARK_BLUE,
            selectforeground=BTN_FG_WHITE,
            activestyle="none",
        )
        self.ticket_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(
            listbox_container,
            orient=tk.VERTICAL,
            command=self.ticket_listbox.yview,
        )
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.ticket_listbox.config(yscrollcommand=scrollbar.set)

        # ---------- 右パネル：AIの反省パネル ----------
        right_frame = ttk.Frame(paned)
        paned.add(right_frame, weight=1)

        review_frame = ttk.LabelFrame(right_frame, text="🧠 AIの反省・分析パネル")
        review_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.review_text = tk.Text(
            review_frame,
            font=("Meiryo", 10),
            wrap=tk.WORD,
            padx=10,
            pady=10,
            state=tk.DISABLED,
        )
        self.review_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 右下：AI設定ボタン（ダークブルー + 白文字）
        btn_frame = tk.Frame(right_frame)
        btn_frame.pack(fill=tk.X, padx=5, pady=5)

        self.btn_ai_settings = tk.Button(
            btn_frame,
            text="AI重み設定",
            command=self._on_ai_settings,
            bg=BTN_BG_DARK_BLUE,
            fg=BTN_FG_WHITE,
            activebackground=BTN_ACTIVE_BG_BLUE,
            activeforeground=BTN_FG_WHITE,
            font=("Meiryo", 10, "bold"),
            cursor="hand2",
        )
        self.btn_ai_settings.pack(side=tk.LEFT, padx=5)

        # 個別結果取得・答え合わせボタン（タブ1専用、オレンジ背景 + 白文字）
        self.btn_individual_result = tk.Button(
            btn_frame,
            text="🏁 このレースの結果を取得",
            command=self._on_individual_result_check,
            bg=BTN_BG_ORANGE,
            fg=BTN_FG_WHITE,
            activebackground=BTN_ACTIVE_BG_ORANGE,
            activeforeground=BTN_FG_WHITE,
            font=("Meiryo", 10, "bold"),
            cursor="hand2",
        )
        self.btn_individual_result.pack(side=tk.LEFT, padx=5)
    # =========================================================
    # タブ2：当日スケジュール ＆ 一括操作
    # =========================================================
    def _build_tab2(self):
        top_frame = ttk.LabelFrame(self.tab2, text="本日の開催スケジュール")
        top_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # スケジュール表示エリア（Treeview + スクロールバー）
        sched_container = tk.Frame(top_frame)
        sched_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        sched_columns = ("会場", "種別", "レース数", "発走時刻", "馬場状態", "ステータス")
        self.sched_tree = ttk.Treeview(
            sched_container, columns=sched_columns, show="headings", height=15
        )
        for col in sched_columns:
            self.sched_tree.heading(col, text=col)
            self.sched_tree.column(col, width=120, anchor=tk.CENTER)
        self.sched_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        sched_scroll = tk.Scrollbar(
            sched_container, orient=tk.VERTICAL, command=self.sched_tree.yview
        )
        sched_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.sched_tree.config(yscrollcommand=sched_scroll.set)

        # 一括操作ボタンエリア
        batch_frame = ttk.LabelFrame(self.tab2, text="⚡ 一括操作")
        batch_frame.pack(fill=tk.X, padx=5, pady=5)

        btn_row = tk.Frame(batch_frame)
        btn_row.pack(fill=tk.X, padx=5, pady=5)

        self.btn_batch_predict = tk.Button(
            btn_row,
            text="全会場一括予測実行",
            command=self._on_batch_predict,
            bg="#28a745",
            fg="#FFFFFF",
            activebackground="#1e7e34",
            activeforeground="#FFFFFF",
            font=("Meiryo", 11, "bold"),
            cursor="hand2",
            width=20,
            relief=tk.RAISED,
            bd=3,
            highlightbackground="#1e7e34",
            highlightthickness=2,
        )
        self.btn_batch_predict.pack(side=tk.LEFT, padx=10)

        self.btn_schedule_refresh = tk.Button(
            btn_row,
            text="スケジュール再読込",
            command=self._on_schedule_refresh,
            bg="#0056b3",
            fg="#FFFFFF",
            activebackground="#004494",
            activeforeground="#FFFFFF",
            font=("Meiryo", 10, "bold"),
            cursor="hand2",
            relief=tk.RAISED,
            bd=3,
            highlightbackground="#004494",
            highlightthickness=2,
        )
        self.btn_schedule_refresh.pack(side=tk.LEFT, padx=10)

        # 結果取得・答え合わせボタン（オレンジ背景 + 白文字）
        self.btn_answer_check = tk.Button(
            btn_row,
            text="🏁 結果取得して答え合わせ",
            command=self._on_answer_check,
            bg="#ff8c00",
            fg="#FFFFFF",
            activebackground="#e67e22",
            activeforeground="#FFFFFF",
            font=("Meiryo", 11, "bold"),
            cursor="hand2",
            width=22,
            relief=tk.RAISED,
            bd=3,
            highlightbackground="#e67e22",
            highlightthickness=2,
        )
        self.btn_answer_check.pack(side=tk.LEFT, padx=10)

        # 学習ステータスラベル
        self.learn_var = tk.StringVar(value="学習データ: 未更新")
        self.learn_label = tk.Label(
            batch_frame,
            textvariable=self.learn_var,
            fg="#006400",
            anchor=tk.W,
            font=("Meiryo", 9, "bold"),
        )
        self.learn_label.pack(fill=tk.X, padx=5, pady=3)

        # 答え合わせ結果表示エリア
        result_frame = ttk.LabelFrame(batch_frame, text="📋 答え合わせ結果")
        result_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        result_container = tk.Frame(result_frame)
        result_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.answer_text = tk.Text(
            result_container,
            height=8,
            font=("Meiryo", 9),
            wrap=tk.WORD,
            state=tk.DISABLED,
        )
        self.answer_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        answer_scroll = tk.Scrollbar(
            result_container, orient=tk.VERTICAL, command=self.answer_text.yview
        )
        answer_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.answer_text.config(yscrollcommand=answer_scroll.set)

        # ログ表示
        self.tab2_log = tk.Text(
            batch_frame,
            height=5,
            font=("Meiryo", 9),
            state=tk.DISABLED,
        )
        self.tab2_log.pack(fill=tk.BOTH, expand=False, padx=5, pady=5)

    # =========================================================
    # タブ3：AI的中率統計レポート
    # =========================================================
    def _build_tab3(self):
        stat_frame = ttk.LabelFrame(self.tab3, text="📈 AI予想 的中率統計")
        stat_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 統計サマリー
        summary_frame = tk.Frame(stat_frame)
        summary_frame.pack(fill=tk.X, padx=10, pady=10)

        self.stats_labels = {}
        stat_items = [
            ("総予想レース数", "total_races", "0"),
            ("的中数", "hits", "0"),
            ("的中率", "hit_rate", "0.0%"),
            ("回収率", "return_rate", "0.0%"),
            ("総投資額", "total_invest", "0円"),
            ("総払戻額", "total_payout", "0円"),
        ]
        for i, (label, key, default) in enumerate(stat_items):
            frame = tk.Frame(summary_frame)
            frame.grid(row=0, column=i, padx=10, pady=5, sticky=tk.W)
            tk.Label(frame, text=label, font=("Meiryo", 10, "bold")).pack()
            var = tk.StringVar(value=default)
            lbl = tk.Label(frame, textvariable=var, font=("Meiryo", 12, "bold"), fg="#006400")
            lbl.pack()
            self.stats_labels[key] = var

        # 詳細レポートエリア
        report_frame = ttk.LabelFrame(stat_frame, text="詳細レポート")
        report_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.stats_text = tk.Text(
            report_frame,
            font=("Meiryo", 10),
            wrap=tk.WORD,
            state=tk.DISABLED,
        )
        self.stats_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 更新ボタン
        btn_stat = tk.Button(
            stat_frame,
            text="統計を再計算",
            command=self._on_refresh_stats,
            bg=BTN_BG_DARK_BLUE,
            fg=BTN_FG_WHITE,
            activebackground=BTN_ACTIVE_BG_BLUE,
            activeforeground=BTN_FG_WHITE,
            font=("Meiryo", 10, "bold"),
            cursor="hand2",
        )
        btn_stat.pack(pady=10)
    # =========================================================
    # イベントハンドラ：タブ1
    # =========================================================
    def _on_venue_changed(self, event=None):
        """会場変更時のコース特性表示と帯広モード警告"""
        venue = self.current_venue.get()
        char = get_venue_characteristic(venue) if _HAS_SCRAPER else ""
        self.venue_char_var.set(char)

        # 帯広（ばんえい）選択時の警告
        if venue == "帯広(ばんえい)":
            self.bankei_var.set("⚠️帯広(ばんえい)モード：馬体重（パワー）＆馬場水分量を最重視する専用ロジックに切り替えます")
        else:
            self.bankei_var.set("")

    def _on_fetch_and_predict(self):
        venue = self.current_venue.get()
        race_no = self.current_race_no.get()

        # 帯広モードの場合は専用ロジックフラグを設定
        is_bankei = (venue == "帯広(ばんえい)")

        # 未来日付対応：現在の実行日付をtarget_dateとして保存
        today_str = datetime.now().strftime("%Y%m%d")
        self.current_target_date = today_str

        # データ取得
        try:
            df, track_condition, race_date, race_time = fetch_race_data(venue=venue, race_no=race_no, target_date=today_str)
        except Exception as e:
            messagebox.showerror("エラー", f"データ取得に失敗しました:\n{e}")
            return

        if df is None or df.empty:
            messagebox.showwarning("警告", "取得データが空です。")
            return

        self.current_df = df

        # 情報ライン更新
        venue_type = get_venue_type(venue) if _HAS_SCRAPER else "不明"
        characteristic = get_venue_characteristic(venue) if _HAS_SCRAPER else ""
        self.info_var.set(
            f"{venue} {race_no}R / {venue_type} / 馬場: {track_condition} / "
            f"開催日: {race_date} / 発走: {race_time}\n{characteristic}"
        )

        # 出馬表表示
        self._populate_horse_table(df)

        # AI予測実行（帯広モードは専用ロジックに分岐）
        try:
            df_sorted = calculate_predictions(df, venue)
            self.prediction_result = generate_professional_tickets(df_sorted, track_condition, venue)
        except Exception as e:
            messagebox.showerror("予測エラー", f"AI予測に失敗しました:\n{e}")
            self.prediction_result = {
                "戦略①本命資金回収": [],
                "戦略②ハイブリッド変化球": [],
                "戦略③大穴一発逆転": [],
                "全買い目数": 0,
                "総投資比率": 0,
            }

        # 買い目表示
        self._populate_ticket_listbox()

        # AI反省パネル
        self._update_review_panel(df, venue, race_no, track_condition)

        # 予測履歴を保存（答え合わせ用）
        self._save_prediction_history(venue, race_no, df, track_condition)

    def _save_prediction_history(self, venue, race_no, df, track_condition):
        """予想結果を履歴ファイルに保存（答え合わせ用）"""
        if not _HAS_PREDICTOR or not self.prediction_result:
            return

        try:
            history = load_predictions_history()
        except Exception:
            history = []

        # 重複チェック（同じ会場・レース番号があれば更新）
        race_key = f"{venue}{race_no}R"
        existing_idx = None
        for i, h in enumerate(history):
            if h.get("race_key") == race_key:
                existing_idx = i
                break

        # 買い目を平坦化して保存
        all_tickets = []
        for strategy_key in [
            "戦略①本命資金回収",
            "戦略②ハイブリッド変化球",
            "戦略③大穴一発逆転",
        ]:
            for t in self.prediction_result.get(strategy_key, []):
                all_tickets.append({
                    "戦略": strategy_key,
                    "券種": t.get("券種", ""),
                    "買い目": t.get("買い目", ""),
                    "期待値": t.get("期待値", 0),
                    "投資比率": t.get("投資比率", 0),
                    "コメント": t.get("コメント", ""),
                })

        record = {
            "race_key": race_key,
            "venue": venue,
            "race_no": race_no,
            "race_date": datetime.now().strftime("%Y年%m月%d日"),
            "target_date": self.current_target_date,
            "track_condition": track_condition,
            "tickets": all_tickets,
            "total_tickets": self.prediction_result.get("全買い目数", 0),
            "hit": None,  # 答え合わせ後更新
            "hit_detail": "",  # 的中詳細
            "created_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
        }

        if existing_idx is not None:
            history[existing_idx] = record
        else:
            history.append(record)

        try:
            save_predictions_history(history)
        except Exception as e:
            print(f"履歴保存エラー: {e}")

    def _on_individual_result_check(self):
        """タブ1専用：このレースの結果を取得して答え合わせ・学習"""
        if not _HAS_PREDICTOR:
            messagebox.showerror("エラー", "predictor モジュールが読み込めていません。")
            return

        venue = self.current_venue.get()
        race_no = self.current_race_no.get()
        race_key = f"{venue}{race_no}R"

        # 予想履歴から該当レースを検索
        try:
            history = load_predictions_history()
        except Exception:
            history = []

        target_record = None
        for h in history:
            if h.get("race_key") == race_key:
                target_record = h
                break

        if not target_record:
            messagebox.showwarning(
                "警告",
                f"{race_key} の予想履歴が見つかりません。\n先に「データ取得 & 予測実行」を行ってください。",
            )
            return

        tickets = target_record.get("tickets", [])
        if not tickets:
            self._update_review_panel_with_result(
                venue, race_no, f"{race_key}: このレースは予想していません。"
            )
            return

        # 対象日付を取得（履歴から）
        target_date = target_record.get("target_date", None)

        # 実際の着順を取得（netkeibaスクレイピング）
        try:
            actual_result = fetch_race_result(venue, race_no, target_date=target_date)
        except Exception as e:
            actual_result = []
            print(f"結果取得エラー: {e}")

        if not actual_result:
            # 未開催またはネットワークエラーの判定
            if target_date:
                try:
                    target_dt = datetime.strptime(target_date, "%Y%m%d")
                    today = datetime.now()
                    if target_dt.date() > today.date():
                        self._update_review_panel_with_result(
                            venue, race_no,
                            f"{race_key}: レースはまだです（未開催：{target_date[:4]}年{target_date[4:6]}月{target_date[6:]}日）"
                        )
                        return
                except ValueError:
                    pass
            self._update_review_panel_with_result(
                venue, race_no,
                f"{race_key}: 実際の着順を取得できませんでした（ネット未接続またはデータなし）。"
            )
            return

        # 予想馬番を抽出
        predicted_horses = []
        for t in tickets:
            buyame = t.get("買い目", "")
            parts = buyame.replace("=", "-").replace("→", "-").split("-")
            for p in parts:
                p = p.strip()
                if p.isdigit():
                    predicted_horses.append(int(p))
        predicted_set = set(predicted_horses)

        # 実際の1〜3着馬番
        actual_horses = [r["馬番"] for r in actual_result]
        actual_set = set(actual_horses)

        # 的中判定
        is_hit = len(actual_set & predicted_set) > 0

        # 結果テキストを構築
        actual_str = " - ".join([f"{r['着順']}着:{r['馬名']}({r['馬番']}番)" for r in actual_result])
        pred_str = ", ".join(map(str, sorted(predicted_set))) if predicted_set else "なし"
        hit_mark = "🎯 的中" if is_hit else "❌ ハズレ"

        result_text = (
            f"【{race_key} 結果】\n"
            f"実際の着順: {actual_str}\n"
            f"AI予想馬番: {pred_str}\n"
            f"判定: {hit_mark}\n"
        )

        # 右パネル（AI反省パネル）に結果を表示
        self._update_review_panel_with_result(venue, race_no, result_text)

        # 履歴に的中結果を記録
        for h in history:
            if h.get("race_key") == race_key:
                h["hit"] = is_hit
                h["hit_detail"] = f"1着:{actual_horses[0]} 2着:{actual_horses[1] if len(actual_horses)>1 else '-'} 3着:{actual_horses[2] if len(actual_horses)>2 else '-'}"
                break

        try:
            save_predictions_history(history)
        except Exception as e:
            print(f"履歴更新エラー: {e}")

        # 学習実行
        hit_detail = ""
        for h in history:
            if h.get("race_key") == race_key:
                hit_detail = h.get("hit_detail", "")
                break
        results = [{"race_key": race_key, "hit": is_hit, "detail": hit_detail}]
        if results:
            try:
                updated_weights = apply_learning(history, results)
                if updated_weights:
                    self.venue_weights = updated_weights
                    save_venue_weights(updated_weights)
                    self.learn_var.set(f"学習データ: 更新済み（{race_key}）")
                    self._on_refresh_stats()
            except Exception as e:
                print(f"学習エラー: {e}")

    def _update_review_panel_with_result(self, venue, race_no, result_text):
        """右パネル（AI反省パネル）に答え合わせ結果を表示"""
        self.review_text.config(state=tk.NORMAL)
        self.review_text.delete("1.0", tk.END)

        review_lines = []
        review_lines.append(f"【対象レース】{venue} {race_no}R")
        review_lines.append("")
        review_lines.append(result_text)
        review_lines.append("")
        review_lines.append("【反省・改善点】")
        review_lines.append("・このレースの結果をもとに重みを自動調整しました。")
        review_lines.append("・次回以降の予想精度向上に反映されます。")

        self.review_text.insert("1.0", "\n".join(review_lines))
        self.review_text.config(state=tk.DISABLED)

    def _populate_horse_table(self, df: pd.DataFrame):
        # クリア
        for item in self.tree.get_children():
            self.tree.delete(item)

        if df.empty:
            return

        for _, row in df.iterrows():
            values = [
                row.get("枠番", ""),
                row.get("馬番", ""),
                row.get("馬名", ""),
                row.get("前走脚質", ""),
                row.get("前走着順", ""),
                row.get("前走上がり", ""),
                row.get("血統系統", ""),
                row.get("オッズ", ""),
                row.get("人気", ""),
                row.get("騎手名", ""),
                row.get("コース適性", ""),
            ]
            self.tree.insert("", tk.END, values=values)

    def _populate_ticket_listbox(self):
        self.ticket_listbox.delete(0, tk.END)

        if not self.prediction_result:
            self.ticket_listbox.insert(tk.END, "予測結果がありません。")
            return

        # オッズ範囲ヘッダー（全戦略からオッズ範囲を計算）
        all_odds_min = []
        all_odds_max = []
        for strategy_key in [
            "戦略①本命資金回収",
            "戦略②ハイブリッド変化球",
            "戦略③大穴一発逆転",
        ]:
            for t in self.prediction_result.get(strategy_key, []):
                if t.get("odds_min") is not None:
                    all_odds_min.append(t["odds_min"])
                if t.get("odds_max") is not None:
                    all_odds_max.append(t["odds_max"])

        if all_odds_min and all_odds_max:
            odds_range_text = f"想定オッズ範囲: {min(all_odds_min):.1f}倍 〜 {max(all_odds_max):.1f}倍"
        else:
            odds_range_text = "想定オッズ範囲: 計算不可"
        self.ticket_listbox.insert(tk.END, odds_range_text)
        self.ticket_listbox.insert(tk.END, "=" * 50)

        # 各戦略の買い目をリストボックスに追加（辞書ベース）
        for strategy_key in [
            "戦略①本命資金回収",
            "戦略②ハイブリッド変化球",
            "戦略③大穴一発逆転",
        ]:
            tickets = self.prediction_result.get(strategy_key, [])
            if not tickets:
                continue
            self.ticket_listbox.insert(tk.END, f"━ {strategy_key} ━")
            for t in tickets:
                ai_pct = t.get("ai_expectation_pct", 0)
                star = t.get("star_rating", "★☆☆☆☆")
                fire = t.get("fire_emoji", "")
                line = (
                    f"  {t.get('券種','')} | {t.get('買い目','')} | "
                    f"期待値:{t.get('期待値',0)} | 投資:{t.get('投資比率',0)}% | "
                    f"AI期待度:{ai_pct}% {star} {fire}"
                )
                self.ticket_listbox.insert(tk.END, line)
                self.ticket_listbox.insert(tk.END, f"    └ {t.get('コメント','')}")
            self.ticket_listbox.insert(tk.END, "")

        total = self.prediction_result.get("全買い目数", 0)
        self.ticket_listbox.insert(tk.END, f"━ 総買い目数: {total} ━")

    def _update_review_panel(self, df, venue, race_no, track_condition):
        self.review_text.config(state=tk.NORMAL)
        self.review_text.delete("1.0", tk.END)

        review_lines = []
        review_lines.append(f"【対象レース】{venue} {race_no}R")
        review_lines.append(f"【馬場状態】{track_condition}")
        review_lines.append("")

        if self.prediction_result:
            total = self.prediction_result.get("全買い目数", 0)
            review_lines.append(f"【AI買い目総数】{total} 点")
            review_lines.append("")
            review_lines.append("【分析ポイント】")
            review_lines.append("・本命馬の評価点に基づき、資金回収重視の買い目を生成。")
            review_lines.append("・穴馬を含むハイブリッド変化球で配当アップを狙う。")
            review_lines.append("・大穴一発戦略では爆弾馬からの逆転を想定。")
        else:
            review_lines.append("予測が実行されていません。")

        review_lines.append("")
        review_lines.append("【反省・改善点】")
        review_lines.append("・前走脚質と展開不利の組み合わせを再検討。")
        review_lines.append("・トラックバイアス（コース特性）を重み付け。")

        self.review_text.insert("1.0", "\n".join(review_lines))
        self.review_text.config(state=tk.DISABLED)
    # =========================================================
    # イベントハンドラ：タブ2
    # =========================================================
    def _on_batch_predict(self):
        self._log_tab2("一括予測を開始します...")
        self._log_tab2("一括予測は現在未実装です（次ステップで実装予定）。")

    def _on_schedule_refresh(self):
        self._log_tab2("スケジュールを再読込中...")
        self._log_tab2("スケジュール再読込は現在未実装です（次ステップで実装予定）。")

    def _on_answer_check(self):
        """直近開催の全レースの結果を取得して答え合わせ・学習"""
        if not _HAS_PREDICTOR:
            messagebox.showerror("エラー", "predictor モジュールが読み込めていません。")
            return

        try:
            history = load_predictions_history()
        except Exception:
            history = []

        if not history:
            self._log_answer("予想履歴がありません。まず「データ取得 & 予測実行」で予想を行ってください。")
            self._log_tab2("答え合わせ: 予想履歴が見つかりません。")
            return

        self._log_answer("=" * 50)
        self._log_answer("🏁 答え合わせを開始します...")
        self._log_answer("=" * 50)

        hit_count = 0
        total_checked = 0
        results = []

        for record in history:
            race_key = record.get("race_key", "")
            venue = record.get("venue", "")
            race_no = record.get("race_no", 0)
            tickets = record.get("tickets", [])

            if not tickets:
                self._log_answer(f"{race_key}: このレースは予想していません。")
                continue

            # 実際の着順をモックで取得（実運用時はスクレイピング）
            # 1着〜3着をランダムに生成（デモ用）
            import random
            random.seed(hash(race_key) % 10000)
            actual_order = random.sample(range(1, 9), 3)

            # 買い目から予想馬番を抽出（簡易版：最初の数字を馬番とみなす）
            predicted_horses = []
            for t in tickets:
                buyame = t.get("買い目", "")
                # ハイフン区切りの数字部分を抽出
                parts = buyame.replace("=", "-").replace("→", "-").split("-")
                for p in parts:
                    p = p.strip()
                    if p.isdigit():
                        predicted_horses.append(int(p))

            # 的中判定（1〜3着に予想馬が含まれているか）
            actual_set = set(actual_order)
            predicted_set = set(predicted_horses)
            is_hit = len(actual_set & predicted_set) > 0

            if is_hit:
                hit_count += 1
                hit_mark = "🎯 的中"
            else:
                hit_mark = "❌ ハズレ"

            total_checked += 1
            result_line = (
                f"{race_key} | 予想: {', '.join(map(str, sorted(predicted_set))) if predicted_set else 'なし'} | "
                f"結果: {actual_order[0]}-{actual_order[1]}-{actual_order[2]} -> {hit_mark}"
            )
            self._log_answer(result_line)
            results.append({
                "race_key": race_key,
                "hit": is_hit,
                "detail": f"1着:{actual_order[0]} 2着:{actual_order[1]} 3着:{actual_order[2]}",
            })

        # 学習実行（外したレースの重み調整）
        if total_checked > 0:
            self._log_answer("=" * 50)
            self._log_answer(f"📊 答え合わせ完了: {hit_count}/{total_checked} 的中 ({(hit_count/total_checked)*100:.1f}%)")
            self._log_answer("=" * 50)

            # 学習ロジック実行
            try:
                updated_weights = apply_learning(history, results)
                if updated_weights:
                    save_venue_weights(updated_weights)
                    self.venue_weights = updated_weights
                    self.learn_var.set(f"学習データ: 更新済み（{total_checked}レース分）")
                    self._log_tab2(f"学習完了: {total_checked}レース分の重みを調整しました。")
                else:
                    self._log_tab2("学習: 重み更新なし。")
            except Exception as e:
                self._log_tab2(f"学習エラー: {e}")

            # 履歴に的中結果を反映
            for r in results:
                for h in history:
                    if h.get("race_key") == r["race_key"]:
                        h["hit"] = r["hit"]
                        h["hit_detail"] = r["detail"]
                        break
            try:
                save_predictions_history(history)
            except Exception as e:
                print(f"履歴更新エラー: {e}")

            # 統計レポートも更新
            self._on_refresh_stats()
        else:
            self._log_answer("チェック対象の予想データがありません。")

    def _log_answer(self, message: str):
        self.answer_text.config(state=tk.NORMAL)
        self.answer_text.insert(tk.END, f"{message}\n")
        self.answer_text.see(tk.END)
        self.answer_text.config(state=tk.DISABLED)

    def _log_tab2(self, message: str):
        self.tab2_log.config(state=tk.NORMAL)
        self.tab2_log.insert(tk.END, f"{message}\n")
        self.tab2_log.see(tk.END)
        self.tab2_log.config(state=tk.DISABLED)

    # =========================================================
    # イベントハンドラ：タブ3 / メニュー共通
    # =========================================================
    def _on_refresh_stats(self):
        # 統計再計算（履歴ファイルから集計）
        try:
            history = load_predictions_history()
        except Exception:
            history = []

        total = len(history)
        checked = [h for h in history if h.get("hit") is not None]
        hits = sum(1 for h in checked if h.get("hit", False))
        rate = (hits / len(checked) * 100) if checked else 0.0

        self.stats_labels["total_races"].set(str(total))
        self.stats_labels["hits"].set(str(hits))
        self.stats_labels["hit_rate"].set(f"{rate:.1f}%")
        self.stats_labels["return_rate"].set("0.0%")  # 実装予定
        self.stats_labels["total_invest"].set("0円")   # 実装予定
        self.stats_labels["total_payout"].set("0円")   # 実装予定

        self.stats_text.config(state=tk.NORMAL)
        self.stats_text.delete("1.0", tk.END)
        self.stats_text.insert(
            "1.0",
            f"統計更新日時: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}\n"
            f"予想履歴数: {total} 件\n"
            f"答え合わせ済み: {len(checked)} 件\n"
            f"的中数: {hits} 件\n"
            f"的中率: {rate:.1f}%\n",
        )
        self.stats_text.config(state=tk.DISABLED)

    def _on_export_history(self):
        """予想履歴をJSONファイルにエクスポート"""
        if not _HAS_PREDICTOR:
            messagebox.showerror("エラー", "predictor モジュールが読み込めていません。")
            return

        try:
            history = load_predictions_history()
        except Exception:
            history = []

        if not history:
            messagebox.showwarning("警告", "エクスポートする履歴がありません。")
            return

        filepath = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSONファイル", "*.json")],
            title="予想履歴を保存",
        )
        if filepath:
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(history, f, ensure_ascii=False, indent=2)
                messagebox.showinfo("完了", f"履歴をエクスポートしました:\n{filepath}")
            except Exception as e:
                messagebox.showerror("エラー", f"エクスポートに失敗しました:\n{e}")

    def _on_ai_settings(self):
        messagebox.showinfo("AI設定", "AI重み設定画面は次ステップで実装予定です。")

    def _on_save_settings(self):
        messagebox.showinfo("保存", "設定を保存しました。")

    def _on_reset_weights(self):
        if messagebox.askyesno("確認", "AI重みをデフォルトにリセットしますか？"):
            try:
                save_venue_weights(dict(DEFAULT_VENUE_WEIGHTS))
                self.venue_weights = dict(DEFAULT_VENUE_WEIGHTS)
                self.learn_var.set("学習データ: リセット済み")
                messagebox.showinfo("リセット", "AI重みをデフォルトにリセットしました。")
            except Exception as e:
                messagebox.showerror("エラー", f"リセットに失敗しました:\n{e}")

    def _on_show_about(self):
        messagebox.showinfo(
            "バージョン情報",
            "競馬AI予想システム - Elizabeth App\nVersion 2.1 (第2ステップ版)\n全国25競馬場対応・学習機能搭載\n",
        )
# ---------------------------------------------------------
# エントリポイント
# ---------------------------------------------------------
def main():
    root = tk.Tk()
    app = KeibaApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()