// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ (Работает и в ТГ, и в Браузере)
// ==========================================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const STORAGE_KEY = 'nexus_main_data';

// Загрузка данных
let saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

// Глобальные переменные (window. делает их видимыми для HTML)
window.balance = saved.balance || 0;
window.energy = saved.energy !== undefined ? saved.energy : 1000;
window.tasksDone = saved.tasksDone || [];
window.lastLogin = saved.lastLogin || 0;
window.dayStreak = saved.dayStreak || 0;
window.upgrades = saved.upgrades || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn:  { lvl: 0, cost: 3240, income: 1 }
};

let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'RU';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// ==========================================
// 2. СЛОВАРЬ
// ==========================================
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", ready: "READY!", 
        buy: "UPGRADE", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN HUB", task3: "REACH 10K", loading: "LOADING"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", ready: "ГОТОВО!", 
        buy: "УЛУЧШИТЬ", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task3: "ДОСТИГНИ 10К", loading: "ЗАГРУЗКА"
    }
};

// ==========================================
// 3. ОСНОВНЫЕ ФУНКЦИИ (ГЛОБАЛЬНЫЕ)
// ==========================================

window.updateUI = function() {
    const L = langMap[currentLang];

    // Числа
    const balEl = document.getElementById('balance-value');
    if (balEl) balEl.innerText = Math.floor(window.balance).toLocaleString();
    
    const enFill = document.getElementById('energy-fill');
    if (enFill) enFill.style.width = (window.energy / 10) + "%";
    
    const odFill = document.getElementById('boost-fill');
    if (odFill) odFill.style.width = odCharge + "%";

    // Навигация
    try {
        document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
        document.getElementById('nav-market').querySelector('span').innerText = L.market;
        document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;
    } catch(e) {}

    // Кнопка Буста
    const btn = document.getElementById('od-btn');
    if (btn) {
        if (isOverdrive) btn.innerText = "OVERDRIVE!!";
        else if (odCharge >= 100) btn.innerText = L.ready;
        else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    }

    renderMarket();
    renderTasks();
};

window.saveData = function() {
    const data = { 
        balance: window.balance, 
        energy: window.energy, 
        upgrades: window.upgrades, 
        tasksDone: window.tasksDone, 
        lastLogin: window.lastLogin, 
        dayStreak: window.dayStreak 
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

window.toggleModal = function(id) {
    const m = document.getElementById(id);
    if (m) {
        // Закрываем все окна перед открытием нового
        document.querySelectorAll('.modal-overlay-nexus').forEach(el => el.style.display = 'none');
        m.style.display = 'flex';
    }
};

// ==========================================
// 4. КЛИКЕР (МЫШЬ + ТАЧ)
// ==========================================

// Функция клика
window.handleTap = function(e) {
    if (window.energy < 2) return;

    const visual = document.getElementById('coin-visual');
    if (visual) {
        visual.style.transform = "scale(0.95)";
        setTimeout(() => visual.style.transform = "scale(1)", 100);
    }

    let pwr = window.upgrades.node.lvl * (isOverdrive ? 5 : 1);
    
    window.balance += pwr;
    window.energy -= 2;
    if (!isOverdrive && odCharge < 100) odCharge += 0.5;

    // Всплывающее число
    const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
    const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    createPop(x, y, pwr);

    if (hapticEnabled && tg) tg.HapticFeedback.impactOccurred('medium');
    
    window.updateUI();
};

function createPop(x, y, v) {
    const p = document.createElement('div');
    p.className = 'floating-text';
    p.innerText = '+' + v;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 600);
}

// ==========================================
// 5. МАГАЗИН И ЗАДАНИЯ
// ==========================================

window.buyItem = function(type) {
    let u = window.upgrades[type];
    if (window.balance >= u.cost) {
        window.balance -= u.cost;
        u.lvl++;
        u.cost = Math.floor(u.cost * 1.8);
        window.saveData();
        window.updateUI();
    } else {
        alert("Недостаточно монет!");
    }
};

window.completeTask = function(id, reward) {
    if (!window.tasksDone.includes(id)) {
        if (id === 'sub1' && tg) tg.openTelegramLink('https://t.me/nexus_protocol');
        
        window.balance += reward;
        window.tasksDone.push(id);
        window.saveData();
        window.updateUI();
    }
};

function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info"><b>NODE v.${window.upgrades.node.lvl}</b><br><small>${L.power}: +${window.upgrades.node.lvl}</small></div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">${window.upgrades.node.cost}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info"><b>VPN v.${window.upgrades.vpn.lvl}</b><br><small>${L.inc}: +${window.upgrades.vpn.lvl}/s</small></div>
            <button class="nexus-btn-buy" onclick="buyItem('vpn')">${window.upgrades.vpn.cost}</button>
        </div>
    `;
}

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;
    const list = [
        { id: 'sub1', title: L.task1, reward: 5000 },
        { id: 'reach10k', title: L.task3, reward: 25000 }
    ];
    grid.innerHTML = list.map(task => `
        <div class="card-nexus">
            <div class="card-info"><b>${task.title}</b><br><small>+${task.reward} N</small></div>
            <button class="nexus-btn-buy" ${window.tasksDone.includes(task.id)?'disabled':''} onclick="completeTask('${task.id}', ${task.reward})">
                ${window.tasksDone.includes(task.id)? L.claimed : L.claim}
            </button>
        </div>
    `).join('');
}

// ==========================================
// 6. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ==========================================

window.onload = function() {
    // Привязываем клик к зоне
    const touchZone = document.getElementById('touch-zone');
    if (touchZone) {
        touchZone.addEventListener('pointerdown', window.handleTap);
    }

    // Ежесекундный доход и сохранение
    setInterval(() => {
        if (window.upgrades.vpn.lvl > 0) window.balance += (window.upgrades.vpn.lvl * 0.1);
        if (window.energy < 1000) window.energy += 1.5;
        window.saveData(); // Сохраняем каждую секунду
        window.updateUI();
    }, 1000);

    // Проверка входа
    const now = Date.now();
    if (now - window.lastLogin >= 86400000) {
        if (now - window.lastLogin < 172800000) window.dayStreak = (window.dayStreak % 7) + 1;
        else window.dayStreak = 1;
        window.balance += (window.dayStreak * 1000);
        window.lastLogin = now;
    }

    window.updateUI();
};
