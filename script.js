/**
 * NEXFLOW VPN & MINING ENGINE - FULL MONOLITHIC CORE
 * Version: 2.2.0_FIREBASE_ONLY (800+ Lines Logic)
 */

// Самая первая строка файла - Глобальная функция удаления сообщений
window.deleteMsg = function(id) {
    if (!id) return;
    const tg = window.Telegram.WebApp;
    tg.showConfirm("Удалить сообщение?", (ok) => {
        if (ok) {
            firebase.database().ref('chat').child(id).remove()
                .then(() => {
                    tg.HapticFeedback.notificationOccurred('success');
                })
                .catch((e) => {
                    tg.showAlert("Ошибка: " + e.message);
                });
        }
    });
};

(function() { 
    const tg = window.Telegram.WebApp;
    const db = firebase.database();
    tg.expand();
    const user = tg.initDataUnsafe?.user;

    // ПРОВЕРКА СМЕНЫ АККАУНТА (Очистка призраков прошлого)
    const savedId = localStorage.getItem('nexus_user_id');
    if (user && user.id) {
        if (savedId && savedId !== String(user.id)) {
            console.warn("⚠️ Смена аккаунта! Полная очистка...");
            localStorage.clear();
            // Принудительно ставим нули, чтобы не подтянулись старые цифры
            balance = 0;
            energy = 1000;
            upgrades = {};
            tasksDone = {};
        }
        localStorage.setItem('nexus_user_id', user.id);
    }

    // ==========================================
    // КОНФИГУРАЦИЯ
    // ==========================================
    const GAME_VERSION = "2.2.0_FIREBASE_ONLY"; 
    const BOT_TOKEN = "7544093954:AAH3H38R-o6v5rK6eHjK_X-Yy3vWk7E8K4o";
    const CHANNEL_ID = "-1002086386401";
    const API_URL = "https://your-api-server.com"; // Добавлено для корректной работы syncWithServer

    function checkFirebase() {
        const connectedRef = firebase.database().ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                console.log("✅ СВЯЗЬ С FIREBASE УСТАНОВЛЕНА");
            } else {
                console.error("❌ ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ FIREBASE");
            }
        });
    }
    checkFirebase();
    
    function checkVersionReset() {
        const savedVersion = localStorage.getItem('nexus_version');
        if (savedVersion !== GAME_VERSION) {
            localStorage.clear();
            localStorage.setItem('nexus_version', GAME_VERSION);
            return true;
        }
        return false;
    }

    const isWasReset = checkVersionReset();
    
    let balance = parseFloat(localStorage.getItem('nexus_bal')) || 0;
    let accumulatedClicks = 0; 
    let lastTime = parseInt(localStorage.getItem('nexus_last_time')) || Date.now();
    let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
        node: { lvl: 1, cost: 45000, power: 1 },
        vpn: { lvl: 0, cost: 50000, income: 1 }
    };

    let activeBoosts = JSON.parse(localStorage.getItem('nexus_active_boosts')) || {
        multEnd: 0,
        speedEnd: 0
    };

    let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
    let energy = parseInt(localStorage.getItem('nexus_energy')) || 1000;
    let odCharge = 0;
    let isOverdrive = false;
    let currentLang = localStorage.getItem('nx_lang') || 'EN';
    let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

    let lastDailyClaim = parseInt(localStorage.getItem('nexus_daily')) || 0;
    let dailyStreak = parseInt(localStorage.getItem('nexus_streak')) || 0;
    let refClaimed = localStorage.getItem('nexus_ref_claimed') === 'true';

    let lastRankIndex = -1; 
    let millionMilestone = Math.floor(balance / 1000000);
    let taskTimers = {};
    let lastMessageTime = 0; 
    const userId = user?.id || "unknown"; 

    // --- ФУНКЦИЯ СИНХРОНИЗАЦИИ ---
  async function syncWithServer() {
    // Только реальный юзер из ТГ
    const currentUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!currentUser || !currentUser.id) return;

    if (accumulatedClicks > 0) {
        try {
            const response = await fetch(`${API_URL}/api/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors', 
                body: JSON.stringify({
                    userId: String(currentUser.id),
                    name: currentUser.first_name,
                    clicks: accumulatedClicks
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.balance !== undefined) {
                    balance = data.balance;
                    accumulatedClicks = 0;
                    updateUI();
                }
            }
        } catch (e) {
            console.error("API Sync Error:", e);
        }
    }
}
    // --- EVENT LOG ---
    const NexusEvent = {
        log: function(msgEn, msgRu) {
            const container = document.getElementById('event-log-container');
            if(!container) return;
            const text = currentLang === 'RU' ? msgRu : msgEn;
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerText = `> ${text}`;
            container.appendChild(entry);
            if(container.childNodes.length > 3) container.removeChild(container.firstChild);
            setTimeout(() => entry.style.opacity = '0.3', 2000);
        }
    };
    // --- СИСТЕМА ПРИВЯЗКИ ПК ---
    window.generateSyncCode = async function() {
        const tg = window.Telegram.WebApp;
        const userId = String(tg.initDataUnsafe?.user?.id || "test_user");
        
        // 1. Генерируем случайный код из 6 цифр
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        try {
            // 2. Записываем в Firebase: код -> ID пользователя
            // Ставим время жизни кода 5 минут (чтобы не висел вечно)
            await firebase.database().ref('sync_codes/' + code).set({
                userId: userId,
                expires: Date.now() + (5 * 60 * 1000) 
            });

            // 3. Выводим пользователю красивое уведомление
            tg.showPopup({
                title: 'Синхронизация с ПК',
                message: `Ваш код доступа: ${code}\nВведите его в приложении на Windows.\nКод действует 5 минут.`,
                buttons: [{type: 'ok', text: 'Понял'}]
            });
            
            NexusEvent.log("Sync code generated", "Код синхронизации создан");
            tg.HapticFeedback.notificationOccurred('success');

        } catch (e) {
            console.error("Ошибка генерации кода:", e);
            tg.showAlert("Ошибка при создании кода. Попробуйте еще раз.");
        }
    };

    // --- REALTIME CHAT ---
    window.sendMessage = function() {
        const input = document.getElementById('chat-input');
        if(!input || typeof db === 'undefined') return;
        
        const text = input.value.trim();
        if(!text) return;

        const now = Date.now();
        if (now - lastMessageTime < 5000) {
            const secondsLeft = Math.ceil((5000 - (now - lastMessageTime)) / 1000);
            tg.showAlert(`Подождите ${secondsLeft} сек. перед отправкой!`);
            return;
        }

        if (text.length > 100) {
            tg.showAlert("Сообщение слишком длинное!");
            return;
        }

        const msgData = {
            userId: user?.id || 0,
            name: user?.first_name || 'Anon',
            text: text,
            time: now,
            balance: balance
        };

        db.ref('chat').push(msgData);
        input.value = '';
        lastMessageTime = now;
        if(hapticEnabled) tg.HapticFeedback.impactOccurred('light');
    };

    function initChatSync() {
        const onlineRef = db.ref('online_count');
        const myId = (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) 
                     ? window.Telegram.WebApp.initDataUnsafe.user.id.toString() 
                     : 'guest_' + Math.floor(Math.random() * 1000000);

        const myPresence = onlineRef.child(myId);
        myPresence.set(true);
        myPresence.onDisconnect().remove();

        onlineRef.on('value', (snap) => {
            const count = snap.numChildren() || 0;
            const onlineEl = document.getElementById('online-status');
            if (onlineEl) onlineEl.innerText = `ONLINE: ${count}`;
        });

        if(typeof db === 'undefined') return;

        db.ref('chat').limitToLast(20).on('value', (snap) => {
            const container = document.getElementById('chat-messages');
            if(!container) return;
            container.innerHTML = '';
            
            snap.forEach(child => {
                const m = child.val();
                let userRank = RANKS[0].name;
                for (let i = RANKS.length - 1; i >= 0; i--) {
                    if ((m.balance || 0) >= RANKS[i].limit) {
                        userRank = RANKS[i].name;
                        break;
                    }
                }

                container.innerHTML += `
                    <div class="chat-msg" style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="font-size: 9px; color: #ffca28; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${userRank}</span>
                            <span class="author" style="font-weight: bold; color: #ffffff; font-size: 14px;">${m.name}</span>
                        </div>
                        <div class="text" style="display: block; margin-top: 3px; color: #e0e0e0; font-size: 14px;">${m.text}</div>
                    </div>`;
            });
            container.scrollTop = container.scrollHeight;
        });
    }

    const NexusShield = {
        execute: function(moduleName, task) {
            try { return task(); } catch (e) {
                console.error(`🚨 Error in [${moduleName}]:`, e);
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                return null;
            }
        }
    };

    const NexusGuard = { lastClickTime: 0 };

    // --- CORE LOGIC ---
    const Core = {
        modifyBalance: function(amount) {
            NexusShield.execute("Core_Balance", () => {
                balance += amount;
                if (balance < 0) balance = 0;
                let currentMillion = Math.floor(balance / 1000000);
                if(currentMillion > millionMilestone) {
                    millionMilestone = currentMillion;
                    NexusEvent.log(`MILESTONE: ${currentMillion}M N REACHED!`, `ДОСТИЖЕНИЕ: ${currentMillion}М N СОБРАНО!`);
                }
                updateUI();
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
        },
        applyPassive: function() {
            if (upgrades.vpn.lvl > 0) {
                const now = Date.now();
                const diff = Math.floor((now - lastTime) / 1000);
                const earned = diff * (upgrades.vpn.lvl * 2);
                if (earned > 0) {
                    balance += earned;
                    const msg = currentLang === 'RU' ? `VPN намайнил: +${earned.toLocaleString()} N` : `VPN mined: +${earned.toLocaleString()} N`;
                    tg.showAlert(msg);
                    NexusEvent.log(`Passive income: +${earned}`, `Пассивный доход: +${earned}`);
                }
            }
        }
    };

    const langMap = {
    EN: {
        mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
        sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "CHARGE", ready: "READY!",
        buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS", task3: "REACH 100K N", top: "TOP MINERS", buyUSDT: "BUY USDT",
        donateTitle: "DONATE USDT", donateDesc: "SUPPORT PROJECT DEVELOPMENT", copyBtn: "COPY ADDRESS",
        daily: "DAILY REWARD", refTask: "INVITE FRIEND", refCopy: "INVITE", wait: "WAIT",
        go: "GO", check: "CHECK", checking: "WAIT...", notSub: "NOT SUBSCRIBED!", lowBal: "NEED 100K ON BALANCE!",
        chatTitle: "GLOBAL CHAT", chatLabel: "CHAT", chatPlace: "Enter message...", send: "SEND",
        // Новые ключи для ПК
        syncBtn: "SYNC CODE",
        desktopTitle: "DESKTOP PC"
    },
    RU: {
        mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
        sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАРЯД", ready: "ГОТОВО!",
        buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyUSDT: "КУПИТЬ USDT",
        donateTitle: "ПОДДЕРЖКА ПРОЕКТА", donateDesc: "ДОНАТ НА РАЗВИТИЕ NEXUS ENGINE", copyBtn: "КОПИРОВАТЬ АДРЕС",
        daily: "ЕЖЕДНЕВНЫЙ БОНУС", refTask: "ПРИГЛАСИТЬ ДРУГА", refCopy: "ПРИГЛАСИТЬ", wait: "ОЖИДАНИЕ",
        go: "ВЫПОЛНИТЬ", check: "ПРОВЕРИТЬ", checking: "ПРОВЕРКА...", notSub: "ТЫ НЕ ПОДПИСАН!", lowBal: "НУЖНО 100К НА БАЛАНСЕ!",
        chatTitle: "ОБЩИЙ ЧАТ", chatLabel: "ЧАТ", chatPlace: "Ваше сообщение...", send: "ОТПРАВИТЬ",
        // Новые ключи для ПК
        syncBtn: "СИНХРОНИЗАЦИЯ",
        desktopTitle: "КОМПЬЮТЕР"
    }
};

    const RANKS = [
        { name: "ROOKIE", limit: 0 }, { name: "MINER", limit: 10000 }, { name: "PRO MINER", limit: 50000 },
        { name: "CYBER MINER", limit: 250000 }, { name: "NEXUS WHALE", limit: 1000000 }, { name: "LEGEND", limit: 5000000 }
    ];

    function updateRoadmapLanguage(lang) {
        const translations = {
            'RU': {
                'm-roadmap-title': 'ПЛАН РАЗВИТИЯ NEXUS',
                'step1-h': 'ЭТАП 1: ФУНДАМЕНТ',
                'step1-p': 'Запуск движка майнинга, интеграция ASIC Z15 Pro и синхронизация данных.',
                'step2-h': 'ЭТАП 2: ТОКЕНИЗАЦИЯ',
                'step2-p': 'Смарт-контракт TON, рефералы 2.0 и альфа-протокол Smart Mining.',
                'step3-h': 'ЭТАП 3: VPN И УТИЛИТЫ',
                'step3-p': 'Запуск Nexus VPN, оплата в токенах NEX и RWA стейкинг.',
                'step4-h': 'ЭТАП 4: ЭКОСИСТЕМА',
                'step4-p': 'Листинги на биржах, масштабирование DePIN и публичный API.',
                'm-roadmap-close': 'ЗАКРЫТЬ'
            },
            'EN': {
                'm-roadmap-title': 'NEXUS ROADMAP',
                'step1-h': 'PHASE 1: FOUNDATION',
                'step1-p': 'Mining Engine launch, Z15 Pro ASIC integration, and real-time data sync.',
                'step2-h': 'PHASE 2: TOKENIZATION',
                'step2-p': 'TON Smart Contract, Referral 2.0, and Smart Mining Protocol alpha.',
                'step3-h': 'PHASE 3: VPN & UTILITY',
                'step3-p': 'Nexus VPN launch, NEX token payments, and RWA staking.',
                'step4-h': 'PHASE 4: ECOSYSTEM',
                'step4-p': 'DEX/CEX Listings, DePIN scaling, and Public API.',
                'm-roadmap-close': 'CLOSE'
            }
        };
        const t = translations[lang];
        for (let id in t) {
            const el = document.getElementById(id);
            if (el) el.innerText = t[id];
        }
    }

    window.updateUI = function() { 
        updateRank();
        const L = langMap[currentLang];
        const nameBox = document.getElementById('user-name');
        if (nameBox && user) nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;
        
        document.getElementById('nav-mining').querySelector('span').innerText = L.mining;
        document.getElementById('nav-market').querySelector('span').innerText = L.market;
        document.getElementById('nav-tasks').querySelector('span').innerText = L.tasks;
        document.getElementById('nav-chat-label').innerText = L.chatLabel;

        document.getElementById('lbl-energy').innerText = L.energy;
        document.getElementById('lbl-sync').innerText = L.overdrive;
        document.getElementById('m-sys-title').innerText = L.sys;
        document.getElementById('m-market-title').innerText = L.market;
        document.getElementById('m-tasks-title').innerText = L.tasks;
        document.getElementById('m-rank-title').innerText = L.top;
        document.getElementById('m-chat-title').innerText = L.chatTitle;

        document.getElementById('lbl-desktop-title').innerText = langMap[currentLang].desktopTitle;
        document.getElementById('lbl-sync-pc').innerText = langMap[currentLang].syncBtn;
        document.getElementById('lbl-lang').innerText = L.lang;
        document.getElementById('lbl-haptic').innerText = L.haptic;
        document.getElementById('lang-btn').innerText = currentLang;
        document.getElementById('haptic-btn').innerText = hapticEnabled ? "ON" : "OFF";
        
        const chatInput = document.getElementById('chat-input');
        if(chatInput) chatInput.placeholder = L.chatPlace;

        const dTitle = document.getElementById('m-donate-title');
        const dDesc = document.getElementById('m-donate-desc');
        const dCopy = document.getElementById('copy-addr-btn');
        if (dTitle) dTitle.innerText = L.donateTitle;
        if (dDesc) dDesc.innerText = L.donateDesc;
        if (dCopy) dCopy.innerText = L.copyBtn;
        
        document.querySelectorAll('.close-btn-nexus').forEach(b => b.innerText = L.close);
        document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
        document.getElementById('energy-fill').style.width = (energy / 10) + "%";
        document.getElementById('boost-fill').style.width = odCharge + "%";

        const btn = document.getElementById('od-btn');
        if (isOverdrive) btn.innerText = "OVERDRIVE!!";
        else if (odCharge >= 100) btn.innerText = L.ready;
        else btn.innerText = `${L.loading} ${Math.floor(odCharge)}%`;
        btn.className = `sync-btn ${odCharge >= 100 ? 'ready' : ''} ${isOverdrive ? 'active' : ''}`;

        updateRoadmapLanguage(currentLang);
        renderMarket();
        renderTasks();
    };

    function renderMarket() {
        const L = langMap[currentLang];
        const grid = document.getElementById('market-grid');
        const now = Date.now();
        const multStatus = activeBoosts.multEnd > now ? " (ACTIVE)" : "";
        const speedStatus = activeBoosts.speedEnd > now ? " (ACTIVE)" : "";

        const premiumTexts = {
            mult: currentLang === 'RU' ? { title: "МНОЖИТЕЛЬ X2 💎", desc: "ДВОЙНАЯ СИЛА НА 24 ЧАСА" } : { title: "X2 MULTIPLIER 💎", desc: "DOUBLE TAP FOR 24H" },
            speed: currentLang === 'RU' ? { title: "КИБЕР-СКОРОСТЬ ⚡️", desc: "РЕГЕНЕРАЦИЯ X2 НА 24 ЧАСА" } : { title: "CYBER SPEED ⚡️", desc: "X2 REGEN FOR 24H" }
        };

        grid.innerHTML = `
            <div class="card-nexus ${activeBoosts.multEnd > now ? 'boost-active' : ''}">
                <div class="card-info">
                    <span class="card-title">${premiumTexts.mult.title}${multStatus}</span>
                    <span class="card-sub">${premiumTexts.mult.desc}</span>
                    <span class="card-price">1.0 TON</span>
                </div>
                <button class="nexus-btn-buy" onclick="buyWithUSDT('mult', 1)">${L.buyUSDT}</button>
            </div>
            <div class="card-nexus ${activeBoosts.speedEnd > now ? 'boost-active' : ''}">
                <div class="card-info">
                    <span class="card-title">${premiumTexts.speed.title}${speedStatus}</span>
                    <span class="card-sub">${premiumTexts.speed.desc}</span>
                    <span class="card-price">2.0 TON</span>
                </div>
                <button class="nexus-btn-buy" onclick="buyWithUSDT('speed', 2)">${L.buyUSDT}</button>
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
            </div>`;
    }

    window.buyWithUSDT = async function(type, price) {
        if (typeof tonConnectUI === 'undefined' || !tonConnectUI.account) {
            tg.showPopup({ message: currentLang === 'RU' ? 'Сначала подключите кошелек!' : 'Please connect your wallet first!' });
            return;
        }
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: "UQB1fAh0XZ3paTUwJl8poaDG2H0cad4vJfy3bXdnyU5ZVIU3",
                amount: (price * 1000000000).toString(), 
            }]
        };
        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            if (result) {
                const dayInMs = 24 * 60 * 60 * 1000;
                const now = Date.now();
                if(type === 'mult') activeBoosts.multEnd = Math.max(activeBoosts.multEnd, now) + dayInMs;
                if(type === 'speed') activeBoosts.speedEnd = Math.max(activeBoosts.speedEnd, now) + dayInMs;
                NexusEvent.log("PREMIUM ACTIVATE!", "ПРЕМИУМ АКТИВИРОВАН!");
                saveData(); updateUI();
            }
        } catch (e) { console.error("Payment error:", e); }
    };

    // --- ТАЧ-ЛОГИКА ---
    const touchZone = document.getElementById('touch-zone');
    if (touchZone) {
        touchZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (energy < 2) return;
            NexusGuard.lastClickTime = Date.now();
            const coin = document.getElementById('coin-visual');
            if(coin) coin.classList.add('pressed');
            const now = Date.now();
            const currentMult = (activeBoosts.multEnd > now) ? 2 : 1;
            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
                let pwr = (upgrades.node.lvl * currentMult) * (isOverdrive ? 5 : 1);
                if (Math.random() < 0.01) pwr *= 10;
                
                Core.modifyBalance(pwr); 
                Core.consumeEnergy(2);
                
                accumulatedClicks += pwr;

                if (!isOverdrive && odCharge < 100) odCharge += 0.4;
                createPop(t.clientX, t.clientY, pwr, pwr > upgrades.node.lvl * 2);
                spawnParticles(t.clientX, t.clientY);
            }
            if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
        }, {passive: false});
        touchZone.addEventListener('touchend', () => {
            document.getElementById('coin-visual')?.classList.remove('pressed');
        });
    }

    // --- ЗАДАНИЯ ---
    function renderTasks() {
        const L = langMap[currentLang];
        const grid = document.getElementById('tasks-grid');
        if (!grid) return;
        const now = Date.now();
        const canClaimDaily = (now - lastDailyClaim) > 86400000;
        const dailyReward = [1000, 2500, 5000, 10000, 25000, 50000, 100000][dailyStreak % 7];

        grid.innerHTML = `
            <div class="card-nexus" style="border-color: #ffcc00;">
                <div class="card-info">
                    <span class="card-title">${L.daily} (Day ${dailyStreak + 1})</span>
                    <span class="card-sub">+${dailyReward.toLocaleString()} N</span>
                </div>
                <button class="nexus-btn-buy" ${!canClaimDaily ? 'disabled' : ''} onclick="claimDaily()">${canClaimDaily ? L.claim : L.wait}</button>
            </div>
            <div class="card-nexus" style="border-color: #00d4ff;">
                <div class="card-info">
                    <span class="card-title">${L.refTask}</span>
                    <span class="card-sub">+5,000 N EACH</span> </div>
                <button class="nexus-btn-buy" onclick="copyRefLink()">${L.refCopy}</button>
            </div>`;

        const tasks = [
            { id: 'sub1', title: L.task1, reward: 5000, url: 'https://t.me/nexus_protocol' },
            { id: 'invite', title: currentLang === 'RU' ? "СЕТЬ МАЙНЕРОВ (5 чел)" : "MINING NETWORK (5 ppl)", reward: 15000, url: 'auto' }, 
            { id: 'reach100k', title: L.task3, reward: 25000, url: '' }
        ];

        tasks.forEach(task => {
            const isDone = tasksDone.includes(task.id);
            let actionButtons = '';
            if (isDone) {
                actionButtons = `<button class="nexus-btn-buy" disabled>${L.claimed}</button>`;
            } else if (task.id === 'invite') {
                actionButtons = `<button class="nexus-btn-buy" onclick="startAutoInviteTask()">${L.refCopy}</button>`;
            } else {
                actionButtons = `
                    <button class="nexus-btn-buy" onclick="completeTask('${task.id}', ${task.reward}, '${task.url}')">${L.go}</button>
                    <button class="nexus-btn-buy" style="background:#26a17b" id="check-${task.id}" onclick="verifyTask('${task.id}', ${task.reward})">${L.check}</button>`;
            }

            grid.innerHTML += `<div class="card-nexus">
                <div class="card-info">
                    <span class="card-title">${task.title}</span>
                    <span class="card-sub">+${task.reward.toLocaleString()} N</span>
                </div>
                <div style="display:flex; gap:5px;">${actionButtons}</div>
            </div>`;
        });
    }

    window.startAutoInviteTask = function() {
        copyRefLink();
        const msg = currentLang === 'RU' ? "Ссылка скопирована!" : "Link copied!";
        tg.showAlert(msg);
        
        if (typeof db !== 'undefined' && user?.id) {
            const checkRef = setInterval(() => {
                if (tasksDone.includes('invite')) { clearInterval(checkRef); return; }
                db.ref('users/' + user.id + '/referrals_count').once('value', (snap) => {
                    const count = snap.val() || 0;
                    if (count >= 5) { grantReward('invite', 15000); clearInterval(checkRef); }
                });
            }, 10000);
        }
    };

    window.verifyTask = async function(id, reward) {
        const L = langMap[currentLang];
        const btn = document.getElementById(`check-${id}`);
        if(btn) { btn.disabled = true; btn.innerText = L.checking; }

        if (id === 'reach100k') {
            if (balance >= 100000) grantReward(id, reward);
            else { tg.showAlert(L.lowBal); if(btn){btn.disabled=false; btn.innerText=L.check;} }
            return;
        }

        const startTime = taskTimers[id];
        if (!startTime) { tg.showAlert(L.go + " first!"); if(btn){btn.disabled=false; btn.innerText=L.check;} return; }
        if (Date.now() - startTime < 15000) { tg.showAlert(L.wait); if(btn){btn.disabled=false; btn.innerText=L.check;} return; }

        try {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${user.id}`);
            const data = await res.json();
            if (data.ok && ['member', 'administrator', 'creator'].includes(data.result.status)) {
                grantReward(id, reward);
            } else {
                tg.showAlert(L.notSub); if(btn){btn.disabled=false; btn.innerText=L.check;}
            }
        } catch (e) { tg.showAlert("API Error"); if(btn){btn.disabled=false; btn.innerText=L.check;} }
    };

   function grantReward(id, reward) {
    if (!tasksDone.includes(id)) {
        tasksDone.push(id);
        
        if (typeof db !== 'undefined' && user?.id) {
            db.ref('users/' + user.id).transaction((currentData) => {
                if (currentData) {
                    // Прибавляем награду к актуальному балансу в базе
                    currentData.balance = Math.floor((currentData.balance || 0) + reward);
                    balance = currentData.balance; // Обновляем локально
                }
                return currentData;
            }, (error, committed) => {
                // Вызываем обновление экрана ТОЛЬКО после того, как база приняла данные
                if (committed) {
                    updateUI();
                    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
                    tg.showAlert(`+${reward.toLocaleString()} N!`);
                }
            });
        } else {
            // Если Firebase недоступен (редкий случай)
            balance += reward;
            saveData(); // В этом случае сохраняем в localStorage
            updateUI();
            tg.showAlert(`+${reward.toLocaleString()} N!`);
        }
    }
}

    window.claimDaily = function() {
    const now = Date.now();
    if (now - lastDailyClaim < 86400000) return;
    
    const reward = [1000, 2500, 5000, 10000, 25000, 50000, 100000][dailyStreak % 7];
    
    if (typeof db !== 'undefined' && user?.id) {
        db.ref('users/' + user.id).transaction((currentData) => {
            if (currentData) {
                currentData.balance = (currentData.balance || 0) + reward;
                balance = currentData.balance;
            }
            return currentData;
        });
    } else {
        balance += reward;
    }

    lastDailyClaim = now; 
    dailyStreak++;
    saveData(); 
    updateUI(); 
    tg.showAlert(`+${reward.toLocaleString()} N!`);
};

    window.completeTask = function(id, reward, url) {
        if (!tasksDone.includes(id)) {
            if (url && url !== '' && url !== 'auto') {
                if (url.includes('t.me')) tg.openTelegramLink(url);
                else window.open(url, '_blank');
            }
            taskTimers[id] = Date.now();
            tg.showAlert(currentLang === 'RU' ? "Задание начато! Ожидание 15с." : "Started! Wait 15s.");
        }
    };

    window.copyRefLink = function() {
        const link = `https://t.me/nexus_protocol_bot/app?startapp=${user?.id || '0'}`;
        const text = currentLang === 'RU' ? "Присоединяйся к Nexus Mining Engine! 🚀" : "Join Nexus Mining Engine! 🚀";
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
        tg.openTelegramLink(shareUrl);
    };

    window.openVpnApp = function() {
    const webapp = window.Telegram.WebApp;
    const currentUser = webapp.initDataUnsafe?.user;

    if (currentUser && currentUser.id) {
        webapp.HapticFeedback.impactOccurred('medium');
        
        const userId = String(currentUser.id);
        const userName = encodeURIComponent(currentUser.first_name || "User");
        
        // 1. Ссылка для открытия ПРИЛОЖЕНИЯ (Deep Link)
        // Она передаст ID прямо в твой Kotlin-код
        const appUrl = `nexflow://open?TG_USER_ID=${userId}`;
        
        // 2. Ссылка для открытия САЙТА (Запасная)
        const webUrl = `https://nexus-app-6769e.web.app/vpn?id=${userId}&user=${userName}`;
        
        // Сначала пробуем открыть приложение через кастомную схему
        webapp.openLink(appUrl);

        // Если через 500мс приложение не открылось (его нет), откроется сайт
        setTimeout(() => {
            webapp.openLink(webUrl);
        }, 500);

    } else {
        webapp.showAlert("Ошибка: ID не найден.");
    }
};

    window.buyItem = function(type) {
        let u = upgrades[type];
        if (balance >= u.cost) {
            balance -= u.cost; 
            u.lvl++; 
            if (type === 'node') u.cost = Math.floor(u.cost * 2.0);
            else if (type === 'vpn') u.cost = Math.floor(u.cost * 3.5);
            NexusEvent.log(`${type.toUpperCase()} Upgraded`, `${type.toUpperCase()} Улучшен`);
            saveData(); updateUI();
        } else { 
            tg.showAlert(currentLang === 'RU' ? "Недостаточно N!" : "Not enough N!"); 
        }
    };

window.saveData = function() {
    // 1. Локальное сохранение
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
    localStorage.setItem('nexus_last_time', Date.now());
    localStorage.setItem('nexus_energy', energy);

    // 2. Firebase Транзакция
    if (typeof db !== 'undefined' && user?.id) {
        db.ref('users/' + user.id).transaction((currentData) => {
            // Если в базе пусто (НОВЫЙ ЮЗЕР), создаем ему профиль
            if (currentData === null) {
                return {
                    balance: Math.floor(balance),
                    name: user.first_name || "Explorer",
                    v: GAME_VERSION,
                    id: user.id,
                    last_seen: firebase.database.ServerValue.TIMESTAMP
                };
            }

            // Если данные есть, синхронизируем баланс с тем, что могло прийти из Android
            if (currentData.balance > balance) {
                balance = currentData.balance;
            }
            
            currentData.balance = Math.floor(balance);
            currentData.name = user.first_name || currentData.name;
            currentData.v = GAME_VERSION;
            
            return currentData;
        }, (error, committed, snapshot) => {
            if (committed) {
                updateUI();
            }
        });
    }
};
    window.loadLeaderboard = function() {
        if (typeof db === 'undefined') return;
        const container = document.getElementById('leaderboard-list');
        if (!container) return;
        container.innerHTML = "SYNCING...";
        db.ref('users').orderByChild('balance').limitToLast(50).once('value', (snap) => {
            const players = []; snap.forEach((child) => { players.push(child.val()); });
            players.reverse(); renderLeaderboard(players);
        });
    };

    function renderLeaderboard(players) {
        const container = document.getElementById('leaderboard-list');
        if (!container) return; container.innerHTML = "";
        players.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'card-nexus';
            div.style.marginBottom = "5px";
            div.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <span style="color:#00f2ff; font-weight:bold;">#${i+1}</span>
                <span style="flex-grow:1; margin-left:10px;">${(p.name || 'ANON').toUpperCase()}</span>
                <span style="font-weight:bold;">${Math.floor(p.balance).toLocaleString()} N</span>
            </div>`;
            container.appendChild(div);
        });
    }

    window.toggleModal = function(id) {
        const m = document.getElementById(id);
        if(m) {
            m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
            if (id === 'rank-modal' && m.style.display === 'flex') loadLeaderboard();
            if (id === 'chat-modal' && m.style.display === 'flex') {
                setTimeout(() => {
                    const c = document.getElementById('chat-messages');
                    if(c) c.scrollTop = c.scrollHeight;
                }, 100);
            }
        }
    };

    window.changeLanguage = function() { 
        currentLang = currentLang === 'EN' ? 'RU' : 'EN'; 
        localStorage.setItem('nx_lang', currentLang); 
        updateUI(); 
    };
    
    window.toggleHaptic = function() { hapticEnabled = !hapticEnabled; localStorage.setItem('nx_haptic', hapticEnabled?'on':'off'); updateUI(); };
    
    function createPop(x, y, v, isCrit) {
        const p = document.createElement('div'); p.className = 'floating-text';
        p.innerText = isCrit ? '+' + v + ' 🔥' : '+' + v;
        p.style.left = x + 'px'; p.style.top = y + 'px';
        document.body.appendChild(p); setTimeout(() => p.remove(), 600);
    }

    function spawnParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            const p = document.createElement('div'); p.className = 'particle';
            p.style.left = x + 'px'; p.style.top = y + 'px';
            const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 40;
            p.animate([{ opacity: 1 }, { transform: `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px) scale(0)`, opacity: 0 }], 500);
            document.body.appendChild(p); setTimeout(() => p.remove(), 500);
        }
    }

    window.activateOverdrive = function() {
        if (odCharge >= 100 && !isOverdrive) {
            isOverdrive = true;
            NexusEvent.log("OVERDRIVE!", "ОВЕРДРАЙВ!");
            let drain = setInterval(() => {
                odCharge -= 2;
                if (odCharge <= 0) { odCharge = 0; isOverdrive = false; clearInterval(drain); }
                updateUI();
            }, 100);
        }
    };

    function updateRank() {
        let rankIndex = 0;
        let rankName = RANKS[0].name;
        for (let i = RANKS.length-1; i>=0; i--) { 
            if(balance >= RANKS[i].limit) { rankName = RANKS[i].name; rankIndex = i; break; } 
        }
        if(rankIndex > lastRankIndex && lastRankIndex !== -1) NexusEvent.log(`New Rank: ${rankName}!`, `Новый ранг: ${rankName}!`);
        lastRankIndex = rankIndex;
        const rb = document.getElementById('rank-badge'); 
        if(rb) rb.innerText = `RANK: ${rankName}`;
        const coin = document.getElementById('coin-visual');
        if (coin) {
            const isPressed = coin.classList.contains('pressed');
            coin.className = 'nexus-button'; 
            coin.classList.add(`rank-${rankIndex}`); 
            if (isPressed) coin.classList.add('pressed');
        }
    }

    // --- MAIN LOOP ---
    setInterval(() => {
        let currentIncome = (upgrades.vpn.lvl * 2) / 10;
        if (tasksDone.includes('invite')) currentIncome *= 1.5;
        balance += currentIncome;
        const now = Date.now();
        const regenStep = (activeBoosts.speedEnd > now) ? 1.5 : 0.5;
        if (energy < 1000) energy = Math.min(1000, energy + regenStep);
        if (!isOverdrive && odCharge > 0 && (now - NexusGuard.lastClickTime > 2000)) {
            odCharge = Math.max(0, odCharge - 0.3);
        }
        updateUI();
    }, 100);

   // --- СЕКЦИЯ СОХРАНЕНИЯ (ВСТАВИТЬ В КОНЕЦ ФАЙЛА) ---

    // 1. Быстрое сохранение каждые 5 секунд
 // ... твой код с объявлением переменных ...

    document.addEventListener('DOMContentLoaded', () => { 
        if(isWasReset) tg.showAlert("NEXUS: Система обновлена!");

        // --- ДОБАВЬ ЭТОТ БЛОК ТУТ ---
        if (user?.id) {
            db.ref('users/' + user.id + '/balance').on('value', (snapshot) => {
                const newBalance = snapshot.val();
                if (newBalance !== null) {
                    // Если в базе число больше (намайнил VPN), обновляем сайт
                    if (newBalance > balance) {
                        balance = newBalance;
                        updateUI(); 
                    }
                }
            });
        }
        // ----------------------------

        // 1. Быстрое сохранение каждые 5 секунд
        setInterval(() => {
            saveData(); 
        }, 5000); 

        // 2. Сохранение при сворачивании (для Telegram)
        tg.onEvent('viewportChanged', (isStateChanged) => {
            if (isStateChanged) saveData();
        });

        // 3. Сохранение перед закрытием вкладки
        window.addEventListener('beforeunload', () => {
            saveData();
        });

        // 4. Подтягиваем данные из базы через секунду после старта
        setTimeout(saveData, 1000);

        const sp = tg.initDataUnsafe?.start_param;
        if (sp && !refClaimed) {
            refClaimed = true;
            localStorage.setItem('nexus_ref_claimed', 'true');
            
            if (typeof db !== 'undefined' && user?.id) {
                db.ref('users/' + user.id).transaction((currentData) => {
                    if (currentData) {
                        currentData.balance = (currentData.balance || 0) + 5000;
                        balance = currentData.balance;
                    }
                    return currentData;
                });
            }
            tg.showAlert("+5,000 N!");
        }

        Core.applyPassive(); 
        initChatSync(); 
        
        // syncWithServer(); <--- ЭТУ СТРОКУ Я УДАЛИЛ, ОНА БОЛЬШЕ НЕ НУЖНА
        
        updateUI(); 
        NexusEvent.log("System Online.", "Система онлайн.");
    });

})();
