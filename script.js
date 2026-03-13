// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ (Telegram)
// ==========================================
const tg = window.Telegram.WebApp;
tg.expand(); // Открываем приложение на весь экран
const user = tg.initDataUnsafe?.user; // Данные пользователя ТГ

// ==========================================
// 2. ИГРОВЫЕ ДАННЫЕ (Загрузка из памяти телефона)
// ==========================================
// Получаем общий файл сохранений из памяти
let savedData = JSON.parse(localStorage.getItem('nexus_data')) || {};

// Распаковываем данные (если их нет - ставим значения по умолчанию)
let balance = savedData.balance || 0;
let energy = savedData.energy !== undefined ? savedData.energy : 1000;
let tasksDone = savedData.tasksDone || [];
let upgrades = savedData.upgrades || {
    node: { lvl: 1, cost: 1000, power: 1 }, // Улучшение клика
    vpn:  { lvl: 0, cost: 3240, income: 1 } // Пассивный доход
};

// Переменные состояния (не сохраняются при выходе)
let odCharge = 0;           // Заряд буста (Overdrive)
let isOverdrive = false;    // Активен ли буст сейчас

// Настройки приложения
let currentLang = localStorage.getItem('nx_lang') || 'EN';
let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

// ==========================================
// 3. СЛОВАРИ (Тексты для перевода)
// ==========================================
const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "LOADING", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS", task3: "REACH 10K N", top: "TOP MINERS", buyStars: "BUY FOR ⭐️"
        task4: "USE OVERDRIVE 1 TIME", task5: "EXPLORE MARKET", task6: "FOLLOW ON X", task7: "ACTIVATE SECRET NODE",
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАГРУЗКА", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 10К N", top: "ЛИДЕРЫ", buyStars: "КУПИТЬ ЗА ⭐️".   
        task4: "ИСПОЛЬЗУЙ БУСТ 1 РАЗ", task5: "ПОСЕТИ МАГАЗИН", task6: "ПОДПИШИСЬ В X", task7: "СЕКРЕТНЫЙ УЗЕЛ",
}
};

// ==========================================
// 4. ИНТЕРФЕЙС (Обновление текста и экрана)
// ==========================================
function updateUI() {
    const L = langMap[currentLang]; // Берем нужный словарь

    // Обновляем Имя пользователя вверху
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) {
        nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;
    }
    
    // Перевод интерфейса
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
    
    // Настройки
    document.getElementById('lang-btn').innerText = currentLang;
    document.getElementById('haptic-btn').innerText = hapticEnabled ? "ON" : "OFF";
    
    // Баланс и шкалы
    document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    document.getElementById('boost-fill').style.width = odCharge + "%";

    // Состояние кнопки Буста (Overdrive)
    const btn = document.getElementById('od-btn');
    if (isOverdrive) btn.innerText = "OVERDRIVE!!";
    else if (odCharge >= 100) btn.innerText = L.ready;
    else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
    btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;

    // Обновление Ранга в зависимости от баланса
    let newRank = "IRON";
    if (balance > 100000) newRank = "BRONZE 🥉";
    if (balance > 500000) newRank = "SILVER 🥈";
    if (balance > 2000000) newRank = "GOLD 🥇";
    if (balance > 10000000) newRank = "PLATINUM 💎";

    const rankBadge = document.getElementById('rank-badge');
    if (rankBadge && rankBadge.innerText !== newRank) {
        rankBadge.innerText = newRank;
    }

    // Перерисовываем модальные окна
    renderMarket();
    renderTasks();
}

// ==========================================
// 5. МАГАЗИН И ЗАДАНИЯ (Генерация карточек)
// ==========================================
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
    
        // Список твоих заданий (награды уменьшены в 10 раз)
        const tasks = [
        { id: 'sub1', title: L.task1, reward: 5000 },       // Канал
        { id: 'invite', title: L.task2, reward: 15000 },    // Друзья
        { id: 'reach10k', title: L.task3, reward: 25000 },  // 10К монет
        { id: 'boost_act', title: L.task4, reward: 10000 }, // Юзнуть буст
        { id: 'market_visit', title: L.task5, reward: 2000 },// Посетить рынок
        { id: 'x_follow', title: L.task6, reward: 8000 },   // Подписка в X
        { id: 'secret_node', title: L.task7, reward: 50000 } // Секретный майнер
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
                <button class="nexus-btn-buy" ${isDone ? 'disabled' : ''} onclick="completeTask('${task.id}', ${task.reward})">${isDone ? L.claimed : L.claim}</button>
            </div>
        `;
    });
}

// ==========================================
// 6. ИГРОВАЯ МЕХАНИКА (Клик, Эффекты, Таймеры)
// ==========================================

// Обработка касания по монете
document.getElementById('touch-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return; // Если нет энергии - клик не проходит

    document.getElementById('coin-visual').classList.add('pressed');

    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        
        // Расчет силы клика (Умножаем на 5, если включен Overdrive)
        let pwr = upgrades.node.lvl * upgrades.node.power * (isOverdrive ? 5 : 1);
        
        balance += pwr; 
        energy -= 2; // Трата энергии за клик
        
        // Зарядка буста
        if (!isOverdrive && odCharge < 100) odCharge += 0.4;
    
        // Эффекты цифр и частиц
        createPop(t.clientX, t.clientY, pwr);
        spawnParticles(t.clientX, t.clientY);
    }

    if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    saveData(); 
    updateUI();
});

// Отпускание монеты
document.getElementById('touch-zone').addEventListener('touchend', () => {
    document.getElementById('coin-visual').classList.remove('pressed');
});

// Всплывающие цифры при клике
function createPop(x, y, v) {
    const p = document.createElement('div'); 
    p.className = 'floating-text';
    p.innerText = '+' + v; 
    p.style.left = x + 'px'; 
    p.style.top = y + 'px';
    document.body.appendChild(p); 
    setTimeout(() => p.remove(), 600);
}

// Частицы (Искры) при клике
function spawnParticles(x, y) {
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = x + 'px'; 
        p.style.top = y + 'px';
        const a = Math.random() * Math.PI * 2; 
        const d = 30 + Math.random() * 40;
        p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 }, 
            { transform: `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px) scale(0)`, opacity: 0 }
        ], { duration: 500 });
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 500);
    }
}

// Активация Буста (Overdrive)
function activateOverdrive() {
    if (odCharge >= 100 && !isOverdrive) {
        isOverdrive = true;
        document.body.classList.add('overdrive-active');
        
        // Таймер убывания буста
        let t = setInterval(() => {
            odCharge -= 1.5; 
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

// Глобальный таймер (Регенерация энергии и Пассивный доход)
setInterval(() => {
    if (upgrades.vpn.lvl > 0) {
        balance += (upgrades.vpn.lvl * 2) / 10; // Доход от VPN
    }
    if (energy < 1000) {
        energy += 2.5; // Восстановление энергии
    }
    updateUI();
}, 100);

// ==========================================
// 7. ЛОГИКА ПОКУПОК И ЗАДАНИЙ
// ==========================================

// Покупка улучшений за монеты
function buyItem(type) {
    let u = upgrades[type];
    if (balance >= u.cost) {
        balance -= u.cost; 
        u.lvl++;
        u.cost = Math.floor(u.cost * 1.7); // Увеличение цены следующего уровня
        saveData(); 
        updateUI(); 
        tg.HapticFeedback.notificationOccurred('success');
    }
}

// Выполнение заданий
function completeTask(id, reward) {
    if (!tasksDone.includes(id)) {
        // Логика для разных типов заданий
        if (id === 'sub1') {
            tg.openTelegramLink('https://t.me/nexus_protocol');
        } else if (id === 'invite') {
            const inviteLink = `https://t.me/nexus_protocol_bot?start=${user?.id || 'ref'}`;
            tg.openLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=Join Nexus!`);
        } else if (id === 'x_follow') {
            tg.openLink('https://twitter.com/your_account'); // Замени на свою ссылку
        } else if (id === 'market_visit') {
            toggleModal('market-modal'); // Просто открываем магазин
        } else if (id === 'reach10k' && balance < 10000) {
            tg.showAlert("Нужно накопить 10,000 N!");
            return; // Не даем забрать, если баланс мал
        }

        // Начисление
        balance += reward;
        tasksDone.push(id);
        saveData();
        tg.HapticFeedback.notificationOccurred('success');
        updateUI();
    }
}

// Покупка за Telegram Stars (Пока заглушка)
function buyWithStars(type, price) {
    if(confirm(`Confirm purchase for ${price} ⭐️?`)) {
        if(type === 'mult') { 
            upgrades.node.power *= 2;
            alert("X2 Activated!"); 
        }
        if(type === 'speed') { 
            alert("Regen Speed Upgraded!");
        }
        saveData(); 
        updateUI();
    }
}

// ==========================================
// 8. РЕЙТИНГ (Работа с Firebase) И СОХРАНЕНИЯ
// ==========================================

// Открытие ТОП майнеров
function openRanks() {
    const c = document.getElementById('rank-list-container');
    c.innerHTML = "<div style='text-align:center; padding:20px; color: #aaa;'>ЗАГРУЗКА ЛИДЕРОВ...</div>";

    // Тянем из базы 10 лучших по балансу
    db.ref('users').orderByChild('balance').limitToLast(10).once('value', (snapshot) => {
        let players = [];
        snapshot.forEach((child) => {
            const data = child.val();
            players.push({
                name: (data.name || "PLAYER").toUpperCase(),
                balance: data.balance || 0,
                me: child.key == user?.id // Подсветим себя в списке
            });
        });

        // Сортируем (от большего к меньшему)
        players.sort((a, b) => b.balance - a.balance);
        
        c.innerHTML = "";
        players.forEach((p, i) => {
            c.innerHTML += `
            <div class="rank-item ${p.me ? 'active-rank' : ''}">
                <span>${i + 1}</span>
                <b>${p.name}</b>
                <span>${Math.floor(p.balance).toLocaleString()} N</span>
            </div>`;
        });
    });
    toggleModal('rank-modal');
}

// ЕДИНИЙ ЦЕНТР СОХРАНЕНИЙ
function saveData() {
    // 1. Сохраняем локально в телефон (в один файл 'nexus_data')
    const data = { balance, energy, upgrades, tasksDone };
    localStorage.setItem('nexus_data', JSON.stringify(data));

    // 2. ОТПРАВЛЯЕМ В ОБЛАКО (Firebase)
    if (typeof db !== 'undefined' && user && user.id) {
        db.ref('users/' + user.id).set({
            name: user.first_name || "Unknown",
            balance: balance,
            lastSeen: Date.now()
        });
    }
}

// ==========================================
// 9. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Окна, Язык)
// ==========================================

// Открытие/закрытие модальных окон
function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

// Смена языка
function changeLanguage() { 
    currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
    localStorage.setItem('nx_lang', currentLang); 
    updateUI();
}

// Смена настройки вибрации
function toggleHaptic() { 
    hapticEnabled = !hapticEnabled; 
    localStorage.setItem('nx_haptic', hapticEnabled ? 'off' : 'on'); 
    updateUI(); 
}

// Запуск отрисовки интерфейса при старте
updateUI();
