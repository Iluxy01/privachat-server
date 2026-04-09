const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(32) UNIQUE NOT NULL,
        display_name VARCHAR(64) NOT NULL,
        password_hash TEXT NOT NULL,
        public_key TEXT,
        avatar_url TEXT,
        bio TEXT DEFAULT '',
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(64) NOT NULL,
        avatar_url TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id UUID REFERENCES group_chats(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(16) DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS push_tokens (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(8) DEFAULT 'android',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id)
      );
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };