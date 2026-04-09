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

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

// Healthcheck для Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await initDB();
  setupWebSocket(server);
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start().catch(console.error);