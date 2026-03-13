        
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
// --- ИНИЦИАЛИЗАЦИЯ КОШЕЛЬКА ---
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://eda95s.github.io/Nexus-app/tonconnect-manifest.json',
    buttonRootId: "ton-connect-button"
});

tonConnectUI.onStatusChange(wallet => {
    if (wallet) {
        NexusShield.execute("Wallet_Connect", () => {
            if (typeof tasksDone !== 'undefined' && !tasksDone.includes('wallet_linked')) {
                Core.modifyBalance(100000); // Даем сразу 100к за старания!
                tasksDone.push('wallet_linked');
                saveData();
                updateUI();
                tg.showAlert("✅ Кошелек привязан! +100,000 N");
            }
        });
    }
});

// ==========================================
// NEXUS SHIELD (СИСТЕМА ЗАЩИТЫ И ОТЛАДКИ)
// ==========================================
const NexusShield = {
    execute: function(moduleName, task) {
        try {
            task();
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

function showDonationQR() {
    NexusShield.execute("Donation_System", () => {
        // Вибрация при нажатии
        tg.HapticFeedback.impactOccurred('medium');

        tg.showPopup({
            title: 'Поддержать Nexus 💎',
            message: 'Перевод в сети BSC (BEP20). Твоя поддержка помогает нам развивать систему майнинга!',
            buttons: [
                {id: 'view_qr', type: 'default', text: 'Открыть QR-код'},
                {id: 'copy_addr', type: 'default', text: 'Копировать адрес'},
                {id: 'close', type: 'destructive', text: 'Закрыть'}
            ]
        }, (buttonId) => {
            if (buttonId === 'view_qr') {
                // Открываем картинку, которую ты загрузишь в GitHub
                tg.showAsset('https://eda95s.github.io/Nexus-app/donation_qr.jpg');
            } else if (buttonId === 'copy_addr') {
                // Твой адрес из скриншота
                const addr = "0x77e596231a14dee635e42c62ce215a2a47ec2c74";
                // Копируем в буфер обмена (стандартный метод)
                navigator.clipboard.writeText(addr).then(() => {
                    tg.showAlert("Адрес скопирован! Спасибо за поддержку!");
                });
            }
        });
    });
}


// ==========================================
// ИГРОВЫЕ ДАННЫЕ
// ==========================================
let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
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

    let newRank = "IRON";
    if (balance > 100000) newRank = "BRONZE 🥉";
    if (balance > 500000) newRank = "SILVER 🥈";
    if (balance > 2000000) newRank = "GOLD 🥇";
    if (balance > 10000000) newRank = "PLATINUM 💎";

    const rankBadge = document.getElementById('rank-badge');
    if (rankBadge && rankBadge.innerText !== newRank) {
        rankBadge.innerText = newRank;
    }

    renderMarket();
    renderTasks();
}

function renderMarket() {
    const L = langMap[currentLang];
    const grid = document.getElementById('market-grid');
    
    const premiumTexts = {
        mult: currentLang === 'RU' ? { title: "МНОЖИТЕЛЬ X2 💎", desc: "ПОСТОЯННАЯ ДВОЙНАЯ СИЛА" } : { title: "X2 MULTIPLIER 💎", desc: "PERMANENT DOUBLE TAP" },
        speed: currentLang === 'RU' ? { title: "КИБЕР-СКОРОСТЬ ⚡️", desc: "X2 РЕГЕНЕРАЦИЯ ЭНЕРГИИ" } : { title: "CYBER SPEED ⚡️", desc: "X2 ENERGY REGEN" }
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

function openRanks() {
    const c = document.getElementById('rank-list-container');
    c.innerHTML = "<div style='text-align:center; padding:20px; color: #aaa;'>ЗАГРУЗКА ЛИДЕРОВ...</div>";

    if(typeof db !== 'undefined') {
        db.ref('users').orderByChild('balance').limitToLast(10).once('value', (snapshot) => {
            let players = [];
            snapshot.forEach((child) => {
                const data = child.val();
                players.push({
                    name: (data.name || "PLAYER").toUpperCase(),
                    balance: data.balance || 0,
                    me: child.key == user?.id
                });
            });

            players.sort((a, b) => b.balance - a.balance);
            
            c.innerHTML = "";
            players.forEach((p, i) => {
                c.innerHTML += `<div class="rank-item ${p.me ? 'active-rank' : ''}">
                    <span>${i + 1}</span>
                    <b>${p.name}</b>
                    <span>${Math.floor(p.balance).toLocaleString()} N</span>
                </div>`;
            });
        });
    }
    toggleModal('rank-modal');
}

// ==========================================
// ЛОГИКА ПОКУПОК И ЗАДАНИЙ
// ==========================================
function buyWithStars(type, price) {
    if(confirm(`Confirm purchase for ${price} ⭐️?`)) {
        if(type === 'mult') { upgrades.node.power *= 2; alert("X2 Activated!"); }
        if(type === 'speed') { alert("Regen Speed Upgraded!"); }
        saveData(); updateUI();
    }
}

function buyItem(type) {
    NexusShield.execute("Market_Purchase", () => {
        let u = upgrades[type];
        if (balance >= u.cost) {
            balance -= u.cost; 
            u.lvl++;
            u.cost = Math.floor(u.cost * 1.7);
            saveData(); 
            updateUI(); 
            if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
        } else {
            alert("Недостаточно N!");
        }
    });
}

function completeTask(id, reward) {
    NexusShield.execute("Task_Complete", () => {
        if (!tasksDone.includes(id)) {
            if (id === 'sub1') {
                tg.openTelegramLink('https://t.me/nexus_protocol');
            } else if (id === 'invite') {
                const inviteLink = `https://t.me/nexus_protocol_bot?start=${user?.id || 'ref'}`;
                tg.openLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=Присоединяйся к NEX!`);
            }
            balance += reward;
            tasksDone.push(id);
            localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
            if (hapticEnabled) tg.HapticFeedback.notificationOccurred('success');
            updateUI();
            saveData();
        }
    });
}

function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        document.body.classList.add('overdrive-active');
        let t = setInterval(() => {
            odCharge -= 1.5; updateUI();
            if (odCharge <= 0) { clearInterval(t); isOverdrive = false; document.body.classList.remove('overdrive-active'); odCharge = 0; updateUI(); }
        }, 100);
    }
}

// ==========================================
// ГЛАВНЫЙ КЛИКЕР И ВИЗУАЛ
// ==========================================
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        NexusShield.execute("Mining_Click", () => {
            if (energy < 2) return;
            document.getElementById('coin-visual').classList.add('pressed');
            
            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
                let pwr = upgrades.node.lvl * upgrades.node.power * (isOverdrive ? 5 : 1);
                
                // ШАНС КРИТА: 1%
                let isCritical = Math.random() < 0.01;
                if (isCritical) {
                    pwr *= 10;
                    if (hapticEnabled && window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
                    }
                }

                Core.modifyBalance(pwr); 
                Core.consumeEnergy(2);
                
                if (!isOverdrive && odCharge < 100) odCharge += 0.4;
            
                createPop(t.clientX, t.clientY, pwr, isCritical);
                spawnParticles(t.clientX, t.clientY);
            }
            if (hapticEnabled && window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        });
    }, {passive: false});

    touchZone.addEventListener('touchend', () => {
        const coin = document.getElementById('coin-visual');
        if(coin) coin.classList.remove('pressed');
    });
}

function createPop(x, y, v, isCritical = false) {
    const p = document.createElement('div'); 
    p.className = 'floating-text';
    
    if (isCritical) {
        p.innerText = '+' + v + ' 🔥'; 
        p.style.color = '#ffcc00'; 
        p.style.fontSize = '3.5rem';
        p.style.zIndex = '2001';
    } else {
        p.innerText = '+' + v; 
    }

    p.style.left = x + 'px'; 
    p.style.top = y + 'px';
    document.body.appendChild(p); 
    setTimeout(() => p.remove(), 600);
}

function spawnParticles(x, y) {
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = x + 'px'; p.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2; const d = 30 + Math.random() * 40;
        p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px) scale(0)`, opacity: 0 }], { duration: 500 });
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 500);
    }
}

// ==========================================
// СИСТЕМНЫЕ ФУНКЦИИ И ЦИКЛЫ
// ==========================================
setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 2) / 10;
    if (energy < 1000) energy += 2.5;
    localStorage.setItem('nexus_energy', energy);
    updateUI();
}, 100);

function toggleModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function changeLanguage() { 
    currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
    localStorage.setItem('nx_lang', currentLang); 
    updateUI();
}

function toggleHaptic() { 
    hapticEnabled = !hapticEnabled; 
    localStorage.setItem('nx_haptic', hapticEnabled?'off':'on'); 
    updateUI(); 
}

function saveData() {
    const data = { balance, upgrades, tasksDone };
    localStorage.setItem('nexus_data', JSON.stringify(data));
    localStorage.setItem('nexus_bal', balance);

    if (typeof db !== 'undefined' && user && user.id) {
        db.ref('users/' + user.id).set({
            name: user.first_name || "Unknown",
            balance: balance,
            lastSeen: Date.now()
        });
    }
}

// Запуск при старте
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});
updateUI();
