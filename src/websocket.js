const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// userId -> WebSocket соединение
const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    let userId = null;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'auth':
          handleAuth(ws, msg, (id) => { userId = id; });
          break;

        case 'message':
          handleMessage(ws, msg, userId);
          break;

        case 'typing':
          handleTyping(msg, userId);
          break;

        case 'read':
          handleRead(msg, userId);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        // Уведомить контакты что пользователь офлайн
        broadcastPresence(userId, false);
        console.log(`👋 Disconnected: ${userId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err.message);
    });
  });

  console.log('✅ WebSocket server ready');
  return wss;
}

function handleAuth(ws, msg, setUserId) {
  try {
    const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
    const userId = payload.userId;

    // Закрыть старое соединение если есть
    if (clients.has(userId)) {
      const old = clients.get(userId);
      old.close();
    }

    clients.set(userId, ws);
    setUserId(userId);

    ws.send(JSON.stringify({ type: 'auth_ok', userId }));
    broadcastPresence(userId, true);
    console.log(`✅ Authenticated: ${userId}`);
  } catch {
    ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
    ws.close();
  }
}

function handleMessage(ws, msg, senderId) {
  if (!senderId) {
    ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
    return;
  }

  const { id, recipientId, groupId, content, contentType, localPath } = msg;

  // Формируем пакет для получателя
  // ВАЖНО: content — уже зашифрованный на клиенте текст
  // Сервер не может его прочитать
  const packet = {
    type: 'message',
    id,
    senderId,
    recipientId,
    groupId,
    content,          // зашифровано
    contentType,      // 'text' | 'image' | 'video' | 'file'
    timestamp: new Date().toISOString(),
  };

  if (groupId) {
    // Групповое сообщение — нужно знать участников
    // Пока просто отправляем обратно подтверждение,
    // список участников придёт с клиента
    const { memberIds } = msg;
    if (Array.isArray(memberIds)) {
      memberIds.forEach(memberId => {
        if (memberId !== senderId) {
          sendToUser(memberId, packet);
        }
      });
    }
  } else if (recipientId) {
    // Личное сообщение
    sendToUser(recipientId, packet);
  }

  // Подтверждение отправителю
  ws.send(JSON.stringify({
    type: 'message_sent',
    id,
    timestamp: packet.timestamp,
  }));
}

function handleTyping(msg, senderId) {
  if (!senderId) return;

  const { recipientId, groupId, isTyping } = msg;
  const packet = {
    type: 'typing',
    senderId,
    recipientId,
    groupId,
    isTyping,
  };

  if (recipientId) sendToUser(recipientId, packet);
}

function handleRead(msg, senderId) {
  if (!senderId) return;

  const { messageIds, recipientId } = msg;
  if (recipientId) {
    sendToUser(recipientId, {
      type: 'read',
      senderId,
      messageIds,
    });
  }
}

function broadcastPresence(userId, isOnline) {
  const packet = JSON.stringify({
    type: 'presence',
    userId,
    isOnline,
    lastSeen: new Date().toISOString(),
  });

  // Отправить всем подключённым (в реальном приложении — только контактам)
  clients.forEach((ws, id) => {
    if (id !== userId && ws.readyState === WebSocket.OPEN) {
      ws.send(packet);
    }
  });
}

function sendToUser(userId, data) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false; // Пользователь офлайн
}

module.exports = { setupWebSocket };