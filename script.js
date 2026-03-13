// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКИ
// ==========================================
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран
const user = tg.initDataUnsafe?.user;

// Единый ключ для всех сохранений
const STORAGE_KEY = 'nexus_main_data';

// Загружаем данные (если их нет — создаем стандартные)
let saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

let balance = saved.balance || 0;
let energy = saved.energy !== undefined ? saved.energy : 1000;
let tasksDone = saved.tasksDone || [];
let lastLogin = saved.lastLogin || 0;
let dayStreak = saved.dayStreak || 0;
let upgrades = saved.upgrades || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn:  { lvl: 0, cost: 3240, income: 1 }
};

// Временные переменные сессии
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// ==========================================
// 2. СЛОВАРЬ (РУССКИЙ И АНГЛИЙСКИЙ)
// ==========================================
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "LOADING", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        top: "TOP MINERS", task1: "JOIN HUB", task3: "REACH 10K"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАГРУЗКА", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        top: "ЛИДЕРЫ", task1: "ВСТУПИ В КАНАЛ", task3: "ДОСТИГНИ 10К"
    }
};

// ==========================================
// 3. ОБНОВЛЕНИЕ ЭКРАНА (UI)
// ==========================================
function updateUI() {
    const L = langMap[currentLang];

    // Обновляем основные цифры
    const balEl = document.getElementById('balance-value');
    if (balEl) balEl.innerText = Math.floor(balance).toLocaleString();
    
    const enFill = document.getElementById('energy-fill');
    if (enFill) enFill.style.width = (energy / 10) + "%";
    
    const odFill = document.getElementById('boost-fill');
    if (odFill) odFill.style.width = odCharge + "%";

    // Имя и Ранг
    const nameEl = document.getElementById('user-name');
    if (nameEl && user) nameEl.innerText = `NEX | ${user.first_name.toUpperCase()}`;
    
    // Кнопка Буста
    const btn = document.getElementById('od-btn');
    if (btn) {
        if (isOverdrive) btn.innerText = "OVERDRIVE!!";
        else if (odCharge >= 100) btn.innerText = L.ready;
        else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
        btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;
    }

    // Тексты меню
    document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
    document.getElementById('nav-market').querySelector('span').innerText = L.market;
    document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;

    renderMarket();
    renderTasks();
}

// ==========================================
// 4. МЕХАНИКА МАЙНИНГА (КЛИКИ)
// ==========================================
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (energy < 2) return;

        const visual = document.getElementById('coin-visual');
        if (visual) visual.classList.add('pressed');

        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let pwr = upgrades.node.lvl * (isOverdrive ? 5 : 1);
            
            balance += pwr;
            energy -= 2;
            if (!isOverdrive && odCharge < 100) odCharge += 0.5;

            createPop(t.clientX, t.clientY, pwr);
        }

        if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
        saveData();
        updateUI();
    });

    touchZone.addEventListener('touchend', () => {
        const visual = document.getElementById('coin-visual');
        if (visual) visual.classList.remove('pressed');
    });
}

// Всплывающие цифры
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
function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info"><b>NODE v.${upgrades.node.lvl}</b><br><small>${L.power}: +${upgrades.node.lvl}</small></div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">${upgrades.node.cost}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info"><b>VPN v.${upgrades.vpn.lvl}</b><br><small>${L.inc}: +${upgrades.vpn.lvl}/s</small></div>
            <button class="nexus-btn-buy" onclick="buyItem('vpn')">${upgrades.vpn.cost}</button>
        </div>
    `;
}

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost;
        u.lvl++;
        u.cost = Math.floor(u.cost * 1.8);
        saveData();
        updateUI();
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        tg.showAlert("Недостаточно монет!");
    }
}

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;

    const taskList = [
        { id: 'sub1', title: L.task1, reward: 5000 },
        { id: 'reach10k', title: L.task3, reward: 25000 }
    ];

    grid.innerHTML = taskList.map(task => `
        <div class="card-nexus">
            <div class="card-info"><b>${task.title}</b><br><small>+${task.reward} N</small></div>
            <button class="nexus-btn-buy" ${tasksDone.includes(task.id) ? 'disabled' : ''} onclick="completeTask('${task.id}', ${task.reward})">
                ${tasksDone.includes(task.id) ? L.claimed : L.claim}
            </button>
        </div>
    `).join('');
}

function completeTask(id, reward) {
    if (!tasksDone.includes(id)) {
        if (id === 'sub1') tg.openTelegramLink('https://t.me/nexus_protocol');
        
        balance += reward;
        tasksDone.push(id);
        saveData();
        updateUI();
        tg.HapticFeedback.notificationOccurred('success');
    }
}

// ==========================================
// 6. СИСТЕМНЫЕ ФУНКЦИИ (БОНУСЫ, СОХРАНЕНИЯ)
// ==========================================
function checkDailyReward() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - lastLogin >= oneDay) {
        if (now - lastLogin < oneDay * 2) dayStreak = (dayStreak % 7) + 1;
        else dayStreak = 1;

        let reward = dayStreak * 1000;
        balance += reward;
        lastLogin = now;
        saveData();
        
        setTimeout(() => {
            tg.showAlert(`🚀 NEXUS BONUS!\nДень: ${dayStreak}\nНаграда: +${reward} N`);
            updateUI();
        }, 1000);
    }
}

function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        document.body.classList.add('overdrive-active');
        let t = setInterval(() => {
            odCharge -= 2;
            updateUI();
            if (odCharge <= 0) {
                clearInterval(t);
                isOverdrive = false;
                document.body.classList.remove('overdrive-active');
                odCharge = 0;
                updateUI();
            }
        }, 100);
    }
}

function openRanks() {
    // Если Firebase не подключен, просто выводим заглушку
    tg.showAlert("Рейтинг скоро будет доступен!");
    toggleModal('rank-modal');
}

function toggleModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function saveData() {
    const data = { balance, energy, upgrades, tasksDone, lastLogin, dayStreak };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Отправка в Firebase (если db доступна)
    if (window.db && user) {
        window.db.ref('users/' + user.id).update({
            balance: balance,
            name: user.first_name
        });
    }
}

// Смена языка
function changeLanguage() {
    currentLang = currentLang === 'EN' ? 'RU' : 'EN';
    localStorage.setItem('nx_lang', currentLang);
    updateUI();
}

// Смена вибрации
function toggleHaptic() {
    hapticEnabled = !hapticEnabled;
    localStorage.setItem('nx_haptic', hapticEnabled ? 'on' : 'off');
    updateUI();
}

// Авто-майнинг и регенерация (раз в секунду)
setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 0.1);
    if (energy < 1000) energy += 1.5;
    updateUI();
}, 1000);

// СТАРТ
checkDailyReward();
updateUI();
