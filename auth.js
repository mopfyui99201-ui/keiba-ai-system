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
        } else if (section === "admin") {
            filterBar.style.display = "none";
            setupAdminTab();
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
// ============================================================
// 管理者メニュー ハンドラ
// ============================================================

function setupAdminTab() {
    updateAdminStatus();
    renderAdminWeights();
    document.getElementById("btn-save-weights").onclick = saveWeights;
    document.getElementById("btn-reset-weights").onclick = resetWeights;
    document.getElementById("btn-export-history").onclick = exportHistory;
    document.getElementById("btn-reset-history").onclick = resetHistory;
}

function updateAdminStatus() {
    try {
        const raceCount = allPredictions.length;
        document.getElementById("status-race-count").textContent = raceCount + " レース";
        document.getElementById("status-last-run").textContent = new Date().toLocaleString("ja-JP");
        fetch("data/learning.json")
            .then(res => res.json())
            .then(data => {
                if (data.updated_at) {
                    document.getElementById("status-data-updated").textContent = data.updated_at;
                }
            })
            .catch(() => {
                document.getElementById("status-data-updated").textContent = "取得失敗";
            });
    } catch (e) {
        console.error("ステータス更新エラー:", e);
    }
}

function renderAdminWeights() {
    const container = document.getElementById("admin-weights");
    if (!container) return;
    const weights = allWeights || {};
    const venues = Object.keys(weights);
    if (venues.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;">重みデータがありません。</p>';
        return;
    }
    let html = '<div class="admin-weights-editor" style="max-height:400px; overflow-y:auto; border:1px solid #334155; border-radius:6px; padding:12px; background:#0f172a;">';
    venues.forEach(v => {
        const w = weights[v] || {};
        html += '<div class="weight-venue-block" style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #334155;">';
        html += '<div class="weight-venue-name" style="color:#38bdf8; font-weight:bold; margin-bottom:8px; font-size:14px;">' + v + '</div>';
        html += '<div class="weight-item-row" style="display:flex; flex-wrap:wrap; gap:8px;">';
        Object.entries(w).forEach(([k, val]) => {
            html += '<div class="weight-edit-item" style="display:flex; align-items:center; gap:6px; margin:4px 0;">';
            html += '<span class="weight-name" style="color:#cbd5e1; font-size:12px; min-width:140px;">' + k + '</span>';
            html += '<input type="number" class="weight-input" style="width:70px; padding:4px; background:#0f172a; color:#f8fafc; border:1px solid #475569; border-radius:4px;" data-venue="' + v + '" data-key="' + k + '" value="' + val + '">';
            html += '</div>';
        });
        html += '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function saveWeights() {
    const inputs = document.querySelectorAll(".weight-input");
    const newWeights = {};
    inputs.forEach(input => {
        const venue = input.getAttribute("data-venue");
        const key = input.getAttribute("data-key");
        const val = parseFloat(input.value);
        if (!newWeights[venue]) newWeights[venue] = {};
        newWeights[venue][key] = isNaN(val) ? 0 : val;
    });
    const merged = { ...(allWeights || {}), ...newWeights };
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "venue_weights_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("重み設定をJSONファイルとしてダウンロードしました。\nGitHub Actions で data/ 以下に反映させる場合は、生成されたファイルをリポジトリにコミットしてプッシュしてください。");
}

function resetWeights() {
    if (!confirm("AI重みをデフォルト値にリセットしますか？\nこの操作は元に戻せません。")) {
        return;
    }
    allWeights = {};
    document.getElementById("admin-weights").innerHTML = '<p style="color:#94a3b8;">重みデータがリセットされました。</p>';
    alert("ブラウザ上の重みデータをクリアしました。ページを再読み込みするとサーバー側のデータが復元されます。");
}

function exportHistory() {
    fetch("data/predictions.json")
        .then(res => res.json())
        .then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "predictions_history_" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(e => {
            console.error("エクスポートエラー:", e);
            alert("履歴のエクスポートに失敗しました。");
        });
}

function resetHistory() {
    if (!confirm("予想履歴をリセットしますか？\nこの操作は元に戻せません。")) {
        return;
    }
    allPredictions = [];
    document.getElementById("grid-jra").innerHTML = '<div class="empty-msg">予想データがありません</div>';
    document.getElementById("grid-nar").innerHTML = '<div class="empty-msg">予想データがありません</div>';
    document.getElementById("grid-bankei").innerHTML = '<div class="empty-msg">予想データがありません</div>';
    document.getElementById("grid-top").innerHTML = '<div class="empty-msg">予想データがありません</div>';
    document.getElementById("count-jra").textContent = "0 レース";
    document.getElementById("count-nar").textContent = "0 レース";
    document.getElementById("count-bankei").textContent = "0 レース";
    document.getElementById("count-top").textContent = "0 レース";
    document.getElementById("status-race-count").textContent = "0 レース";
    alert("ブラウザ上の予想履歴をクリアしました。ページを再読み込みするとサーバー側のデータが復元されます。");
}
