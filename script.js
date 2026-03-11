const tg = window.Telegram.WebApp;
tg.expand();

// --- ДАННЫЕ (СОСТОЯНИЕ) ---
let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};

// 1. Создаем переменную для заданий
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];

// 2. ВРЕМЕННАЯ ОЧИСТКА (Чтобы кнопки "отвисли" в Telegram)
// Как только увидишь синие кнопки - удали эти 2 строки ниже!
localStorage.removeItem('nexus_tasks');
tasksDone = [];

let energy = 1000;
let odCharge = 0;
let isOverdrive = false;
let currentLang = localStorage.getItem('nx_lang') || 'EN';

// Отображение имени пользователя
const user = tg.initDataUnsafe?.user;
window.addEventListener('load', () => {
    const nameBox = document.getElementById('user-name');
    if (nameBox && user) {
        nameBox.innerText = `NEX | ${user.first_name.toUpperCase()}`;
    }
});

// --- ЛОКАЛИЗАЦИЯ ---
const langMap = {
    EN: {
        tasks: "TASKS", claim: "CLAIM", claimed: "DONE",
        task1: "JOIN NEXUS HUB", task2: "INVITE 5 FRIENDS"
    },
    RU: {
        tasks: "ЗАДАНИЯ", claim: "ВЫПОЛНИТЬ", claimed: "ГОТОВО",
        task1: "ВСТУПИ В КАНАЛ", task2: "ПРИГЛАСИ 5 ДРУЗЕЙ"
    }
};

// --- СИСТЕМА ЗАДАНИЙ ---
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
                <button class="nexus-btn-buy" onclick="completeTask('${task.id}', ${task.reward})">
                    ${isDone ? L.claimed : L.claim}
                </button>
            </div>`;
    });
}

function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;

    // ЛОГИКА ДЕЙСТВИЙ (ССЫЛКИ)
    if (id === 'sub1') {
        tg.openTelegramLink('https://t.me/твой_канал'); // ЗАМЕНИ НА СВОЙ КАНАЛ!
    }

    // НАЧИСЛЕНИЕ
    balance += reward;
    tasksDone.push(id);
    localStorage.setItem('nexus_bal', balance);
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    
    updateUI();
    renderTasks();
    tg.HapticFeedback.notificationOccurred('success');
}

// --- ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---
function updateUI() {
    if (document.getElementById('balance-value')) {
        document.getElementById('balance-value').innerText = Math.floor(balance).toLocaleString();
    }
    // Здесь можно добавить обновление энергии и других шкал
}

// --- КЛИКЕР ---
document.getElementById('touch-zone')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (energy < 2) return;
    
    let pwr = upgrades.node.lvl;
    balance += pwr;
    energy -= 2;
    
    updateUI();
    localStorage.setItem('nexus_bal', balance);
    tg.HapticFeedback.impactOccurred('medium');
});

// Запуск при загрузке
updateUI();
renderTasks();

function toggleModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}
