const tg = window.Telegram.WebApp;
tg.expand();

// --- ДАННЫЕ (СОСТОЯНИЕ) ---
let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};

// Исправлено: Сначала инициализируем переменную
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];

// ВРЕМЕННО: Очистка для теста (удали эти 2 строки, когда в Телеге кнопки станут активными)
localStorage.removeItem('nexus_tasks');
tasksDone = [];

let energy = 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// ПОЛУЧЕНИЕ РЕАЛЬНОГО ИГРОКА
const user = tg.initDataUnsafe?.user;

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
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ВЫПОЛНИТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyStars: "КУПИТЬ ЗА ⭐️"
    }
};

function updateUI() {
    const L = langMap[currentLang];
    
    // ВЫВОД ИМЕНИ ТЕЛЕГРАМ
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) {
        nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;
    }

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

// МАГАЗИН (ТВОЙ РОДНОЙ)
function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info"><span class="card-title">X2 MULTIPLIER</span><span class="card-price">50 ⭐️</span></div>
            <button class="nexus-btn-buy" onclick="buyWithStars()">${L.buyStars}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info"><span class="card-title">NODE v.${upgrades.node.lvl}</span><span class="card-price">${upgrades.node.cost} N</span></div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">${L.buy}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info"><span class="card-title">VPN v.${upgrades.vpn.lvl}</span><span class="card-price">${upgrades.vpn.cost} N</span></div>
            <button class="nexus-btn-buy" onclick="buyItem('vpn')">${L.buy}</button>
        </div>`;
}

// ЗАДАНИЯ (С РЕАЛЬНЫМИ ПЕРЕХОДАМИ)
function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;
    const tasks = [
        { id: 'sub1', title: L.task1, reward: 50000 },
        { id: 'invite', title: L.task2, reward: 150000 },
        { id: 'reach100k', title: L.task3, reward: 250000 }
    ];
    grid.innerHTML = "";
    tasks.forEach(task => {
        const isDone = tasksDone.includes(task.id);
        grid.innerHTML += `
            <div class="card-nexus">
                <div class="card-info"><span>${task.title}</span><small>+${task.reward}</small></div>
                <button class="nexus-btn-buy" onclick="completeTask('${task.id}', ${task.reward})">
                    ${isDone ? L.claimed : L.claim}
                </button>
            </div>`;
    });
}

function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;
    
    // РЕАЛЬНОЕ ДЕЙСТВИЕ: ПОДПИСКА
    if (id === 'sub1') {
        tg.openTelegramLink('https://t.me/nexus_protocol'); // СЮДА ССЫЛКУ КАНАЛА
    }
    
    // РЕАЛЬНОЕ ДЕЙСТВИЕ: ПРИГЛАШЕНИЕ
    if (id === 'invite') {
        const link = `https://t.me/nexus_protocol_bot=${user?.id || 'ref'}`;
        tg.openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=Join NEX!`);
    }
    
    // НАЧИСЛЕНИЕ (ТВОЯ ЛОГИКА)
    balance += reward;
    tasksDone.push(id);
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    updateUI();
    tg.HapticFeedback.notificationOccurred('success');
}

// ТОП ИГРОКОВ (РЕАЛЬНОЕ ОКНО ТЕЛЕГРАМ)
function showTop() {
    tg.showAlert(`RANKING:\n1. ADMIN: 1,000,000\n2. ${user?.first_name || 'YOU'}: ${balance.toLocaleString()}`);
}

// КЛИКЕР (ТВОЙ РОДНОЙ)
document.getElementById('touch-zone')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    balance += upgrades.node.lvl;
    energy -= 2;
    if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    localStorage.setItem('nexus_bal', balance);
    updateUI();
});

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
        localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
        updateUI();
    }
}

function buyWithStars() {
    tg.showAlert("Stars Payment Integration Required");
}

setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    if (energy < 1000) energy += 2.5;
    updateUI();
}, 100);

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

updateUI();
