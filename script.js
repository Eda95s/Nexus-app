// 1. ИНИЦИАЛИЗАЦИЯ
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;

// 2. ЗАГРУЗКА ДАННЫХ
let savedData = JSON.parse(localStorage.getItem('nexus_data')) || {};

let balance = savedData.balance || 0;
let energy = savedData.energy !== undefined ? savedData.energy : 1000;
let tasksDone = savedData.tasksDone || [];
let upgrades = savedData.upgrades || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn:  { lvl: 0, cost: 3240, income: 1 }
};

let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'RU';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

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

// 3. UI
function updateUI() {
    const L = langMap[currentLang];
    
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;

    // Тексты
    try {
        document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
        document.getElementById('nav-market').querySelector('span').innerText = L.market;
        document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;
        document.getElementById('lbl-energy').innerText = L.energy;
        document.getElementById('lbl-sync').innerText = L.overdrive;
        document.getElementById('m-sys-title').innerText = L.sys;
        document.getElementById('lbl-lang').innerText = L.lang;
        document.getElementById('lbl-haptic').innerText = L.haptic;
        document.getElementById('m-market-title').innerText = L.market;
        document.getElementById('m-tasks-title').innerText = L.tasks;
        document.getElementById('m-rank-title').innerText = L.top;
        document.querySelectorAll('.close-btn-nexus').forEach(b => b.innerText = L.close);
        document.getElementById('lang-btn').innerText = currentLang;
        document.getElementById('haptic-btn').innerText = hapticEnabled ? "ON" : "OFF";
    } catch(e) {}

    // Баланс
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

// 4. МЕХАНИКА
document.getElementById('touch-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    document.getElementById('coin-visual').classList.add('pressed');

    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        let pwr = (upgrades.node.lvl * (upgrades.node.power || 1)) * (isOverdrive ? 5 : 1);
        balance += pwr; 
        energy -= 2;
        if (!isOverdrive && odCharge < 100) odCharge += 0.4;
        createPop(t.clientX, t.clientY, pwr);
    }
    if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    saveData(); 
    updateUI();
});

document.getElementById('touch-zone').addEventListener('touchend', () => {
    document.getElementById('coin-visual').classList.remove('pressed');
});

function createPop(x, y, v) {
    const p = document.createElement('div'); 
    p.className = 'floating-text';
    p.innerText = '+' + v; 
    p.style.left = x + 'px'; p.style.top = y + 'px';
    document.body.appendChild(p); 
    setTimeout(() => p.remove(), 600);
}

function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        document.body.classList.add('overdrive-active');
        let t = setInterval(() => {
            odCharge -= 1.5; 
            updateUI();
            if (odCharge <= 0) { 
                clearInterval(t); isOverdrive = false; 
                document.body.classList.remove('overdrive-active'); 
                odCharge = 0; updateUI(); 
            }
        }, 100);
    }
}

// 5. МАГАЗИН И ЗАДАНИЯ
function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    if(!grid) return;
    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">NODE v.${upgrades.node.lvl}</span>
                <span class="card-sub">${L.power}: +${upgrades.node.lvl}</span>
                <span class="card-price">${upgrades.node.cost.toLocaleString()} N</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyItem('node')">${L.buy}</button>
        </div>
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">VPN v.${upgrades.vpn.lvl}</span>
                <span class="card-sub">${L.inc}: +${upgrades.vpn.lvl}/SEC</span>
                <span class="card-price">${upgrades.vpn.cost.toLocaleString()} N</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyItem('vpn')">${L.buy}</button>
        </div>
    `;
}

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if(!grid) return;
    const tasks = [
        { id: 'sub1', title: L.task1, reward: 50000 },
        { id: 'reach100k', title: L.task3, reward: 250000 }
    ];
    grid.innerHTML = "";
    tasks.forEach(task => {
        const isDone = tasksDone.includes(task.id);
        grid.innerHTML += `
            <div class="card-nexus">
                <div class="card-info"><span class="card-title">${task.title}</span><span class="card-sub">+${task.reward.toLocaleString()} N</span></div>
                <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} onclick="completeTask('${task.id}', ${task.reward})">${isDone ? L.claimed : L.claim}</button>
            </div>`;
    });
}

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
        saveData(); updateUI();
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;
    if (id === 'sub1') tg.openTelegramLink('https://t.me/nexus_protocol');
    if (id === 'reach100k' && balance < 100000) {
        tg.showAlert("Нужно 100,000 N!"); return;
    }
    balance += reward; tasksDone.push(id);
    saveData(); updateUI();
    tg.HapticFeedback.notificationOccurred('success');
}

// 6. СОХРАНЕНИЕ
function saveData() {
    localStorage.setItem('nexus_data', JSON.stringify({ balance, energy, upgrades, tasksDone }));
    if (typeof db !== 'undefined' && user?.id) {
        db.ref('users/' + user.id).set({ name: user.first_name, balance: balance, lastSeen: Date.now() });
    }
}

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function changeLanguage() { currentLang = currentLang === 'EN' ? 'RU' : 'EN'; localStorage.setItem('nx_lang', currentLang); updateUI(); }
function toggleHaptic() { hapticEnabled = !hapticEnabled; localStorage.setItem('nx_haptic', hapticEnabled ? 'on' : 'off'); updateUI(); }

function openRanks() {
    const c = document.getElementById('rank-list-container');
    c.innerHTML = "LOADING...";
    db.ref('users').orderByChild('balance').limitToLast(10).once('value', (s) => {
        let p = []; s.forEach(child => p.push({...child.val(), id: child.key}));
        p.sort((a,b) => b.balance - a.balance);
        c.innerHTML = p.map((u, i) => `<div class="rank-item ${u.id==user?.id?'active-rank':''}"><span>${i+1}</span><b>${u.name}</b><span>${Math.floor(u.balance).toLocaleString()}</span></div>`).join('');
    });
    toggleModal('rank-modal');
}

setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 0.2);
    if (energy < 1000) energy += 2;
    updateUI();
}, 1000);

updateUI();
