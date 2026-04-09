const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Bad token format' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = { authMiddleware, generateToken };