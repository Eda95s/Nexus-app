const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Проверка наличия переменной окружения
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Переменная FIREBASE_SERVICE_ACCOUNT не установлена!");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Проверь, что этот URL совпадает с тем, что в консоли Firebase
    databaseURL: "https://nexus-app-6769e-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const db = admin.database();

// Маршрут для сохранения кликов
app.post('/api/click', async (req, res) => {
    // Приводим userId к строке, чтобы избежать проблем с форматом ключей в Firebase
    const userId = String(req.body.userId);
    const { name, clicks } = req.body;
    
    const clicksToAdd = parseInt(clicks);

    if (!userId || userId === "undefined" || userId === "null") {
        return res.status(400).json({ error: "Invalid or missing userId" });
    }

    if (isNaN(clicksToAdd) || clicksToAdd <= 0) {
        return res.status(400).json({ error: "Invalid clicks count" });
    }

    try {
        const userRef = db.ref(`users/${userId}`);
        
        // Используем transaction вместо once + update! 
        // Это гарантирует, что если придет 2 запроса одновременно, баланс не "сломается"
        const result = await userRef.transaction((currentData) => {
            if (currentData === null) {
                // Если юзера еще нет в базе
                return {
                    balance: clicksToAdd,
                    name: name || "New Miner",
                    v: "2.2.0"
                };
            } else {
                // Если юзер есть, плюсуем баланс
                currentData.balance = (currentData.balance || 0) + clicksToAdd;
                if (name) currentData.name = name; // Обновляем имя, если пришло
                return currentData;
            }
        });

        if (result.committed) {
            console.log(`✅ Баланс юзера ${userId} обновлен: +${clicksToAdd}`);
            res.status(200).json({ 
                success: true, 
                balance: result.snapshot.val().balance 
            });
        } else {
            res.status(500).json({ error: "Transaction not committed" });
        }

    } catch (error) {
        console.error("🔥 Firebase Admin Error:", error);
        res.status(500).json({ error: "Server Database Error", details: error.message });
    }
});

// Маршрут для таблицы лидеров
app.get('/api/leaders', async (req, res) => {
    try {
        // Берем топ 15 по балансу
        const usersRef = db.ref('users');
        const snapshot = await usersRef.orderByChild('balance').limitToLast(15).once('value');
        
        const users = snapshot.val() || {};
        
        const leaderboard = Object.keys(users).map(id => ({
            name: users[id].name || "Анон",
            balance: users[id].balance || 0
        }))
        .sort((a, b) => b.balance - a.balance);

        res.json(leaderboard);
    } catch (e) {
        console.error("Leaderboard Error:", e);
        res.status(500).send("Error fetching leaders");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 NEXUS Backend Live on Port ${PORT}`);
    console.log(`🔗 Database URL: ${admin.app().options.databaseURL}`);
});
