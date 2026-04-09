const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { generateToken } = require('../auth');

// Регистрация
router.post('/register', async (req, res) => {
  const { username, displayName, password, publicKey } = req.body;

  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be 3-32 chars' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username: only letters, numbers, underscore' });
  }

  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE username = $1', [username.toLowerCase()]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, display_name, password_hash, public_key)
       VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, public_key`,
      [username.toLowerCase(), displayName, hash, publicKey || null]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        publicKey: user.public_key,
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, password_hash, public_key, avatar_url, bio
       FROM users WHERE username = $1`,
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Обновить last_seen
    await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id, user.username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        publicKey: user.public_key,
        avatarUrl: user.avatar_url,
        bio: user.bio,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить публичный ключ (вызывается при первом входе)
router.put('/public-key', require('../auth').authMiddleware, async (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Missing publicKey' });

  try {
    await pool.query(
      'UPDATE users SET public_key = $1 WHERE id = $2',
      [publicKey, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;