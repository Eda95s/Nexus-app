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
            if (typeof tg !== 'undefined' && tg.showPopup) {
                tg.showPopup({
                    title: 'AI Debugger 🤖',
                    message: `Ошибка в "${moduleName}"\n\n${error.message}`,
                    buttons: [{type: 'close'}]
                });
            }
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
        donateTitle: "DONATE USDT", donateDesc: "SUPPORT PROJECT DEVELOPMENT", copyBtn: "COPY ADDRESS"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАРЯД", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyUSDT: "КУПИТЬ USDT",
        donateTitle: "ПОДДЕРЖКА ПРОЕКТА", donateDesc: "ДОНАТ НА РАЗВИТИЕ NEXUS ENGINE", copyBtn: "КОПИРОВАТЬ АДРЕС"
    }
};

// ==========================================
// ОТРИСОВКА ИНТЕРФЕЙСА (UI)
// ==========================================
function updateUI() {
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
                <span class="card-price">1.0 USDT</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyWithUSDT('mult', 1)">${L.buyUSDT}</button>
        </div>
        <div class="card-nexus ${activeBoosts.speedEnd > now ? 'boost-active' : ''}">
            <div class="card-info">
                <span class="card-title">${premiumTexts.speed.title}${speedStatus}</span>
                <span class="card-sub">${premiumTexts.speed.desc}</span>
                <span class="card-price">2.0 USDT</span>
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

// ==========================================
// ЛОГИКА ОПЛАТЫ USDT (WEB3) - ВРЕМЕННЫЕ БУСТЫ
// ==========================================
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
            address: "0x77e596231a14dee635e42c62ce215a2a47ec2c74",
            amount: (price * 1000000000).toString(), 
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            NexusShield.execute("Web3_Purchase", () => {
                const dayInMs = 24 * 60 * 60 * 1000;
                const now = Date.now();

                if(type === 'mult') { 
                    activeBoosts.multEnd = Math.max(activeBoosts.multEnd, now) + dayInMs;
                    tg.showAlert(currentLang === 'RU' ? "Множитель X2 активирован на 24 часа!" : "X2 Multiplier activated for 24h!"); 
                }
                if(type === 'speed') { 
                    activeBoosts.speedEnd = Math.max(activeBoosts.speedEnd, now) + dayInMs;
                    tg.showAlert(currentLang === 'RU' ? "Кибер-скорость активирована на 24 часа!" : "Cyber Speed activated for 24h!"); 
                }
                
                localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
                saveData(); 
                updateUI();
            });
        }
    } catch (e) {
        console.error("Payment error:", e);
    }
}

// ==========================================
// ГЛАВНЫЙ КЛИКЕР (С ПРОВЕРКОЙ БУСТА)
// ==========================================
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        NexusShield.execute("Mining_Click", () => {
            if (energy < 2) return;
            NexusGuard.lastClickTime = Date.now(); // Обновляем время клика для остывания буста
            
            const coin = document.getElementById('coin-visual');
            if(coin) coin.classList.add('pressed');
            
            const now = Date.now();
            const currentMult = (activeBoosts.multEnd > now) ? 2 : 1;

            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
                let pwr = (upgrades.node.lvl * upgrades.node.power * currentMult) * (isOverdrive ? 5 : 1);
                
                if (Math.random() < 0.01) { pwr *= 10; tg.HapticFeedback.notificationOccurred('warning'); }
                
                Core.modifyBalance(pwr); 
                Core.consumeEnergy(2);
                
                if (!isOverdrive && odCharge < 100) odCharge += 0.4;
                createPop(t.clientX, t.clientY, pwr, pwr > upgrades.node.lvl * 2);
                spawnParticles(t.clientX, t.clientY);
            }
            if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
        });
    }, {passive: false});
    touchZone.addEventListener('touchend', () => {
        const coin = document.getElementById('coin-visual');
        if(coin) coin.classList.remove('pressed');
    });
}

// ==========================================
// СИСТЕМНЫЕ ЦИКЛЫ
// ==========================================
setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    
    const now = Date.now();
    
    // ПРАВКА 1: Медленная регенерация энергии
    const regenStep = (activeBoosts.speedEnd > now) ? 1.5 : 0.5;
    if (energy < 1000) energy = Math.min(1000, energy + regenStep);
    
    // ПРАВКА 3: Остывание буста (если не кликали больше 2 секунд)
    if (!isOverdrive && odCharge > 0) {
        if (now - NexusGuard.lastClickTime > 2000) {
            odCharge = Math.max(0, odCharge - 0.3);
        }
    }
    
    localStorage.setItem('nexus_energy', energy);
    updateUI();
}, 100);

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    // ПРАВКА 4: Уменьшены награды на один ноль
    const tasks = [
        { id: 'sub1', title: L.task1, reward: 5000 },
        { id: 'invite', title: L.task2, reward: 15000 },
        { id: 'reach100k', title: L.task3, reward: 25000 }
    ];
    grid.innerHTML = "";
    tasks.forEach(task => {
        const isDone = tasksDone.includes(task.id);
        grid.innerHTML += `<div class="card-nexus">
            <div class="card-info"><span class="card-title">${task.title}</span><span class="card-sub">+${task.reward.toLocaleString()} N</span></div>
            <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} onclick="completeTask('${task.id}', ${task.reward})">${isDone ? L.claimed : L.claim}</button>
        </div>`;
    });
}

function buyItem(type) {
    NexusShield.execute("Market_Purchase", () => {
        let u = upgrades[type];
        if (balance >= u.cost) {
            balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
            saveData(); updateUI(); 
            if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
        } else {
            tg.showAlert(currentLang === 'RU' ? "Недостаточно N!" : "Not enough N!");
        }
    });
}

function saveData() {
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
    localStorage.setItem('nexus_version', GAME_VERSION);

    if (typeof db !== 'undefined' && user?.id) {
        db.ref('users/' + user.id).set({ 
            name: user.first_name || "Unknown", 
            balance: balance, 
            multEnd: activeBoosts.multEnd,
            speedEnd: activeBoosts.speedEnd,
            v: GAME_VERSION, 
            lastSeen: Date.now() 
        });
    }
}

function toggleModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function changeLanguage() { 
    currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
    localStorage.setItem('nx_lang', currentLang); updateUI();
}

function toggleHaptic() { 
    hapticEnabled = !hapticEnabled; 
    localStorage.setItem('nx_haptic', hapticEnabled?'off':'on'); updateUI(); 
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

// ДОБАВЛЕНО: Функция для кнопки буста, чтобы она работала и не выдавала ошибку
function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
        
        let drain = setInterval(() => {
            odCharge -= 2;
            if (odCharge <= 0) {
                odCharge = 0;
                isOverdrive = false;
                clearInterval(drain);
            }
            updateUI();
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    if(isWasReset) tg.showAlert("NEXUS: Система обновлена для запуска!");
    updateUI(); 
});
updateUI();
