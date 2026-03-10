const tg = window.Telegram.WebApp;
tg.expand();

// Получаем данные пользователя из Telegram
const user = tg.initDataUnsafe?.user;
const username = user ? user.first_name : "Игрок";
const userId = user ? user.id : null;

// --- ДАННЫЕ (СОСТОЯНИЕ) ---
let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
let energy = 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

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

// --- ОСНОВНОЙ ИНТЕРФЕЙС ---
function updateUI() {
    const L = langMap[currentLang];
    
    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    // Обновление текстов навигации
    const navMining = document.getElementById('nav-mining');
    if (navMining) navMining.querySelector('span').innerText = L.mining;
    
    // Ранги (от Newbie до Nexus Whale)
    let r = "NEWBIE";
    if (balance > 50000) r = "NODE OPERATOR";
    if (balance > 500000) r = "SYSTEM ARCHITECT";
    if (balance > 1000000) r = "NEXUS WHALE 🐋";
    
    const rankBadge = document.getElementById('rank-badge');
    if (rankBadge) rankBadge.innerText = r;

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

// --- ЗАДАНИЯ С ПРОВЕРКОЙ ---
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
                <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} 
                    onclick="handleTask('${task.id}', ${task.reward})">
                    ${isDone ? L.claimed : L.claim}
                </button>
            </div>
        `;
    });
}

function handleTask(id, reward) {
    if (id === 'sub1') {
        alert(`${username}, проверяем подписку на @NEXUS_PROTOCOL...`);
        // Имитация проверки
        setTimeout(() => {
            completeTask(id, reward);
            alert("Бонус начислен!");
        }, 1500);
    } else {
        completeTask(id, reward);
    }
}

function completeTask(id, reward) {
    if (!tasksDone.includes(id)) {
        balance += reward;
        tasksDone.push(id);
        localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
        if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
        saveData();
        updateUI();
    }
}

// --- ЛОГИКА КЛИКА ---
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (energy < 2) return;
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            let pwr = upgrades.node.lvl * (isOverdrive ? 5 : 1);
            balance += pwr;
            energy -= 2;
            if (!isOverdrive && odCharge < 100) odCharge += 0.4;
        }
        if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
        saveData();
        updateUI();
    });
}

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost;
        u.lvl++;
        u.cost = Math.floor(u.cost * 1.7);
        saveData();
        updateUI();
    }
}

function saveData() {
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
}

// Запуск
setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    if (energy < 1000) energy += 2.5;
    updateUI();
}, 100);

updateUI();
