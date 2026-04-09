const router = require('express').Router();
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

// Поиск пользователей по username
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, public_key
       FROM users
       WHERE username ILIKE $1 AND id != $2
       LIMIT 20`,
      [`${q}%`, req.userId]
    );

    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      publicKey: u.public_key,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить профиль пользователя по ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, bio, public_key, last_seen
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      publicKey: u.public_key,
      lastSeen: u.last_seen,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить профиль
router.put('/me', authMiddleware, async (req, res) => {
  const { displayName, bio } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio)
       WHERE id = $3
       RETURNING id, username, display_name, bio, avatar_url`,
      [displayName, bio, req.userId]
    );

    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      bio: u.bio,
      avatarUrl: u.avatar_url,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;