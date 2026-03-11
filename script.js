const tg = window.Telegram.WebApp;
tg.expand();

// --- ДАННЫЕ (СОСТОЯНИЕ) ---
let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};

// Исправлено: Сначала инициализируем, потом чистим для теста
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];

// ВРЕМЕННО: Очистка для Telegram (удалить после проверки!)
localStorage.removeItem('nexus_tasks');
tasksDone = [];

let energy = 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

const user = tg.initDataUnsafe?.user;

// --- ЛОКАЛИЗАЦИЯ ---
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "LOADING", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS", task3: "REACH 100K N", top: "TOP MINERS", buyStars: "BUY FOR ⭐️"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАГРУЗКА", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyStars: "КУПИТЬ ЗА ⭐️"
    }
};

// --- ИНТЕРФЕЙС ---
function updateUI() {
    const L = langMap[currentLang];
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;

    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    const btn = document.getElementById('od-btn');
    if (btn) {
        if (isOverdrive) btn.innerText = "OVERDRIVE!!";
        else if (odCharge >= 100) btn.innerText = L.ready;
        else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    }

    renderMarket();
    renderTasks();
}

// --- МАГАЗИН ---
function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    if (!grid) return;

    grid.innerHTML = `
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

// --- ЗАДАНИЯ ---
function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;

    const tasks = [
        { id: 'sub1', title: L.task1, reward: 50000 },
        { id: 'invite', title: L.task2, reward: 150000 }
    ];

    grid.innerHTML = "";
    tasks.forEach(task => {
        const isDone = tasksDone.includes(task.id);
        grid.innerHTML += `
            <div class="card-nexus">
                <div class="card-info">
                    <span class="card-title">${task.title}</span>
                    <span class="card-sub">+${task.reward.toLocaleString()} N</span>
                </div>
                <button class="nexus-btn-buy" onclick="completeTask('${task.id}', ${task.reward})">
                    ${isDone ? L.claimed : L.claim}
                </button>
            </div>`;
    });
}

function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;

    if (id === 'sub1') {
        tg.openTelegramLink('https://t.me/твой_канал'); // ЗАМЕНИТЬ
    }

    balance += reward;
    tasksDone.push(id);
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    
    updateUI();
    tg.HapticFeedback.notificationOccurred('success');
}

// --- КЛИКЕР ---
document.getElementById('touch-zone')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    
    let pwr = upgrades.node.lvl * upgrades.node.power;
    balance += pwr;
    energy -= 2;
    
    if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    saveData();
    updateUI();
});

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
        saveData(); updateUI(); tg.HapticFeedback.notificationOccurred('success');
    }
}

function saveData() {
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
}

setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    if (energy < 1000) energy += 2.5;
    updateUI();
}, 100);

function toggleModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

updateUI();
