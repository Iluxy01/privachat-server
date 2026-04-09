require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDB } = require('./src/db');
const { setupWebSocket } = require('./src/websocket');
const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    console.log("🔄 Starting server...");

    // ⚠️ НЕ ломаем сервер если БД упала
    try {
      await initDB();
      console.log("✅ DB connected");
    } catch (err) {
      console.error("❌ DB error:", err.message);
    }

    setupWebSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (e) {
    console.error("💥 Fatal error:", e);
  }
}

start();