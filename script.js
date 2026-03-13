// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ (Telegram)
// ==========================================
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;

// ==========================================
// 2. ЗАГРУЗКА ДАННЫХ (localStorage)
// ==========================================
let savedData = JSON.parse(localStorage.getItem('nexus_data')) || {};

let balance = savedData.balance || 0;
let energy = savedData.energy !== undefined ? savedData.energy : 1000;
let tasksDone = savedData.tasksDone || [];
let lastLogin = savedData.lastLogin || 0;
let dayStreak = savedData.dayStreak || 0;

let upgrades = savedData.upgrades || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn:  { lvl: 0, cost: 3240, income: 1 }
};

// Состояние в текущей сессии
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// ==========================================
// 3. СЛОВАРЬ (Переводы)
// ==========================================
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "LOADING", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN HUB", task2: "INVITE 5", task3: "REACH 10K", 
        task4: "USE BOOST", task5: "GO TO MARKET", task6: "FOLLOW X", task7: "SECRET NODE",
        top: "TOP MINERS", buyStars: "BUY FOR ⭐️"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАГРУЗКА", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 10К", 
        task4: "ЮЗНИ БУСТ", task5: "ПОСЕТИ МАГАЗИН", task6: "ПОДПИШИСЬ В X", task7: "СЕКРЕТНЫЙ УЗЕЛ",
        top: "ЛИДЕРЫ", buyStars: "КУПИТЬ ЗА ⭐️"
    }
};

// ==========================================
// 4. ГЛАВНЫЕ ФУНКЦИИ (Интерфейс)
// ==========================================
function updateUI() {
    const L = langMap[currentLang];

    // Обновляем текст на кнопках и в заголовках
    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";
    
    // Имя и ранг
    if (user) document.getElementById('user-name').innerText = `NEX | ${user.first_name.toUpperCase()}`;
    
    // Текст кнопок меню
    document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
    document.getElementById('nav-market').querySelector('span').innerText = L.market;
    document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;

    // Состояние буста
    const btn = document.getElementById('od-btn');
    if (isOverdrive) btn.innerText = "OVERDRIVE!!";
    else if (odCharge >= 100) btn.innerText = L.ready;
    else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;

    renderMarket();
    renderTasks();
}

// ==========================================
// 5. ЛОГИКА КЛИКА (То, что сломалось)
// ==========================================
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    touchZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (energy < 2) return;

        document.getElementById('coin-visual').classList.add('pressed');

        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let pwr = upgrades.node.lvl * (isOverdrive ? 5 : 1); // Сила клика
            
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
        document.getElementById('coin-visual').classList.remove('pressed');
    });
}

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
// 6. ЕЖЕДНЕВНЫЙ БОНУС И СИСТЕМА
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
            tg.showAlert(`🚀 NEXUS BONUS!\nDay: ${dayStreak}\nReward: +${reward} N`);
            updateUI();
        }, 1000);
    }
}

// Буст
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

// ==========================================
// 7. МАГАЗИН И ЗАДАНИЯ
// ==========================================
function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost;
        u.lvl++;
        u.cost = Math.floor(u.cost * 1.8);
        saveData();
        updateUI();
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function completeTask(id, reward) {
    if (!tasksDone.includes(id)) {
        if (id === 'sub1') tg.openTelegramLink('https://t.me/nexus_protocol');
        // Здесь можно добавить проверку условий для других заданий
        balance += reward;
        tasksDone.push(id);
        saveData();
        updateUI();
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function renderMarket() {
    const L = langMap[currentLang];
    const m = document.getElementById('market-grid');
    if(!m) return;
    m.innerHTML = `
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

function renderTasks() {
    const L = langMap[currentLang];
    const t = document.getElementById('tasks-grid');
    if(!t) return;
    const taskList = [
        { id: 'sub1', title: L.task1, reward: 5000 },
        { id: 'reach10k', title: L.task3, reward: 25000 }
    ];
    t.innerHTML = taskList.map(task => `
        <div class="card-nexus">
            <div class="card-info"><b>${task.title}</b><br><small>+${task.reward} N</small></div>
            <button class="nexus-btn-buy" ${tasksDone.includes(task.id)?'disabled':''} onclick="completeTask('${task.id}', ${task.reward})">
                ${tasksDone.includes(task.id)? L.claimed : L.claim}
            </button>
        </div>
    `).join('');
}

// ==========================================
// 8. СЕРВИСНЫЕ ФУНКЦИИ (Окна, Сохранение)
// ==========================================
function toggleModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function saveData() {
    const data = { balance, energy, upgrades, tasksDone, lastLogin, dayStreak };
    localStorage.setItem('nexus_data', JSON.stringify(data));
}

// Авто-майнинг и реген
setInterval(() => {
    if (upgrades.vpn.lvl > 0) balance += (upgrades.vpn.lvl * 0.1);
    if (energy < 1000) energy += 1.5;
    updateUI();
}, 1000);

// Смена настроек
function changeLanguage() { 
    currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
    localStorage.setItem('nx_lang', currentLang); 
    updateUI(); 
}
function toggleHaptic() { 
    hapticEnabled = !hapticEnabled; 
    localStorage.setItem('nx_haptic', hapticEnabled ? 'on' : 'off'); 
    updateUI(); 
}

// СТАРТ
checkDailyReward();
updateUI();
