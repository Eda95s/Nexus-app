const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;

// --- СОСТОЯНИЕ (ТВОИ ДАННЫЕ) ---
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

const langMap = {
    EN: { market: "MARKET", tasks: "TASKS", claim: "CLAIM", claimed: "DONE", need: "Need 100k N!", buyStars: "BUY FOR ⭐️" },
    RU: { market: "МАГАЗИН", tasks: "ЗАДАНИЯ", claim: "ЗАБРАТЬ", claimed: "ГОТОВО", need: "Нужно 100к N!", buyStars: "КУПИТЬ ЗА ⭐️" }
};

// --- ГЛАВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ (ФИКС КРАХА) ---
function updateUI() {
    const bDisplay = document.getElementById('balance-value');
    if (bDisplay) bDisplay.innerText = Math.floor(balance).toLocaleString();
    
    const eFill = document.getElementById('energy-fill');
    if (eFill) eFill.style.width = (energy / 10) + "%";

    const odFill = document.getElementById('boost-fill');
    if (odFill) odFill.style.width = odCharge + "%";

    renderMarket();
    renderTasks();
}

// --- МАРКЕТ С ПОДДЕРЖКОЙ STARS ---
function renderMarket() {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    const L = langMap[currentLang];

    grid.innerHTML = `
        <div class="card-nexus" onclick="buyWithStars('mult', 50)">
            <div class="card-info">
                <span class="card-title">X2 MULTIPLIER 💎</span>
                <span class="card-sub">PERMANENT POWER</span>
                <span class="card-price">50 ⭐️</span>
            </div>
            <button class="nexus-btn-buy">${L.buyStars}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">NODE v.${upgrades.node.lvl}</span>
                <span class="card-sub">COST: ${upgrades.node.cost} N</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyUpgrade('node')">UP</button>
        </div>
    `;
}

function renderTasks() {
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;
    const L = langMap[currentLang];

    const tasks = [
        { id: 'sub1', title: "JOIN HUB", reward: 50000 },
        { id: 'reach100k', title: "REACH 100K N", reward: 250000 }
    ];

    grid.innerHTML = "";
    tasks.forEach(t => {
        const done = tasksDone.includes(t.id);
        grid.innerHTML += `
            <div class="card-nexus">
                <div class="card-info"><span class="card-title">${t.title}</span><span class="card-sub">+${t.reward}</span></div>
                <button class="nexus-btn-buy" ${done ? 'disabled' : ''} onclick="completeTask('${t.id}', ${t.reward})">${done ? L.claimed : L.claim}</button>
            </div>
        `;
    });
}

// --- ЛОГИКА ТЕЛЕГРАМА (STARS & TASKS) ---
function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;
    if (id === 'reach100k' && balance < 100000) {
        tg.showAlert(langMap[currentLang].need);
        return;
    }
    balance += reward;
    tasksDone.push(id);
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    updateUI(); saveData();
}

function buyWithStars(type, price) {
    tg.openInvoice({
        title: "X2 POWER",
        description: "Premium Boost",
        currency: "XTR",
        prices: [{ label: "Buy", amount: price }],
        payload: "stars_boost"
    }, (status) => {
        if (status === 'paid') {
            upgrades.node.power *= 2;
            saveData(); updateUI();
            tg.showAlert("🔥 ACTIVATED!");
        }
    });
}

// --- ВСЕ ОСТАЛЬНЫЕ ТВОИ ФУНКЦИИ (MINE, OVERDRIVE, FIREBASE) ---
// Оставляем без изменений, как в твоем исходнике script.js (1)
// ... (здесь идет твой код кликов и сохранения) ...

function toggleModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function saveData() {
    const data = { balance, upgrades, tasksDone };
    localStorage.setItem('nexus_data', JSON.stringify(data));
    if (typeof db !== 'undefined' && user) {
        db.ref('users/' + user.id).set({ name: user.first_name, balance: balance });
    }
}

setInterval(() => { if (energy < 1000) energy += 2; updateUI(); }, 1000);
window.onload = updateUI;
