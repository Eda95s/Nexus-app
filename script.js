const username = tg.initDataUnsafe?.user?.first_name || "MINER";
document.getElementById('player-display-name').innerText = username.toUpperCase();

const tg = window.Telegram.WebApp;
tg.expand();

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

// --- ЛОКАЛИЗАЦИЯ (ПОЛНАЯ) ---
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

    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    const btn = document.getElementById('od-btn');
    if (isOverdrive) btn.innerText = "OVERDRIVE!!";
    else if (odCharge >= 100) btn.innerText = L.ready;
    else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;

    let r = "IRON";
    if (balance > 100000) r = "BRONZE 🥉";
    if (balance > 500000) r = "SILVER 🥈";
    if (balance > 2000000) r = "GOLD 🥇";
    if (balance > 10000000) r = "PLATINUM 💎";
    document.getElementById('rank-badge').innerText = r;

    renderMarket();
    renderTasks();
}

// --- МАГАЗИН (STARS + NORMAL) ---
function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    
    // Определяем тексты для премиум-товаров в зависимости от языка
    const premiumTexts = {
        mult: currentLang === 'RU' ? 
            { title: "МНОЖИТЕЛЬ X2 💎", desc: "ПОСТОЯННАЯ ДВОЙНАЯ СИЛА" } : 
            { title: "X2 MULTIPLIER 💎", desc: "PERMANENT DOUBLE TAP" },
        speed: currentLang === 'RU' ? 
            { title: "КИБЕР-СКОРОСТЬ ⚡️", desc: "X2 РЕГЕНЕРАЦИЯ ЭНЕРГИИ" } : 
            { title: "CYBER SPEED ⚡️", desc: "X2 ENERGY REGEN" }
    };

    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">${premiumTexts.mult.title}</span>
                <span class="card-sub">${premiumTexts.mult.desc}</span>
                <span class="card-price">50 ⭐️</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyWithStars('mult', 50)">${L.buyStars}</button>
        </div>

        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">${premiumTexts.speed.title}</span>
                <span class="card-sub">${premiumTexts.speed.desc}</span>
                <span class="card-price">100 ⭐️</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyWithStars('speed', 100)">${L.buyStars}</button>
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


// --- СИСТЕМА ЗАДАНИЙ ---
function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
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
                <div class="card-info"><span class="card-title">${task.title}</span><span class="card-sub">+${task.reward.toLocaleString()} N</span></div>
                <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} onclick="completeTask('${task.id}', ${task.reward})">${isDone ? L.claimed : L.claim}</button>
            </div>
        `;
    });
}

// --- РЕЙТИНГ (ЧЕСТНЫЙ) ---
function openRanks() {
    toggleModal('rank-modal');
    const container = document.getElementById('rank-list-container');
    const L = langMap[currentLang];
    
    // В будущем здесь будет запрос к базе данных. 
    // Сейчас показываем тебя как лидера, чтобы проверить работу интерфейса.
    const leaderData = [
        { name: username, bal: balance, sub: true, isMe: true }
    ];

    container.innerHTML = leaderData.map((player, index) => `
        <div class="rank-item ${player.isMe ? 'active-rank' : ''}">
            <div class="rank-num">#${index + 1}</div>
            <div class="rank-info">
                <div class="rank-name">${player.name} ${player.sub ? '✅' : ''}</div>
                <div class="rank-val">${Math.floor(player.bal).toLocaleString()} NEX</div>
            </div>
        </div>
    `).join('');
}


// --- ЛОГИКА ОПЛАТЫ STARS ---
function buyWithStars(type, price) {
    if(confirm(`Confirm purchase for ${price} ⭐️?`)) {
        if(type === 'mult') { upgrades.node.power *= 2; alert("X2 Activated!"); }
        if(type === 'speed') { alert("Regen Speed Upgraded!"); }
        saveData(); updateUI();
    }
}

// --- КЛИКЕР И ЭФФЕКТЫ ---
document.getElementById('touch-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    document.getElementById('coin-visual').classList.add('pressed');
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        let pwr = upgrades.node.lvl * upgrades.node.power * (isOverdrive ? 5 : 1);
        balance += pwr; energy -= 2;
        if (!isOverdrive && odCharge < 100) odCharge += 0.4;
        createPop(t.clientX, t.clientY, pwr);
        spawnParticles(t.clientX, t.clientY);
    }
    if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    saveData(); updateUI();
});

document.getElementById('touch-zone').addEventListener('touchend', () => document.getElementById('coin-visual').classList.remove('pressed'));

function createPop(x, y, v) {
    const p = document.createElement('div'); p.className = 'floating-text';
    p.innerText = '+' + v; p.style.left = x + 'px'; p.style.top = y + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 600);
}

function spawnParticles(x, y) {
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div'); p.className = 'particle';
        p.style.left = x + 'px'; p.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2; const d = 30 + Math.random() * 40;
        p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px) scale(0)`, opacity: 0 }], { duration: 500 });
        document.body.appendChild(p); setTimeout(() => p.remove(), 500);
    }
}

function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true; document.body.classList.add('overdrive-active');
        let t = setInterval(() => {
            odCharge -= 1.5; updateUI();
            if (odCharge <= 0) { clearInterval(t); isOverdrive = false; document.body.classList.remove('overdrive-active'); odCharge = 0; updateUI(); }
        }, 100);
    }
}

function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; u.lvl++; u.cost = Math.floor(u.cost * 1.7);
        saveData(); updateUI(); tg.HapticFeedback.notificationOccurred('success');
    }
}

function completeTask(id, reward) {
    if (!tasksDone.includes(id)) {
        balance += reward; tasksDone.push(id);
        localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
        tg.HapticFeedback.notificationOccurred('success'); updateUI();
    }
}

setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    if (energy < 1000) energy += 2.5; // Чуть быстрее реген
    updateUI();
}, 100);

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function changeLanguage() { currentLang = currentLang === 'EN' ? 'RU' : 'EN'; localStorage.setItem('nx_lang', currentLang); updateUI(); }
function toggleHaptic() { hapticEnabled = !hapticEnabled; localStorage.setItem('nx_haptic', hapticEnabled?'off':'on'); updateUI(); }
function saveData() { localStorage.setItem('nexus_bal', balance); localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades)); }

updateUI();
