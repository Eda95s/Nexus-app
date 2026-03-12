const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;

let balance = parseInt(localStorage.getItem('nexus_bal')) || 0;
let upgrades = JSON.parse(localStorage.getItem('nexus_upgrades')) || {
    node: { lvl: 1, cost: 1000, power: 1 },
    vpn: { lvl: 0, cost: 3240, income: 1 }
};
let tasksDone = JSON.parse(localStorage.getItem('nexus_tasks')) || [];
let energy = 1000;
let currentLang = localStorage.getItem('nx_lang') || 'EN';

const langMap = {
    EN: { market: "MARKET", tasks: "TASKS", buy: "UPGRADE", claim: "CLAIM", claimed: "DONE", task3: "REACH 100K N", need: "Need 100k N!" },
    RU: { market: "МАРКЕТ", tasks: "ЗАДАНИЯ", buy: "КУПИТЬ", claim: "ЗАБРАТЬ", claimed: "ГОТОВО", task3: "НАКОПИ 100K N", need: "Нужно 100к N!" }
};

function updateUI() {
    document.getElementById('balance').innerText = Math.floor(balance).toLocaleString();
    document.getElementById('energy-text').innerText = Math.floor(energy);
    document.getElementById('energy-fill').style.width = (energy / 10) + "%";
    renderMarket();
    renderTasks();
}

function mine(event) {
    if (energy >= upgrades.node.power) {
        balance += upgrades.node.power;
        energy -= upgrades.node.power;
        tg.HapticFeedback.impactOccurred('light');
        updateUI();
        saveData();
    }
}

function renderMarket() {
    const grid = document.getElementById('market-grid');
    if(!grid) return;
    grid.innerHTML = `
        <div class="card-nexus">
            <div class="card-info">
                <span class="card-title">NODE LVL ${upgrades.node.lvl}</span>
                <span class="card-sub">COST: ${upgrades.node.cost}</span>
            </div>
            <button class="nexus-btn-buy" onclick="buyUpgrade('node')">UP</button>
        </div>
    `;
}

function renderTasks() {
    const L = langMap[currentLang];
    const grid = document.getElementById('tasks-grid');
    if(!grid) return;
    
    const tasks = [
        { id: 'sub1', title: "JOIN HUB", reward: 50000 },
        { id: 'reach100k', title: L.task3, reward: 250000 }
    ];

    grid.innerHTML = "";
    tasks.forEach(t => {
        const done = tasksDone.includes(t.id);
        grid.innerHTML += `
            <div class="card-nexus">
                <div class="card-info">
                    <span class="card-title">${t.title}</span>
                    <span class="card-sub">+${t.reward}</span>
                </div>
                <button class="nexus-btn-buy" onclick="completeTask('${t.id}', ${t.reward})" ${done ? 'disabled' : ''}>
                    ${done ? L.claimed : L.claim}
                </button>
            </div>
        `;
    });
}

function completeTask(id, reward) {
    if (tasksDone.includes(id)) return;

    if (id === 'reach100k' && balance < 100000) {
        tg.showAlert(langMap[currentLang].need);
        return;
    }

    balance += reward;
    tasksDone.push(id);
    localStorage.setItem('nexus_tasks', JSON.stringify(tasksDone));
    updateUI();
    saveData();
}

function buyWithStars(type, price) {
    tg.openInvoice({
        title: "X2 POWER",
        description: "Permanent Multiplier",
        currency: "XTR",
        prices: [{ label: "Buy", amount: price }],
        payload: "stars_x2"
    }, (status) => {
        if (status === 'paid') {
            upgrades.node.power *= 2;
            saveData();
            updateUI();
        }
    });
}

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function saveData() {
    const data = { balance, upgrades, tasksDone };
    localStorage.setItem('nexus_data', JSON.stringify(data));
    if(user) firebase.database().ref('users/' + user.id).set(data);
}

setInterval(() => { if (energy < 1000) { energy += 1; updateUI(); } }, 1000);
updateUI();
