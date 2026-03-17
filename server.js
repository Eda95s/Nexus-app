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
    const { userId, name, clicks } = req.body; // Сервер теперь ждет 'name'

    if (!userId) return res.status(400).send("No userId");

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || { balance: 0 };

        const newBalance = (userData.balance || 0) + (clicks || 0);

        // Записываем и баланс, и ИМЯ
        await userRef.update({
            balance: newBalance,
            name: name || "Анон" 
        });

        res.status(200).json({ balance: newBalance });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


