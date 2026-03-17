const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Инициализация
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nexus-app-6769e-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

app.post('/api/click', async (req, res) => {
    const { userId, name, clicks } = req.body;
    console.log(`Пришли клики от ${userId}: ${clicks}`); // Увидишь это в логах Render

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || { balance: 0 };

        const newBalance = (userData.balance || 0) + (clicks || 0);

        await userRef.update({
            balance: newBalance,
            name: name || "Player"
        });

        res.status(200).json({ balance: newBalance });
    } catch (e) {
        console.error("Ошибка записи:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
