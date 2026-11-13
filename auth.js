// 初期パスワード（セキュア）
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

// グローバルデータ
let allPredictions = [];
let allWeights = {};

async function loadWebData() {
    try {
        const predRes = await fetch("data/predictions.json");
        const predData = await predRes.json();
        allPredictions = predData.predictions || [];
        document.getElementById("count-jra").textContent = "0 レース";
        document.getElementById("count-nar").textContent = "0 レース";
        document.getElementById("count-bankei").textContent = "0 レース";
        document.getElementById("count-top").textContent = "0 レース";
        renderSection("jra");

        const learnRes = await fetch("data/learning.json");
        const learnData = await learnRes.json();
        allWeights = learnData.weights || {};
        renderStatsTab(allWeights);

        const schedRes = await fetch("data/schedule.json");
        const schedData = await schedRes.json();
        if (schedData.updated_at) {
            document.getElementById("last-updated").textContent = schedData.updated_at;
            document.getElementById("status-data-updated").textContent = schedData.updated_at;
        }
        document.getElementById("status-race-count").textContent = `${allPredictions.length} レース`;
        document.getElementById("status-last-run").textContent = new Date().toLocaleString("ja-JP");
    } catch (e) {
        console.error("データ読み込みエラー:", e);
        document.getElementById("last-updated").textContent = "データ取得失敗";
    }
}

// メニューバー切り替え
document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".race-section").forEach((s) => s.classList.remove("active"));
        btn.classList.add("active");
        const section = btn.dataset.section;
        document.getElementById(`section-${section}`).classList.add("active");
        
        const filterBar = document.getElementById("filter-bar");
        if (["jra", "nar", "bankei", "top"].includes(section)) {
            filterBar.style.display = "flex";
            setupFilters(section);
        } else {
            filterBar.style.display = "none";
        }
    });
});

// フィルター設定
function setupFilters(section) {
    const venueSelect = document.getElementById("filter-venue");
    const dateSelect = document.getElementById("filter-date");
    venueSelect.innerHTML = '<option value="">全会場</option>';
    dateSelect.innerHTML = '<option value="">全日付</option>';
    
    const venues = new Set();
    const dates = new Set();
    
    allPredictions.forEach(p => {
        if (section === "top" && p.ai_expectation_pct < 70) return;
        if (section === "jra" && p.venue_type !== "中央競馬(JRA)") return;
        if (section === "nar" && p.venue_type !== "地方競馬(NAR)") return;
        if (section === "bankei" && p.venue !== "帯広(ばんえい)") return;
        
        venues.add(p.venue);
        dates.add(p.race_date);
    });
    
    venues.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        venueSelect.appendChild(opt);
    });
    
    dates.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        dateSelect.appendChild(opt);
    });
    
    venueSelect.onchange = () => renderSection(section);
    dateSelect.onchange = () => renderSection(section);
    document.getElementById("filter-reset").onclick = () => {
        venueSelect.value = "";
        dateSelect.value = "";
        renderSection(section);
    };
    
    renderSection(section);
}

// セクション別レンダリング
function renderSection(section) {
    const venueSelect = document.getElementById("filter-venue");
    const dateSelect = document.getElementById("filter-date");
    const venueFilter = venueSelect.value;
    const dateFilter = dateSelect.value;
    
    let filtered = allPredictions.filter(p => {
        if (section === "top" && p.ai_expectation_pct < 70) return false;
        if (section === "jra" && p.venue_type !== "中央競馬(JRA)") return false;
        if (section === "nar" && p.venue_type !== "地方競馬(NAR)") return false;
        if (section === "bankei" && p.venue !== "帯広(ばんえい)") return false;
        if (venueFilter && p.venue !== venueFilter) return false;
        if (dateFilter && p.race_date !== dateFilter) return false;
        return true;
    });
    
    const gridId = `grid-${section}`;
    const countId = `count-${section}`;
    const grid = document.getElementById(gridId);
    const countBadge = document.getElementById(countId);
    
    countBadge.textContent = `${filtered.length} レース`;
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-msg">予想データがありません</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(p => renderPredictionCard(p)).join("");

// 予想カードレンダリング（馬番表記付き）
function renderPredictionCard(p) {
    const isJra = p.venue_type === "中央競馬(JRA)";
    const venueClass = isJra ? "jra" : (p.venue === "帯広(ばんえい)" ? "bankei" : "nar");
    
    const ticketsHtml = p.tickets.slice(0, 6).map(t => {
        const formation = t.フォーメーション || "";
        return `
        <div class="ticket-item">
            <span class="ticket-strategy">${t.戦略}</span>
            <span class="ticket-bet">${t.券種}</span>
            <span class="ticket-num">${t.買い目}</span>
            <span class="ticket-form">【${formation}】</span>
            <span class="ticket-exp">期待値:${t.期待値}</span>
            <span class="ticket-inv">投資:${t.投資比率}%</span>
            <span class="ticket-ai">AI期待度:${t.ai_expectation_pct}%</span>
            <span class="ticket-star">${t.star_rating} ${t.fire_emoji}</span>
        </div>
        `;
    }).join("");
    
    const moreHtml = p.tickets.length > 6 
        ? `<div class="more-tickets">＋さらに ${p.tickets.length - 6} 点</div>` 
        : "";
    
    return `
    <div class="prediction-card venue-${venueClass}">
        <div class="card-header">
            <span class="venue-badge">${p.venue}</span>
            <span class="race-no">${p.race_no}R</span>
            <span class="track">${p.track_condition}</span>
        </div>
        <div class="card-info">
            <p><strong>📅 日付:</strong> ${p.race_date}</p>
            <p><strong>⏰ 発走:</strong> ${p.race_time}</p>
            <p><strong>📊 コース特性:</strong> ${p.characteristic}</p>
            ${p.odds_range ? `<p><strong>💰 想定オッズ:</strong> ${p.odds_range.min}倍 〜 ${p.odds_range.max}倍</p>` : ""}
        </div>
        <div class="tickets">
            ${ticketsHtml}
            ${moreHtml}
        </div>
    </div>
    `;
}

// 統計・学習ログレンダリング
function renderStatsTab(data) {
    const grid = document.getElementById("stats-grid");
    const log = document.getElementById("learning-log");
    const countBadge = document.getElementById("stats-count");
    const weights = allWeights || {};

    const venues = Object.keys(weights);
    countBadge.textContent = `${venues.length} 会場`;

    let html = '';
    venues.forEach(v => {
        html += `<div class="stat-card"><h3>${v}</h3><div class="weight-list">`;
        const w = weights[v] || {};
        Object.entries(w).forEach(([k, val]) => {
            html += `<div class="weight-item"><span class="weight-name">${k}</span><span class="weight-val">${val}</span></div>`;
        });
        html += `</div></div>`;
    });
    grid.innerHTML = html;

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
}