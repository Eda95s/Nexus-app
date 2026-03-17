const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Инициализация базы через твою переменную FIREBASE_SERVICE_ACCOUNT
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nexus-app-6769e-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

// МАРШРУТ 1: Сохранение кликов и ИМЕНИ
app.post('/api/click', async (req, res) => {
    const { userId, name, clicks } = req.body;
    
    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || { balance: 0 };

        // ГЛАВНОЕ: Плюсуем новые клики к старому балансу
        const newBalance = (userData.balance || 0) + (clicks || 0);

        await userRef.update({
            balance: newBalance,
            name: name || "Игрок"
        });

        res.status(200).json({ balance: newBalance });
    } catch (error) {
        console.error("Ошибка записи в Firebase:", error);
        res.status(500).send("Error");
    }
});

// МАРШРУТ 2: Список лидеров (чтобы не висело SYNCING)
app.get('/api/leaders', async (req, res) => {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val() || {};
    
    // Превращаем базу в список и сортируем по балансу
    const leaderboard = Object.keys(users).map(id => ({
        name: users[id].name || "Анон",
        balance: users[id].balance || 0
    })).sort((a, b) => b.balance - a.balance).slice(0, 10);

    res.json(leaderboard);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
