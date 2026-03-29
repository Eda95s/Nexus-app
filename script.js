/**
 * NEXFLOW VPN & MINING ENGINE - FULL MONOLITHIC CORE
 * Version: 2.2.0_FIREBASE_ONLY
 */

// 1. Глобальная функция удаления сообщений (вне замыкания)
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

    // ==========================================
    // 1. ПЕРЕМЕННЫЕ СОСТОЯНИЯ (Глобальный доступ)
    // ==========================================
    const GAME_VERSION = "2.2.0_FIREBASE_ONLY"; 
    const BOT_TOKEN = "7544093954:AAH3H38R-o6v5rK6eHjK_X-Yy3vWk7E8K4o";
    const CHANNEL_ID = "-1002086386401";
    const API_URL = "https://your-api-server.com"; 

    // Используем window, чтобы нижние части скрипта видели актуальные данные
    window.balance = parseFloat(localStorage.getItem('nexus_bal')) || 0;
    window.energy = parseInt(localStorage.getItem('nexus_energy')) || 1000;
    window.upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
        node: { lvl: 1, cost: 45000, power: 1 },
        vpn: { lvl: 0, cost: 50000, income: 1 }
    };

    let accumulatedClicks = 0; 
    let odCharge = 0;
    let isOverdrive = false;
    let currentLang = localStorage.getItem('nx_lang') || 'EN';
    let hapticEnabled = localStorage.getItem('nx_haptic') !== 'off';

    // ==========================================
    // 2. ФУНКЦИИ ЯДРА (СИНХРОНИЗАЦИЯ)
    // ==========================================

    function syncUserWithDb() {
        if (!user || !user.id) return;
        console.log("🔄 Синхронизация с профилем: " + user.id);
        
        const myId = user.id.toString();
        const fullName = (user.first_name + (user.last_name ? " " + user.last_name : "")).trim() || "Miner";
        const userRef = db.ref('users/' + myId);
        const now = Date.now(); 

        userRef.once('value', (snapshot) => {
            const data = snapshot.val();
            
            if (!data) {
                // НОВЫЙ ПОЛЬЗОВАТЕЛЬ
                userRef.set({
                    username: fullName,
                    name: fullName,
                    balance: window.balance,
                    energy: window.energy,
                    maxEnergy: 1000, 
                    lastLogin: now,
                    v: GAME_VERSION,
                    upgrades: window.upgrades
                });
            } else {
                // СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ (Приоритет данным из БД)
                const lastLogin = data.lastLogin || now;
                const secondsPassed = Math.floor((now - lastLogin) / 1000);
                const recoveryRate = 1; 
                
                const maxEnergyInDb = data.maxEnergy || 1000;
                const newEnergy = Math.min(maxEnergyInDb, (data.energy || 0) + (secondsPassed * recoveryRate));

                // Обновляем глобальные переменные
                window.balance = data.balance || 0; 
                window.energy = newEnergy;
                if (data.upgrades) window.upgrades = data.upgrades;

                // Сохраняем актуальное состояние в БД
                userRef.update({
                    username: fullName,
                    energy: newEnergy, 
                    lastLogin: now,    
                    v: GAME_VERSION
                });

                // Безопасный вызов отрисовки интерфейса
                if (typeof window.updateUI === 'function') {
                    window.updateUI();
                }
            }
            localStorage.setItem('nexus_user_name', fullName);
        });
    }

    function checkFirebase() {
        const connectedRef = db.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) console.log("✅ СВЯЗЬ С FIREBASE УСТАНОВЛЕНА");
            else console.error("❌ ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ");
        });
    }

    // ==========================================
    // 3. ЗАПУСК ЧЕРЕЗ АВТОРИЗАЦИЮ
    // ==========================================
    
    if (typeof firebase.auth === 'function') {
        firebase.auth().signInAnonymously()
            .then(() => {
                console.log("✅ Firebase Auth: Успешно");
                checkFirebase();
                syncUserWithDb(); 
                
                // Инициализация дополнительных модулей, если они есть
                if (typeof window.loadChat === 'function') window.loadChat();
                if (typeof window.loadLeaderboard === 'function') window.loadLeaderboard();
            })
            .catch((error) => {
                console.error("❌ Firebase Auth Error:", error.message);
                syncUserWithDb(); 
            });
    } else {
        console.error("❌ Модуль Firebase Auth не найден!");
        syncUserWithDb();
    }

    // ==========================================
    // 4. СИСТЕМНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    if (localStorage.getItem('nexus_version') !== GAME_VERSION) {
        localStorage.clear();
        localStorage.setItem('nexus_version', GAME_VERSION);
    }

    let lastTime = parseInt(localStorage.getItem('nexus_last_time')) || Date.now();
    let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
    let lastDailyClaim = parseInt(localStorage.getItem('nexus_daily')) || 0;
    let dailyStreak = parseInt(localStorage.getItem('nexus_streak')) || 0;
    let refClaimed = localStorage.getItem('nexus_ref_claimed') === 'true';
    let lastRankIndex = -1; 
    let millionMilestone = Math.floor(window.balance / 1000000);
    let taskTimers = {};
    let lastMessageTime = 0; 
    const userId = user?.id || "unknown";

    // --- ФУНКЦИЯ СИНХРОНИЗАЦИИ ---
    async function syncWithServer() {
        const currentUser = window.Telegram?.WebApp?.initDataUnsafe?.user || { id: "test_user", first_name: "LocalTest" };
        
        if (accumulatedClicks > 0) {
            console.log("Отправка кликов на сервер:", accumulatedClicks);
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
                    balance = data.balance;
                    accumulatedClicks = 0;
                    updateUI();
                } else {
                    console.error("Сервер ответил ошибкой:", response.status);
                }
            } catch (e) {
                console.error("Ошибка сети:", e);
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

    // --- REALTIME CHAT ---
   window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    if(!input || typeof db === 'undefined') return;
    
    const text = input.value.trim();
    if(!text) return;

    const now = Date.now();
    // Проверка lastMessageTime (убедись, что она объявлена в начале script.js как let lastMessageTime = 0)
    if (typeof lastMessageTime !== 'undefined' && now - lastMessageTime < 5000) {
        const secondsLeft = Math.ceil((5000 - (now - lastMessageTime)) / 1000);
        tg.showAlert(`Подождите ${secondsLeft} сек. перед отправкой!`);
        return;
    }

    if (text.length > 100) {
        tg.showAlert("Сообщение слишком длинное!");
        return;
    }

    // --- НАДЕЖНОЕ ПОЛУЧЕНИЕ ДАННЫХ ЮЗЕРА ---
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    const msgData = {
        userId: tgUser ? tgUser.id : 0,
        // Берем имя из ТГ, если нет — из памяти, если нет — Anon
        name: tgUser ? (tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "")) : (localStorage.getItem('nexus_user_name') || 'Anon'),
        text: text,
        time: now,
        // Убедись, что переменная balance доступна здесь
        balance: typeof balance !== 'undefined' ? balance : 0
    };

    db.ref('chat').push(msgData);
    
    input.value = '';
    lastMessageTime = now;
    
    if(typeof hapticEnabled !== 'undefined' && hapticEnabled) {
        tg.HapticFeedback.impactOccurred('light');
    }
};

    function initChatSync() {
    if (typeof db === 'undefined') return; // Переместил проверку наверх для безопасности

    const onlineRef = db.ref('online_count');
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user; // Берем данные юзера
    const myId = tgUser 
                 ? tgUser.id.toString() 
                 : 'guest_' + Math.floor(Math.random() * 1000000);

    // --- БЛОК ОБНОВЛЕНИЯ ИМЕНИ (ИЗБАВЛЯЕМСЯ ОТ ВАСИ) ---
    if (tgUser) {
        const fullName = tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "");
        
        // 1. Обновляем в локальной памяти браузера
        localStorage.setItem('nexus_user_name', fullName);
        
        // 2. Обновляем в глобальной переменной (если она есть в script.js)
        if (typeof userName !== 'undefined') userName = fullName;

        // 3. Обновляем в базе данных Firebase
        db.ref('users/' + myId).update({
            username: fullName
        });
    }
    // ---------------------------------------------------

    const myPresence = onlineRef.child(myId);
    myPresence.set(true);
    myPresence.onDisconnect().remove();

    onlineRef.on('value', (snap) => {
        const count = snap.numChildren() || 0;
        const onlineEl = document.getElementById('online-status');
        if (onlineEl) onlineEl.innerText = `ONLINE: ${count}`;
    });

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
            // ... тут твой остальной код отрисовки сообщений ...
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
            // Добавляем проверку, чтобы скрипт не падал, если апгрейдов еще нет
            if (upgrades && upgrades.vpn && upgrades.vpn.lvl > 0) {
                const now = Date.now();
                // Защита от NaN для lastTime
                const last = lastTime || now; 
                const diff = Math.floor((now - last) / 1000);
                
                // Считаем доход
                const earned = diff * (upgrades.vpn.lvl * 2);
                
                if (earned > 0) {
                    balance += earned;
                    const msg = currentLang === 'RU' ? 
                        `VPN намайнил: +${earned.toLocaleString()} N` : 
                        `VPN mined: +${earned.toLocaleString()} N`;
                    
                    tg.showAlert(msg);
                    NexusEvent.log(`Passive income: +${earned}`, `Пассивный доход: +${earned}`);
                    
                    // После начисления обновляем UI и сохраняем
                    updateUI();
                }
            } else {
                // Если у новичка еще нет уровней в базе, ставим хотя бы 0, чтобы не было ошибки
                console.log("Майнинг пока не активен: уровень VPN 0 или не загружен");
          }
        } // ЗАКРЫЛИ ФУНКЦИЮ
    }; // ЗАКРЫЛИ ОБЪЕКТ Core (ЭТОЙ СКОБКИ У ТЕБЯ НЕ ХВАТАЛО)

    const langMap = {
        EN: {
            mining: "MINING", market: "MARKET", tasks: "TASKS", energy: "ENERGY", overdrive: "OVERDRIVE", 
            sys: "SYSTEM", lang: "LANG", haptic: "HAPTIC", close: "CLOSE", loading: "CHARGE", ready: "READY!",
            buy: "UPGRADE", cost: "COST", lvl: "LVL", power: "TAP POWER", inc: "INCOME", claim: "CLAIM", claimed: "DONE",
            task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS", task3: "REACH 100K N", top: "TOP MINERS", buyUSDT: "BUY USDT",
            donateTitle: "DONATE USDT", donateDesc: "SUPPORT PROJECT DEVELOPMENT", copyBtn: "COPY ADDRESS",
            daily: "DAILY REWARD", refTask: "INVITE FRIEND", refCopy: "INVITE", wait: "WAIT",
            go: "GO", check: "CHECK", checking: "WAIT...", notSub: "NOT SUBSCRIBED!", lowBal: "NEED 100K ON BALANCE!",
            chatTitle: "GLOBAL CHAT", chatLabel: "CHAT", chatPlace: "Enter message...", send: "SEND"
        },
        RU: {
            mining: "МАЙНИНГ", market: "МАГАЗИН", tasks: "ЗАДАНИЯ", energy: "ЭНЕРГИЯ", overdrive: "БУСТ", 
            sys: "СИСТЕМА", lang: "ЯЗЫК", haptic: "ВИБРО", close: "ЗАКРЫТЬ", loading: "ЗАРЯД", ready: "ГОТОВО!",
            buy: "УЛУЧШИТЬ", cost: "ЦЕНА", lvl: "УР", power: "СИЛА КЛИКА", inc: "ДОХОД", claim: "ЗАБРАТЬ", claimed: "ГОТОВО",
            task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ", task3: "ДОСТИГНИ 100К N", top: "ЛИДЕРЫ", buyUSDT: "КУПИТЬ USDT",
            donateTitle: "ПОДДЕРЖКА ПРОЕКТА", donateDesc: "ДОНАТ НА РАЗВИТИЕ NEXUS ENGINE", copyBtn: "КОПИРОВАТЬ АДРЕС",
            daily: "ЕЖЕДНЕВНЫЙ БОНУС", refTask: "ПРИГЛАСИТЬ ДРУГА", refCopy: "ПРИГЛАСИТЬ", wait: "ОЖИДАНИЕ",
            go: "ВЫПОЛНИТЬ", check: "ПРОВЕРИТЬ", checking: "ПРОВЕРКА...", notSub: "ТЫ НЕ ПОДПИСАН!", lowBal: "НУЖНО 100К НА БАЛАНСЕ!",
            chatTitle: "ОБЩИЙ ЧАТ", chatLabel: "ЧАТ", chatPlace: "Ваше сообщение...", send: "ОТПРАВИТЬ"
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
        if (nameBox) {
            // Собираем полное имя из Telegram
            const fullName = user?.first_name 
                ? (user.first_name + (user.last_name ? " " + user.last_name : "")) 
                : (localStorage.getItem('nexus_user_name') || 'MINER');
            
            nameBox.innerText = `NEX | ${fullName.toUpperCase()}`;
        }
        
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
   // --- УНИВЕРСАЛЬНАЯ ТАЧ/МЫШЬ ЛОГИКА ---
const touchZone = document.getElementById('touch-zone');
if (touchZone) {
    // Выносим общую функцию клика, чтобы не дублировать код
    const handleMining = (e) => {
        // Проверяем: если это тач, берем массив пальцев, если мышь - создаем массив из одного события
        const points = e.changedTouches ? e.changedTouches : [e];
        
        if (energy < 2) return;

        NexusGuard.lastClickTime = Date.now();
        const coin = document.getElementById('coin-visual');
        if(coin) coin.classList.add('pressed');

        const now = Date.now();
        const currentMult = (activeBoosts.multEnd > now) ? 2 : 1;

        for (let i = 0; i < points.length; i++) {
            let t = points[i];
        // Проверяем множитель Alpha-Node (если его нет в системе, будет 1)
        const alphaMult = window.userMultiplier || 1; 

        // Умножаем финальную силу клика на этот множитель
        let pwr = (upgrades.node.lvl * currentMult * (isOverdrive ? 5 : 1)) * alphaMult;
            
            // Шанс на крит
            if (Math.random() < 0.01) pwr *= 10;
            
            Core.modifyBalance(pwr); 
            Core.consumeEnergy(2);
            accumulatedClicks += pwr;

            if (!isOverdrive && odCharge < 100) odCharge += 0.4;
            
            // Координаты (clientX/Y работают и для мыши, и для тача)
            createPop(t.clientX, t.clientY, pwr, pwr > upgrades.node.lvl * 2);
            spawnParticles(t.clientX, t.clientY);
        }

        if (hapticEnabled) tg.HapticFeedback.impactOccurred('medium');
    };
// Переменная-флаг, чтобы отличать тач от мыши
    let isTouch = false;

    // Слушаем смартфоны
    touchZone.addEventListener('touchstart', (e) => {
        isTouch = true; // Фиксируем, что это тач
        e.preventDefault(); // Блокируем стандартное поведение (зум/скролл)
        handleMining(e);
    }, {passive: false});

    // Слушаем ПК (Мышь)
    touchZone.addEventListener('mousedown', (e) => {
        // Если это был тач (isTouch === true), игнорируем mousedown
        if (isTouch) {
            isTouch = false; // Сбрасываем для следующего раза
            return;
        }
        // Срабатывает только на левую кнопку мыши
        if (e.button === 0) handleMining(e);
    });

    // Убираем эффект нажатия (для всех)
    const releaseCoin = () => document.getElementById('coin-visual')?.classList.remove('pressed');
    touchZone.addEventListener('touchend', releaseCoin);
    window.addEventListener('mouseup', releaseCoin);
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
    
    // Если задание уже выполнено, ничего не делаем
    if (tasksDone.includes('invite')) return;

    if (typeof db !== 'undefined' && user?.id) {
        // Проверяем количество рефералов разово при нажатии
        db.ref('users/' + user.id + '/referrals_count').once('value', (snap) => {
            const count = snap.val() || 0;
            if (count >= 5) { 
                grantReward('invite', 15000); 
                tg.showAlert(currentLang === 'RU' ? "Задание выполнено! +15,000 N" : "Task completed! +15,000 N");
            } else {
                // Если рефералов мало, просто напоминаем условие
                const left = 5 - count;
                tg.showConfirm(currentLang === 'RU' 
                    ? `Нужно еще ${left} рефералов для награды. Проверить еще раз?` 
                    : `Need ${left} more referrals for reward. Check again?`, (ok) => {
                        if (ok) startAutoInviteTask(); // Повторная проверка по желанию юзера
                    });
            }
        });
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
    // Берем данные напрямую из Telegram WebApp в момент клика
    const currentUser = webapp.initDataUnsafe?.user;

    // Проверяем, что ID реально существует и это число/строка
    if (currentUser && currentUser.id) {
        webapp.HapticFeedback.impactOccurred('medium');
        
        const userId = String(currentUser.id);
        const userName = encodeURIComponent(currentUser.first_name || "User");
        
        // Формируем ссылку
        // Исправленная ссылка (теперь Android её узнает)
const url = `https://nexus-app-6769e.web.app/vpn?id=${userId}&user=${userName}`;
        
        // Открываем ссылку через официальный метод Telegram
        webapp.openLink(url);
    } else {
        // Если данных нет, выводим ошибку, чтобы понять, что пошло не так
        webapp.showAlert("Ошибка: Telegram не передал ваш ID. Попробуйте перезагрузить бота.");
    }
};

    window.buyItem = function(type) {
    if (!user || !user.id) return;
    let u = upgrades[type];
    
    // Предварительная проверка на телефоне (чтобы не спамить запросами)
    if (balance < u.cost) {
        tg.showAlert(currentLang === 'RU' ? "Недостаточно N!" : "Not enough N!");
        return;
    }

    // БЕЗОПАСНАЯ ПОКУПКА ЧЕРЕЗ СЕРВЕР
    db.ref('users/' + user.id).transaction((currentData) => {
        if (currentData) {
            const cost = u.cost;
            // Проверяем реальный баланс в базе
            if ((currentData.balance || 0) >= cost) {
                // 1. Списываем монеты
                currentData.balance -= cost;
                
                // 2. Увеличиваем уровень строго на +1 (как прописано в Rules)
                if (!currentData.upgrades) currentData.upgrades = {};
                if (!currentData.upgrades[type]) currentData.upgrades[type] = { lvl: 0 };
                
                currentData.upgrades[type].lvl += 1;
                
                // 3. Обновляем локальные переменные в самом приложении
                balance = currentData.balance;
                upgrades[type].lvl = currentData.upgrades[type].lvl;
                
                // 4. Пересчитываем стоимость для следующего раза
                if (type === 'node') upgrades[type].cost = Math.floor(upgrades[type].cost * 2.0);
                else upgrades[type].cost = Math.floor(upgrades[type].cost * 3.5);
            } else {
                // Если в базе денег меньше, чем кажется приложению — отменяем
                return; 
            }
        }
        return currentData;
    }, (error, committed) => {
        if (committed) {
            // Если база подтвердила покупку
            tg.HapticFeedback.notificationOccurred('success');
            saveData(); // Сохраняем новое состояние
            updateUI(); // Обновляем экран (цифры баланса и уровня)
            NexusEvent.log(`${type.toUpperCase()} Upgraded`, `${type.toUpperCase()} Улучшен`);
        } else {
            tg.showAlert(currentLang === 'RU' ? "Ошибка покупки или недостаточно средств!" : "Purchase error or insufficient funds!");
        }
    });
};

window.saveData = function() {
    // 1. Сохраняем локально
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    localStorage.setItem('nexus_active_boosts', JSON.stringify(activeBoosts));
    localStorage.setItem('nexus_last_time', Date.now());
    localStorage.setItem('nexus_energy', energy);

    // 2. Работа с Firebase
    if (typeof db !== 'undefined' && user?.id) {
        db.ref('users/' + user.id).transaction((currentData) => {
            if (currentData === null) {
                const fullName = (user.first_name || "") + (user.last_name ? " " + user.last_name : "");
                return {
                    balance: Math.floor(balance),
                    energy: energy || 1000,
                    name: fullName,
                    v: GAME_VERSION,
                    upgrades: upgrades,
                    lastLogin: Date.now()
                };
            }

            let newBalance = Math.floor(balance);
            if (currentData.balance > newBalance) {
                newBalance = currentData.balance;
            }

            currentData.balance = newBalance;
            currentData.energy = energy;
            currentData.v = GAME_VERSION;
            currentData.lastLogin = Date.now();
            currentData.upgrades = upgrades;

            return currentData;
        }, (error, committed, snapshot) => {
            if (committed) {
                const serverBalance = snapshot.val().balance;
                if (serverBalance > balance) {
                    balance = serverBalance;
                }
                updateUI();
                console.log("✅ Синхронизация успешна!");
            }
        });
    }
}; // <--- ЗДЕСЬ ТЫ ЗАБЫЛ ЗАКРЫТЬ saveData! Теперь функц
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
    if (!m) return;

    // Проверяем: если сейчас НЕ flex, значит надо открыть
    const isOpening = m.style.display !== 'flex';

    if (isOpening) {
        m.style.display = 'flex';
        
        // Принудительная отрисовка контента
        if (id === 'market-modal' && typeof renderMarket === 'function') renderMarket();
        if (id === 'tasks-modal' && typeof renderTasks === 'function') renderTasks();
        if (id === 'rank-modal') loadLeaderboard();

        if (id === 'chat-modal') {
            setTimeout(() => {
                const c = document.getElementById('chat-messages');
                if(c) c.scrollTop = c.scrollHeight;
            }, 100);
        }

        try { tg.HapticFeedback.impactOccurred('light'); } catch(e) {}
    } else {
        // Если уже был flex — просто закрываем
        m.style.display = 'none';
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
    // 1. Считаем доход ТОЛЬКО для визуала (не прибавляем к balance!)
    let currentIncome = (upgrades.vpn.lvl * 2) / 10;
    if (tasksDone.includes('invite')) currentIncome *= 1.5;
    
    // СТРОКУ balance += currentIncome; МЫ УДАЛИЛИ. 
    // Теперь за начисление отвечает Core.applyPassive() при входе и сервер.

    const now = Date.now();

    // 2. Логика регенерации энергии (оставляем как есть)
    const regenStep = (activeBoosts.speedEnd > now) ? 1.5 : 0.5;
    if (energy < 1000) energy = Math.min(1000, energy + regenStep);

    // 3. Логика затухания Overdrive (оставляем как есть)
    if (!isOverdrive && odCharge > 0 && (now - NexusGuard.lastClickTime > 2000)) {
        odCharge = Math.max(0, odCharge - 0.3);
    }

    // 4. Обновляем интерфейс (он подтянет актуальный баланс)
    updateUI();
}, 100);

   // --- СЕКЦИЯ СОХРАНЕНИЯ (ВСТАВИТЬ В КОНЕЦ ФАЙЛА) ---

    // 1. Быстрое сохранение каждые 5 секунд
 // ... твой код с объявлением переменных ...

    document.addEventListener('DOMContentLoaded', () => { 
        if(isWasReset) tg.showAlert("NEXUS: Система обновлена!");

       // --- ОБНОВЛЕННЫЙ БЛОК: СИНХРОНИЗАЦИЯ БАЛАНСА И СТАТУСА ---
        if (user?.id) {
            // Слушаем всю ветку пользователя, а не только balance
            db.ref('users/' + user.id).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // 1. Синхронизация баланса
                    if (data.balance !== undefined && data.balance > balance) {
                        balance = data.balance;
                        updateUI(); 
                    }

                    // 2. ПОДТЯГИВАЕМ МНОЖИТЕЛЬ (x2 для Альфы)
                    // Теперь переменная window.userMultiplier всегда актуальна
                    window.userMultiplier = data.miningMultiplier || 1.0;

                    // 3. ВИЗУАЛ: Если статус уже есть, красим центральную кнопку
                    if (data.isAlphaNode === true) {
                        const alphaBtn = document.getElementById('alpha-node-btn');
                        if (alphaBtn) {
                            alphaBtn.classList.add('activated'); // Станет серой и неактивной
                        }
                    }
                }
            });
        }
        // -----------------------------------------------------

        // 1. Быстрое сохранение каждые 5 секунд
        setInterval(() => {
            saveData(); 
        }, 20000); 

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
        
        // ... твой предыдущий код (saveData, start_param и т.д.)

        updateUI(); 
        NexusEvent.log("System Online.", "Система онлайн.");

        // ==========================================
        // НОВЫЕ ФУНКЦИИ (ВСТАВЛЯТЬ СЮДА)
        // ==========================================

        // 1. Функция генерации кода для синхронизации с ПК
        window.generateSyncCode = function() {
            const userId = tg.initDataUnsafe?.user?.id;
            if (!userId) return tg.showAlert("Ошибка: ID не найден");

            const syncCode = Math.floor(100000 + Math.random() * 900000);
            
            db.ref('users/' + userId).update({
                syncCode: syncCode,
                syncTimestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("ВАШ КОД: " + syncCode + "\nВведите его в Nexus Core на ПК.");
            });
        };

        // 2. Функция активации Alpha-Node (центральная кнопка)
       window.claimAlphaStatus = function() {
            const btn = document.getElementById('alpha-node-btn');
            
            if (btn && btn.classList.contains('activated')) return;

            tg.showConfirm("Активировать статус Alpha-Node? (2X доход)", (ok) => {
                if (ok) {
                    db.ref('global/alphaNodesCount').transaction((count) => {
                        if ((count || 0) < 1000) {
                            return (count || 0) + 1;
                        }
                        return; 
                    }, (error, committed) => {
                        if (committed) {
                            db.ref('users/' + user.id).update({ 
                                isAlphaNode: true,
                                miningMultiplier: 2.0 
                            }).then(() => {
                                if (btn) btn.classList.add('activated');
                                tg.HapticFeedback.notificationOccurred('success');
                                tg.showAlert("СТАТУС АКТИВИРОВАН! 🚀\nТеперь ваш доход удвоен.");
                            });
                        } else {
                            tg.showAlert("Извините, все 1000 мест уже заняты!");
                        }
                    });
                }
            }); // Исправлено: добавлена закрывающая скобка для showConfirm
        };
        // Запускаем проверку счетчика при старте
        db.ref('global/alphaNodesCount').on('value', (snapshot) => {
            const count = snapshot.val() || 0;
            if (count >= 1000) {
                const btn = document.getElementById('alpha-node-btn');
                if (btn) btn.classList.add('activated'); // Серый цвет, если мест нет
            }
        });

    }); // Закрытие блока DOMContentLoaded
})(); // Закрытие самовызывающейся функции (IIFE)
