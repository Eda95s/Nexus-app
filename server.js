const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация Firebase Admin (ключи мы добавим в переменные окружения на Render)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG)),
  databaseURL: "https://nexus-app-6769e-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// ГЛАВНЫЙ МАРШРУТ: Клик
app.post('/api/click', async (req, res) => {
    const { userId, initData } = req.body;

    // ТУТ БУДЕТ ПРОВЕРКА initData (подлинность от Telegram)
    
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    let userData = snapshot.val() || { balance: 0, energy: 1000, lastUpdate: Date.now() };

    // Логика начисления на сервере
    const clickPower = 1; // Берем из БД в зависимости от уровня ноды
    if (userData.energy >= 2) {
        userData.balance += clickPower;
        userData.energy -= 2;
        await userRef.update(userData);
        res.json({ success: true, balance: userData.balance, energy: userData.energy });
    } else {
        res.status(400).json({ error: "No energy" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Server running on port ${PORT}));
