const tg = window.Telegram.WebApp;
tg.expand();

// Данные пользователя
const user = tg.initDataUnsafe?.user;
document.getElementById('user-name').innerText = user ? user.first_name : "GUEST";
document.getElementById('user-id').innerText = user ? user.id : "0000";

let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000 }, vpn: { lvl: 0, cost: 3240 }
};
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
let energy = 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';

const langMap = {
    EN: { task1: "JOIN @NEXUS_PROTOCOL", buy: "UPGRADE", claim: "CLAIM", claimed: "DONE" },
    RU: { task1: "ВСТУПИ В КАНАЛ", buy: "КУПИТЬ", claim: "ЗАБРАТЬ", claimed: "ГОТОВО" }
};

function updateUI() {
    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    const btn = document.getElementById('od-btn');
    btn.innerText = odCharge >= 100 ? "READY" : `LOADING ${Math.floor(odCharge)}%`;
    btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''}`;

    // СИСТЕМА РАНГОВ
    let r = "NEWBIE";
    if (balance > 5000) r = "NODE OPERATOR";
    if (balance > 50000) r = "SYSTEM ARCHITECT";
    if (balance > 1000000) r = "NEXUS WHALE 🐋";
    document.getElementById('rank-badge').innerText = r;

    renderMarket();
    renderTasks();
}

function renderMarket() {
    const grid = document.getElementById('market-grid');
    grid.innerHTML = `
        <div class="card-nexus">
            <div><b>NODE v.${upgrades.node.lvl}</b><br><small>Cost: ${upgrades.node.cost}</small></div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">UPGRADE</button>
        </div>
    `;
}

function renderTasks() {
    const grid = document.getElementById('tasks-grid');
    const isDone = tasksDone.includes('sub1');
    grid.innerHTML = `
        <div class="card-nexus">
            <div><b>JOIN @NEXUS_PROTOCOL</b><br><small>+50,000 NEX</small></div>
            <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} onclick="checkSub()">
                ${isDone ? 'DONE' : 'CLAIM'}
            </button>
        </div>
    `;
}

function checkSub() {
    alert("Checking subscription to @NEXUS_PROTOCOL...");
    setTimeout(() => {
        balance += 50000;
        tasksDone.push('sub1');
        localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
        saveData(); updateUI();
        alert("Bonus 50,000 NEX added!");
    }, 1500);
}

document.getElementById('touch-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    document.getElementById('coin-visual').classList.add('pressed');
    balance += upgrades.node.lvl * (isOverdrive ? 5 : 1);
    energy -= 2;
    if (odCharge < 100) odCharge += 0.5;
    saveData(); updateUI();
});

document.getElementById('touch-zone').addEventListener('touchend', () => {
    document.getElementById('coin-visual').classList.remove('pressed');
});

function activateOverdrive() {
    if (odCharge >= 100) {
        isOverdrive = true;
        let t = setInterval(() => {
            odCharge -= 2; updateUI();
            if (odCharge <= 0) { clearInterval(t); isOverdrive = false; }
        }, 100);
    }
}

function buyItem(type) {
    if (balance >= upgrades[type].cost) {
        balance -= upgrades[type].cost;
        upgrades[type].lvl++;
        upgrades[type].cost = Math.floor(upgrades[type].cost * 1.5);
        saveData(); updateUI();
    }
}

function saveData() {
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
}

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

setInterval(() => { if (energy < 1000) energy += 1; updateUI(); }, 500);
updateUI();
