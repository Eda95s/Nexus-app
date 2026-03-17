const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Инициализация через переменную окружения (Admin SDK)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://nexus-app-6769e-default-rtdb.europe-west1.firebasedatabase.app",
    databaseAuthVariableOverride: {
      uid: "my-service-worker" // Это заставляет Firebase видеть сервер как авторизованного юзера
    }
  });
}

const db = admin.database();

// Маршрут для сохранения кликов
app.post('/api/click', async (req, res) => {
    const { userId, name, clicks } = req.body;
    if (!userId) return res.status(400).json({ error: "No userId" });

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || { balance: 0 };

        const newBalance = (userData.balance || 0) + (clicks || 0);

        // Используем update, чтобы не затереть существующие данные
        await userRef.update({
            balance: newBalance,
            name: name || "Игрок"
        });

        res.status(200).json({ success: true, balance: newBalance });
    } catch (error) {
        console.error("Firebase Admin Error:", error);
        res.status(500).json({ error: "Server Database Error" });
    }
});

// Маршрут для таблицы лидеров
app.get('/api/leaders', async (req, res) => {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        
        const leaderboard = Object.keys(users).map(id => ({
            name: users[id].name || "Анон",
            balance: users[id].balance || 0
        })).sort((a, b) => b.balance - a.balance).slice(0, 10);

        res.json(leaderboard);
    } catch (e) {
        res.status(500).send("Error fetching leaders");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
