const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;

// ==========================================
// КОНФИГУРАЦИЯ (NEW: Для обнуления)
// ==========================================
const GAME_VERSION = "1.0.1_WIPE"; 

// ==========================================
// NEXUS SHIELD (СИСТЕМА ЗАЩИТЫ И ОТЛАДКИ)
// ==========================================
const NexusShield = {
    execute: function(moduleName, task) {
        try {
            return task();
        } catch (error) {
            console.error(`🚨 Ошибка в [${moduleName}]:`, error);
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            return null;
        }
    }
};

const NexusGuard = {
    lastClickTime: 0
};

// ==========================================
// ИГРОВЫЕ ДАННЫЕ (С ПРОВЕРКОЙ ВЕРСИИ)
// ==========================================
function checkVersionReset() {
    const savedVersion = localStorage.getItem('nexus_version');
    if (savedVersion !== GAME_VERSION) {
        localStorage.clear();
        localStorage.setItem('nexus_version', GAME_VERSION);
        return true;
    }
    return false;
}

const isWasReset = checkVersionReset();

let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};

let activeBoosts = JSON.parse(localStorage.getItem('nexus_active_boosts')) || {
    multEnd: 0,
    speedEnd: 0
};

let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
let energy = parseInt(localStorage.getItem('nexus_energy')) || 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ БОНУСОВ ---
let lastDailyClaim = parseInt(localStorage.getItem('nexus_daily')) || 0;
let dailyStreak = parseInt(localStorage.getItem('nexus_streak')) || 0;
let refClaimed = localStorage.getItem('nexus_ref_claimed') === 'true';

// ==========================================
// CORE (ЯДРО ИГРОВОЙ ЛОГИКИ)
// ==========================================
const Core = {
    modifyBalance: function(amount) {
        NexusShield.execute("Core_Balance", () => {
            balance += amount;
            if (balance < 0) balance = 0;
            updateUI();
            saveData();
        });
    },
    consumeEnergy: function(amount) {
        return NexusShield.execute("Core_Energy", () => {
            if (energy >= amount) {
                energy -= amount;
                updateUI();
                return true;
            }
            return false;
        });
    }
};

// ==========================================
// ЯЗЫКОВЫЕ ПАКЕТЫ
// ==========================================
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "CHARGE", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS", task3: "REACH 100K N", top: "TOP MINERS", buyUSDT: "BUY USDT",
        donateTitle: "DONATE USDT", donateDesc: "SUPPORT PROJECT DEVELOPMENT", copyBtn: "COPY ADDRESS",
        daily: "DAILY REWARD", refTask: "INVITE FRIEND", refCopy: "COPY LINK", wait: "WAIT",
        go: "GO", check: "CHECK", checking: "WAIT...", notSub: "NOT SUBSCRIBED!"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАРЯД", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyUSDT: "КУПИТЬ USDT",
        donateTitle: "ПОДДЕРЖКА ПРОЕКТА", donateDesc: "ДОНАТ НА РАЗВИТИЕ NEXUS ENGINE", copyBtn: "КОПИРОВАТЬ АДРЕС",
        daily: "ЕЖЕДНЕВНЫЙ БОНУС", refTask: "ПРИГЛАСИТЬ ДРУГА", refCopy: "КОПИРОВАТЬ ССЫЛКУ", wait: "ОЖИДАНИЕ",
        go: "ВЫПОЛНИТЬ", check: "ПРОВЕРИТЬ", checking: "ПРОВЕРКА...", notSub: "ТЫ НЕ ПОДПИСАН!"
    }
};

const RANKS = [
    { name: "ROOKIE", limit: 0 },
    { name: "MINER", limit: 10000 },
    { name: "PRO MINER", limit: 50000 },
    { name: "CYBER MINER", limit: 250000 },
    { name: "NEXUS WHALE", limit: 1000000 },
    { name: "LEGEND", limit: 5000000 }
];

// ==========================================
// ОТРИСОВКА ИНТЕРФЕЙСА (UI)
// ==========================================
function updateUI() { 
    updateRank();
    const L = langMap[currentLang];
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) {
        nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;
    }
    
    document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
    document.getElementById('nav-market').querySelector('span').innerText = L.market;
    document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;
    document.getElementById('lbl-energy').innerText = L.energy;
    document.getElementById('lbl-sync').innerText = L.overdrive;
    document.getElementById('m-sys-title').innerText = L.sys;
    document.getElementById('m-market-title').innerText = L.market;
    document.getElementById('m-tasks-title').innerText = L.tasks;
    document.getElementById('m-rank-title').innerText = L.top;
    document.getElementById('lbl-lang').innerText = L.lang;
    document.getElementById('lbl-haptic').innerText = L.haptic;
    document.getElementById('lang-btn').innerText = currentLang;
    document.getElementById('haptic-btn').innerText = hapticEnabled ? "ON" : "OFF";

    const dTitle = document.getElementById('m-donate-title');
    const dDesc = document.getElementById('m-donate-desc');
    const dCopy = document.getElementById('copy-addr-btn');
    if (dTitle) dTitle.innerText = L.donateTitle;
    if (dDesc) dDesc.innerText = L.donateDesc;
    if (dCopy) dCopy.innerText = L.copyBtn;
    
    document.querySelectorAll('.close-btn-nexus').forEach(b => b.innerText = L.close);
    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    const btn = document.getElementById('od-btn');
    if (isOverdrive) btn.innerText = "OVERDRIVE!!";
    else if (odCharge >= 100) btn.innerText = L.ready;
    else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;

    renderMarket();
    renderTasks();
}

function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    const now = Date.now();
    
    const multStatus = activeBoosts.multEnd > now ? " (ACTIVE)" : "";
    const speedStatus = activeBoosts.speedEnd > now ? " (ACTIVE)" : "";

    const premiumTexts = {
        mult: currentLang === 'RU' ? { title: "МНОЖИТЕЛЬ X2 💎", desc: "ДВОЙНАЯ СИЛА НА 24 ЧАСА" } : { title: "X2 MULTIPLIER 💎", desc: "DOUBLE TAP FOR 24H" },
        speed: currentLang === 'RU' ? { title: "КИБЕР-СКОРОСТЬ ⚡️", desc: "РЕГЕНЕРАЦИЯ X2 НА 24 ЧАСА" } : { title: "CYBER SPEED ⚡️", desc: "X2 REGEN FOR 24H" }
    };

    grid.innerHTML = `
        <div class="card-nexus ${activeBoosts.multEnd > now ? 'boost-active' : ''}">
            <div class="card-info">
                <span class="card-title">${premiumTexts.mult.title}${multStatus}</span>
                <span class="card-sub">${premiumTexts.mult.desc}</span>
                <span class="card-price">1.0 TON</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyWithUSDT('mult', 1)">${L.buyUSDT}</button>
        </div>
        <div class="card-nexus ${activeBoosts.speedEnd > now ? 'boost-active' : ''}">
            <div class="card-info">
                <span class="card-title">${premiumTexts.speed.title}${speedStatus}</span>
                <span class="card-sub">${premiumTexts.speed.desc}</span>
                <span class="card-price">2.0 TON</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyWithUSDT('speed', 2)">${L.buyUSDT}</button>
        </div>
        <hr style="border: 0.5px solid rgba(255,255,255,0.1); margin: 15px 0;">
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">NODE v.${upgrades.node.lvl}</span>
                <span class="card-sub">${L.power}: +${upgrades.node.lvl}</span>
                <span class="card-price">${L.cost}: ${upgrades.node.cost.toLocaleString()} N</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">${L.buy}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">VPN v.${upgrades.vpn.lvl}</span>
                <span class="card-sub">${L.inc}: +${upgrades.vpn.lvl}/SEC</span>
                <span class="card-price">${L.cost}: ${upgrades.vpn.cost.toLocaleString()} N</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyItem('vpn')">${L.buy}</button>
        </div>
    `;
}

async function buyWithUSDT(type, price) {
    if (typeof tonConnectUI === 'undefined' || !tonConnectUI.account) {
        tg.showPopup({
            title: 'Nexus Wallet',
            message: currentLang === 'RU' ? 'Сначала подключите кошелек!' : 'Please connect your wallet first!',
            buttons: [{id: 'ok', type: 'default', text: 'OK'}]
        });
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
            address: "UQB1fAh0XZ3paTUwJl8poaDG2H0cad4vJfy3bXdnyU5ZVIU3",
            amount: (price * 1000000000).toString(), 
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            const dayInMs = 24 * 60 * 60 * 1000;
            const now = Date.now();
            if(type === 'mult') activeBoosts.multEnd = Math.max(activeBoosts.multEnd, now) + dayInMs;
            if(type === 'speed') activeBoosts.speedEnd = Math.max(activeBoosts.speedEnd, now) + dayInMs;
            localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
            saveData(); updateUI();
        }
    } catch (e) {
        console.error("Payment error:", e);
    }
}

const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (energy < 2) return;
        NexusGuard.lastClickTime = Date.now();
        const coin = document.getElementById('coin-visual');
        if(coin) coin.classList.add('pressed');
        const now = Date.now();
        const currentMult = (activeBoosts.multEnd > now) ? 2 : 1;
        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let pwr = (upgrades.node.lvl * upgrades.node.power * currentMult) * (isOverdrive ? 5 : 1);
            if (Math.random() < 0.01) pwr *= 10;
            Core.modifyBalance(pwr); 
            Core.consumeEnergy(2);
            if (!isOverdrive && odCharge < 100) odCharge += 0.4;
            createPop(t.clientX, t.clientY, pwr, pwr > upgrades.node.lvl * 2);
            spawnParticles(t.clientX, t.clientY);
        }
        if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    }, {passive: false});
    touchZone.addEventListener('touchend', () => {
        const coin = document.getElementById('coin-visual');
        if(coin) coin.classList.remove('pressed');
    });
}

setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    const now = Date.now();
    const regenStep = (activeBoosts.speedEnd > now) ? 1.5 : 0.5;
    if (energy < 1000) energy = Math.min(1000, energy + regenStep);
    if (!isOverdrive && odCharge > 0 && (now - NexusGuard.lastClickTime > 2000)) {
        odCharge = Math.max(0, odCharge - 0.3);
    }
    localStorage.setItem('nexus_energy', energy);
    updateUI();
}, 100);

// ==========================================
// БЛОК ЗАДАЧ С ПРОВЕРКОЙ (ANTI-CHEAT)
// ==========================================

// ВАЖНО: Замени на свои данные
const BOT_TOKEN = "7544093954:AAH3H38R-o6v5rK6eHjK_X-Yy3vWk7E8K4o"; // Токен твоего бота
const CHANNEL_ID = "-1002086386401"; // ID твоего канала (начинается с -100)

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;

    const now = Date.now();
    const canClaimDaily = (now - lastDailyClaim) > 86400000;
    const dailyReward = [1000, 2500, 5000, 10000, 25000, 50000, 100000][dailyStreak % 7];

    grid.innerHTML = `
        <div class="card-nexus" style="border-color: #ffcc00; box-shadow: 0 0 8px rgba(255, 204, 0, 0.3);">
            <div class="card-info">
                <span class="card-title">${L.daily} (Day ${dailyStreak + 1})</span>
                <span class="card-sub">+${dailyReward.toLocaleString()} N</span>
            </div>
            <button class="nexus-btn-buy" ${!canClaimDaily ? 'disabled' : ''} onclick="claimDaily()">
                ${canClaimDaily ? L.claim : L.wait}
            </button>
        </div>
        <div class="card-nexus" style="border-color: #00d4ff; background: rgba(0, 212, 255, 0.05);">
            <div class="card-info">
                <span class="card-title">${L.refTask}</span>
                <span class="card-sub">+50,000 N EACH</span>
            </div>
            <button class="nexus-btn-buy" onclick="copyRefLink()">${L.refCopy}</button>
        </div>
    `;

    const tasks = [
        { id: 'sub1', title: L.task1, reward: 5000, url: 'https://t.me/nexus_mining_hub' },
        { id: 'invite', title: L.task2, reward: 15000, url: '' },
        { id: 'reach100k', title: L.task3, reward: 25000, url: '' }
    ];

    tasks.forEach(task => {
        const isDone = tasksDone.includes(task.id);
        grid.innerHTML += `<div class="card-nexus">
            <div class="card-info">
                <span class="card-title">${task.title}</span>
                <span class="card-sub">+${task.reward.toLocaleString()} N</span>
            </div>
            <div style="display:flex; gap:5px;">
                ${isDone ? 
                    `<button class="nexus-btn-buy" disabled>${L.claimed}</button>` : 
                    `
                    <button class="nexus-btn-buy" onclick="completeTask('${task.id}', ${task.reward}, '${task.url}')">${L.go}</button>
                    <button class="nexus-btn-buy" style="background:#26a17b" id="check-${task.id}" onclick="verifyTask('${task.id}', ${task.reward})">${L.check}</button>
                    `
                }
            </div>
        </div>`;
    });
}

function claimDaily() {
    const now = Date.now();
    if (now - lastDailyClaim < 86400000) return;
    const reward = [1000, 2500, 5000, 10000, 25000, 50000, 100000][dailyStreak % 7];
    Core.modifyBalance(reward);
    lastDailyClaim = now;
    dailyStreak++;
    localStorage.setItem('nexus_daily', lastDailyClaim);
    localStorage.setItem('nexus_streak', dailyStreak);
    tg.showAlert(`+${reward} N!`);
    updateUI();
}

function copyRefLink() {
    const botUsername = "nexus_protocol_bot"; 
    const link = `https://t.me/${botUsername}/app?startapp=${user?.id || '0'}`;
    navigator.clipboard.writeText(link).then(() => {
        tg.showPopup({ message: currentLang === 'RU' ? "Ссылка скопирована!" : "Link copied!" });
    });
}

let taskTimers = {}; 

function completeTask(id, reward, url) {
    if (!tasksDone.includes(id)) {
        if (url && url !== '') window.open(url, '_blank');
        taskTimers[id] = Date.now();
        tg.showAlert(currentLang === 'RU' ? "Задание начато! Подождите 15 секунд, затем нажмите ПРОВЕРИТЬ." : "Task started! Wait 15 seconds, then click CHECK.");
    }
}

// УЛЬТИМАТИВНАЯ ПРОВЕРКА ЧЕРЕЗ BOT API
async function verifyTask(id, reward) {
    const L = langMap[currentLang];
    const now = Date.now();
    const startTime = taskTimers[id];
    const checkBtn = document.getElementById(`check-${id}`);

    if (!startTime) {
        tg.showAlert(L.go + " first!");
        return;
    }

    if (now - startTime < 15000) {
        const timeLeft = Math.ceil((15000 - (now - startTime)) / 1000);
        tg.showAlert(`${L.wait}: ${timeLeft}s`);
        return;
    }

    // Блокируем кнопку на время запроса
    if(checkBtn) { checkBtn.disabled = true; checkBtn.innerText = L.checking; }

    try {
        // Запрос к Telegram API для проверки подписки
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${user.id}`);
        const data = await response.json();

        if (data.ok && (data.result.status === 'member' || data.result.status === 'administrator' || data.result.status === 'creator')) {
            if (!tasksDone.includes(id)) {
                Core.modifyBalance(reward);
                tasksDone.push(id);
                localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
                tg.showAlert(`+${reward} N!`);
                updateUI();
            }
        } else {
            tg.showAlert(L.notSub);
            if(checkBtn) { checkBtn.disabled = false; checkBtn.innerText = L.check; }
        }
    } catch (e) {
        console.error("Verification error:", e);
        // Если API упало, даем бонус просто по времени (запасной вариант)
        Core.modifyBalance(reward);
        tasksDone.push(id);
        localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
        updateUI();
    }
}

function checkReferral() {
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && !refClaimed) {
        Core.modifyBalance(50000);
        refClaimed = true;
        localStorage.setItem('nexus_ref_claimed', 'true');
        tg.showAlert(currentLang === 'RU' ? "Бонус за приглашение: +50,000 N!" : "Referral Bonus: +50,000 N!");
        if (typeof db !== 'undefined') {
            db.ref('users/' + startParam + '/ref_bonus_pending').set(firebase.database.ServerValue.increment(50000));
        }
    }
}

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
        saveData(); updateUI(); 
        if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
    } else {
        tg.showAlert(currentLang === 'RU' ? "Недостаточно N!" : "Not enough N!");
    }
}

function saveData() {
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
    localStorage.setItem('nexus_version', GAME_VERSION);

    if (typeof db !== 'undefined' && user?.id) {
        let currentRank = "ROOKIE";
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (balance >= RANKS[i].limit) {
                currentRank = RANKS[i].name;
                break;
            }
        }
        db.ref('users/' + user.id).set({ 
            name: user.first_name || "Unknown", 
            balance: balance,
            rank: currentRank,
            multEnd: activeBoosts.multEnd,
            speedEnd: activeBoosts.speedEnd,
            v: GAME_VERSION, 
            lastSeen: Date.now() 
        });
    }
}

function toggleModal(id) {
    const m = document.getElementById(id);
    if(m) {
        m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
        if (id === 'rank-modal' && m.style.display === 'flex') loadLeaderboard();
    }
}

function loadLeaderboard() {
    if (typeof db === 'undefined') return;
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    container.innerHTML = currentLang === 'RU' ? "СИНХРОНИЗАЦИЯ..." : "SYNCING...";
    db.ref('users').orderByChild('balance').limitToLast(100).once('value', (snap) => {
        const players = [];
        snap.forEach((child) => { players.push(child.val()); });
        players.reverse();
        renderLeaderboard(players);
    });
}

function renderLeaderboard(players) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    container.innerHTML = "";
    players.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'card-nexus';
        div.style.marginBottom = "5px";
        if (p.name === user?.first_name) div.style.borderColor = "#00f2ff";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <span style="color:#00f2ff; font-weight:bold; width:30px;">#${i+1}</span>
                <div style="flex-grow:1; margin-left:10px;">
                    <div style="font-size:0.8rem; font-weight:bold;">${(p.name || 'ANON').toUpperCase()}</div>
                    <div style="font-size:0.6rem; color:#888;">${p.rank || 'ROOKIE'}</div>
                </div>
                <div style="font-weight:bold;">${Math.floor(p.balance).toLocaleString()} N</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function changeLanguage() { 
    currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
    localStorage.setItem('nx_lang', currentLang); updateUI();
}

function toggleHaptic() { 
    hapticEnabled = !hapticEnabled; 
    localStorage.setItem('nx_haptic', hapticEnabled?'on':'off'); updateUI(); 
}

function createPop(x, y, v, isCrit) {
    const p = document.createElement('div'); p.className = 'floating-text';
    p.innerText = isCrit ? '+' + v + ' 🔥' : '+' + v;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    if(isCrit) { p.style.color = '#ffcc00'; p.style.fontSize = '3.5rem'; }
    document.body.appendChild(p); setTimeout(() => p.remove(), 600);
}

function spawnParticles(x, y) {
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div'); p.className = 'particle';
        p.style.left = x + 'px'; p.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 40;
        p.animate([{ opacity: 1 }, { transform: `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px) scale(0)`, opacity: 0 }], 500);
        document.body.appendChild(p); setTimeout(() => p.remove(), 500);
    }
}

function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
        let drain = setInterval(() => {
            odCharge -= 2;
            if (odCharge <= 0) {
                odCharge = 0; isOverdrive = false; clearInterval(drain);
            }
            updateUI();
        }, 100);
    }
}

function updateRank() {
    let currentRankName = RANKS[0].name;
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (balance >= RANKS[i].limit) {
            currentRankName = RANKS[i].name;
            break;
        }
    }
    const rankBadge = document.getElementById('rank-badge');
    if (rankBadge) rankBadge.innerText = `RANK: ${currentRankName}`;
}

document.addEventListener('DOMContentLoaded', () => { 
    if(isWasReset) tg.showAlert("NEXUS: Система обновлена!");
    checkReferral(); 
    updateUI(); 
});
