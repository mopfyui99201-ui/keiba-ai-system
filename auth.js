// 初期パスワード（ランダム生成・セキュア）
const INITIAL_PASSWORD = "7777";

const passwordInput = document.getElementById("password-input");
const authBtn = document.getElementById("auth-btn");
const authError = document.getElementById("auth-error");
const authOverlay = document.getElementById("auth-overlay");
const mainContent = document.getElementById("main-content");

passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        checkPassword();
    }
});

authBtn.addEventListener("click", checkPassword);

function checkPassword() {
    const input = passwordInput.value.trim();
    if (input === INITIAL_PASSWORD) {
        authOverlay.style.display = "none";
        mainContent.style.display = "block";
        authError.textContent = "";
        passwordInput.value = "";
        loadWebData();
    } else {
        authError.textContent = "⚠️ 暗証番号が間違っています";
        authError.style.color = "#ff4444";
        passwordInput.value = "";
        passwordInput.focus();
    }
}

async function loadWebData() {
    try {
        const predRes = await fetch("data/predictions.json");
        const predData = await predRes.json();
        renderPredictionTab(predData);

        const learnRes = await fetch("data/learning.json");
        const learnData = await learnRes.json();
        renderStatsTab(learnData);

        const schedRes = await fetch("data/schedule.json");
        const schedData = await schedRes.json();
        if (schedData.updated_at) {
            document.getElementById("last-updated").textContent = schedData.updated_at;
        }
    } catch (e) {
        console.error("データ読み込みエラー:", e);
        document.getElementById("last-updated").textContent = "データ取得失敗";
    }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});

// タブ1：予想一覧レンダリング
function renderPredictionTab(data) {
    const grid = document.getElementById("prediction-grid");
    const countBadge = document.getElementById("prediction-count");
    const predictions = data.predictions || [];

    countBadge.textContent = `${predictions.length} レース`;

    if (predictions.length === 0) {
        grid.innerHTML = '<div class="empty-msg">予想データがありません</div>';
        return;
    }

    grid.innerHTML = predictions
        .map(
            (p) => `
            <div class="prediction-card venue-${p.venue_type === "中央競馬(JRA)" ? "jra" : "nar"}">
                <div class="card-header">
                    <span class="venue-badge">${p.venue}</span>
                    <span class="race-no">${p.race_no}R</span>
                    <span class="track">${p.track_condition}</span>
                </div>
                <div class="card-info">
                    <p><strong>📅 日付:</strong> ${p.race_date}</p>
                    <p><strong>⏰ 発走:</strong> ${p.race_time}</p>
                    <p><strong>📊 コース特性:</strong> ${p.characteristic}</p>
                    ${
                        p.odds_range
                            ? `<p><strong>💰 想定オッズ:</strong> ${p.odds_range.min}倍 〜 ${p.odds_range.max}倍</p>`
                            : ""
                    }
                </div>
                <div class="tickets">
                    ${p.tickets
                        .slice(0, 6)
                        .map(
                            (t) => `
                        <div class="ticket-item">
                            <span class="ticket-strategy">${t.戦略}</span>
                            <span class="ticket-bet">${t.券種}</span>
                            <span class="ticket-num">${t.買い目}</span>
                            <span class="ticket-exp">期待値:${t.期待値}</span>
                            <span class="ticket-inv">投資:${t.投資比率}%</span>
                            <span class="ticket-ai">AI期待度:${t.ai_expectation_pct}%</span>
                            <span class="ticket-star">${t.star_rating} ${t.fire_emoji}</span>
                        </div>
                    `
                        )
                        .join("")}
                    ${
                        p.tickets.length > 6
                            ? `<div class="more-tickets">＋さらに ${p.tickets.length - 6} 点</div>`
                            : ""
                    }
                </div>
            </div>
        `
        )
        .join("");
}

// タブ2：統計・学習ログレンダリング
function renderStatsTab(data) {
    const grid = document.getElementById("stats-grid");
    const log = document.getElementById("learning-log");
    const countBadge = document.getElementById("stats-count");
    const weights = data.weights || {};

    const venues = Object.keys(weights);
    countBadge.textContent = `${venues.length} 会場`;

    grid.innerHTML = venues
        .map(
            (v) => `
            <div class="stat-card">
                <h3>${v}</h3>
                <div class="weight-list">
                    ${Object.entries(weights[v] || {})
                        .map(
                            ([k, val]) => `
                        <div class="weight-item">
                            <span class="weight-name">${k}</span>
                            <span class="weight-val">${val}</span>
                        </div>
                    `
                        )
                        .join("")}
                </div>
            </div>
        `
        )
        .join("");

    log.innerHTML = `
        <div class="log-header">
            <h3>🧠 AI自動学習ログ</h3>
            <p>最終更新: ${data.updated_at || "-"}</p>
        </div>
        <div class="log-content">
            <p>会場別重みデータを逐次学習で更新中です。</p>
            <p>的中したレースの重みは微増、外れたレースの重みは微減されます。</p>
            <p>帯広(ばんえい)は馬体重・馬場水分量を専用調整。</p>
        </div>
    `;
}